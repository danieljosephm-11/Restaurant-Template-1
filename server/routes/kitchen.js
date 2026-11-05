import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { asyncHandler, HttpError, logAudit, nowIso, rateLimit } from "../lib/util.js";
import { emit, emitToRestaurant } from "../lib/realtime.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "kitchen"));

const ACTIVE = ["placed", "accepted", "preparing", "ready"];
const TRANSITIONS = {
  placed: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "served",
};

function getTicket(order) {
  const items = db
    .query("SELECT name, quantity, is_veg FROM order_items WHERE order_id = ? ORDER BY rowid")
    .all(order.id)
    .map((item) => ({ name: item.name, quantity: item.quantity, isVeg: !!item.is_veg }));
  return {
    id: order.id,
    orderCode: order.order_code,
    tableName: order.table_name,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    notes: order.notes,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
  };
}

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const rows = db
      .query(
        `SELECT o.*, t.table_name FROM orders o JOIN tables t ON t.id = o.table_id
         WHERE o.restaurant_id = ? AND o.status IN ('placed','accepted','preparing','ready')
         ORDER BY o.created_at ASC`
      )
      .all(req.user.restaurant_id);
    const tickets = rows.map(getTicket);
    res.json({
      tickets,
      summary: {
        new: tickets.filter((ticket) => ticket.status === "placed").length,
        preparing: tickets.filter((ticket) => ["accepted", "preparing"].includes(ticket.status)).length,
        ready: tickets.filter((ticket) => ticket.status === "ready").length,
      },
      serverTime: nowIso(),
    });
  })
);

router.patch(
  "/orders/:id/status",
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const order = db
      .query("SELECT * FROM orders WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!order) throw new HttpError(404, "Order not found.");

    const next = String(req.body.status || "");
    if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, order.status)) {
      throw new HttpError(409, `This order is already ${order.status}.`);
    }
    if (TRANSITIONS[order.status] !== next) {
      throw new HttpError(409, `This ticket can only move to "${TRANSITIONS[order.status]}".`);
    }

    const now = nowIso();
    db.query(
      "UPDATE orders SET status = ?, updated_at = ?, served_at = CASE WHEN ? = 'served' THEN ? ELSE served_at END WHERE id = ?"
    ).run(next, now, next, now, order.id);

    if (next === "served") {
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

    logAudit(restaurantId, req.user.id, "kitchen.status_changed", `${order.order_code} · ${order.status} → ${next}`);
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
