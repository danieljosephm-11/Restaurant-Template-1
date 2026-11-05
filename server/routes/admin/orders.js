import { Router } from "express";
import { db } from "../../db.js";
import {
  asyncHandler,
  HttpError,
  logAudit,
  nowIso,
  rateLimit,
} from "../../lib/util.js";
import { getOrderById, getOrderItems, serializeOrder } from "../../lib/orders.js";
import { emit, emitToRestaurant } from "../../lib/realtime.js";

const router = Router();

const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "served", "cancelled"];
const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"];
const ACTIVE = ["placed", "accepted", "preparing", "ready"];
const TRANSITIONS = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
};

function serializeListItem(order) {
  return {
    id: order.id,
    orderCode: order.order_code,
    publicToken: order.public_token,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotal: order.subtotal,
    tax: order.tax,
    serviceCharge: order.service_charge,
    total: order.total,
    notes: order.notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    servedAt: order.served_at,
    table: { id: order.table_id, number: order.table_number, name: order.table_name },
    itemCount: order.item_count,
    paidMethod: order.paid_method || null,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const conditions = ["o.restaurant_id = ?"];
    const params = [restaurantId];

    const status = String(req.query.status || "");
    if (status === "active") {
      conditions.push(`o.status IN (${ACTIVE.map(() => "?").join(",")})`);
      params.push(...ACTIVE);
    } else if (status && status !== "all") {
      if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, "Invalid order status filter.");
      conditions.push("o.status = ?");
      params.push(status);
    }

    const payment = String(req.query.payment || "");
    if (payment && payment !== "all") {
      if (!PAYMENT_STATUSES.includes(payment)) throw new HttpError(400, "Invalid payment filter.");
      conditions.push("o.payment_status = ?");
      params.push(payment);
    }

    const q = String(req.query.q || "").trim();
    if (q) {
      conditions.push("(o.order_code LIKE ? OR t.table_name LIKE ? OR CAST(t.table_number AS TEXT) LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (req.query.from) {
      const from = new Date(req.query.from);
      if (Number.isNaN(from.getTime())) throw new HttpError(400, "Invalid start date.");
      conditions.push("o.created_at >= ?");
      params.push(from.toISOString());
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (Number.isNaN(to.getTime())) throw new HttpError(400, "Invalid end date.");
      conditions.push("o.created_at <= ?");
      params.push(to.toISOString());
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 150, 1), 500);
    const rows = db
      .query(
        `SELECT o.*, t.table_number, t.table_name,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
           (SELECT method FROM payments p WHERE p.order_id = o.id AND p.status = 'paid'
            ORDER BY p.paid_at DESC LIMIT 1) AS paid_method
         FROM orders o JOIN tables t ON t.id = o.table_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY o.created_at DESC LIMIT ?`
      )
      .all(...params, limit);

    const counts = db
      .query(
        `SELECT status, COUNT(*) AS count FROM orders WHERE restaurant_id = ? AND created_at >= ?
         GROUP BY status`
      )
      .all(restaurantId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    res.json({
      orders: rows.map(serializeListItem),
      counts,
      last24h: counts.reduce((sum, item) => sum + item.count, 0),
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = getOrderById(req.params.id);
    if (order.restaurant_id !== req.user.restaurant_id) throw new HttpError(404, "Order not found.");
    const payments = db
      .query(
        `SELECT id, payment_code, amount, method, status, provider, transaction_id, provider_order_id,
                created_at, paid_at, expires_at
         FROM payments WHERE order_id = ? ORDER BY created_at DESC`
      )
      .all(order.id)
      .map((payment) => ({
        id: payment.id,
        paymentCode: payment.payment_code,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        provider: payment.provider,
        transactionId: payment.transaction_id,
        providerOrderId: payment.provider_order_id,
        createdAt: payment.created_at,
        paidAt: payment.paid_at,
        expiresAt: payment.expires_at,
      }));
    const payload = serializeOrder(order, { items: getOrderItems(order.id) });
    res.json({
      ...payload,
      id: order.id,
      tableId: order.table_id,
      payments,
    });
  })
);

router.patch(
  "/:id/status",
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const order = db
      .query("SELECT * FROM orders WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!order) throw new HttpError(404, "Order not found.");

    const next = String(req.body.status || "");
    if (!ORDER_STATUSES.includes(next)) throw new HttpError(400, "Choose a valid order status.");
    if (order.status === next) {
      return res.json({ ok: true, status: next });
    }
    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(next)) {
      throw new HttpError(
        409,
        `An order that is "${order.status}" cannot move to "${next}".`
      );
    }

    const now = nowIso();
    db.query("UPDATE orders SET status = ?, updated_at = ?, served_at = CASE WHEN ? = 'served' THEN ? ELSE served_at END WHERE id = ?").run(
      next,
      now,
      next,
      now,
      order.id
    );

    if (["served", "cancelled"].includes(next)) {
      const active = db
        .query(
          "SELECT COUNT(*) AS count FROM orders WHERE table_id = ? AND status IN ('placed','accepted','preparing','ready')"
        )
        .get(order.table_id).count;
      if (active === 0) {
        db.query("UPDATE tables SET status = 'available' WHERE id = ? AND status = 'occupied'").run(order.table_id);
        emitToRestaurant(restaurantId, "table:updated", { tableId: order.table_id });
      }
    }

    logAudit(restaurantId, req.user.id, "order.status_changed", `${order.order_code} · ${order.status} → ${next}`);
    const publicToken = db.query("SELECT public_token FROM orders WHERE id = ?").get(order.id).public_token;
    const event = {
      orderId: order.id,
      orderCode: order.order_code,
      status: next,
      paymentStatus: order.payment_status,
      updatedAt: now,
    };
    emitToRestaurant(restaurantId, "order:updated", event);
    emit(`order:${publicToken}`, "order:updated", event);

    res.json({ ok: true, status: next, updatedAt: now });
  })
);

export default router;
