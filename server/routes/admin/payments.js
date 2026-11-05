import { Router } from "express";
import { db } from "../../db.js";
import { asyncHandler, HttpError, rateLimit, round2 } from "../../lib/util.js";
import { markPaymentPaid, refundPayment } from "../../lib/payment-service.js";

const router = Router();
const STATUSES = ["pending", "paid", "failed", "expired", "refunded"];
const METHODS = ["UPI", "CARD", "CASH"];

function serializePayment(payment) {
  return {
    id: payment.id,
    paymentCode: payment.payment_code,
    orderId: payment.order_id,
    orderCode: payment.order_code,
    orderPublicToken: payment.public_token,
    tableName: payment.table_name,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    provider: payment.provider,
    transactionId: payment.transaction_id,
    providerOrderId: payment.provider_order_id,
    createdAt: payment.created_at,
    paidAt: payment.paid_at,
    expiresAt: payment.expires_at,
  };
}

function loadPayment(id) {
  return db
    .query(
      `SELECT p.*, o.order_code, o.public_token, t.table_name
       FROM payments p JOIN orders o ON o.id = p.order_id JOIN tables t ON t.id = o.table_id
       WHERE p.id = ?`
    )
    .get(id);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const conditions = ["p.restaurant_id = ?"];
    const params = [restaurantId];

    const status = String(req.query.status || "");
    if (status && status !== "all") {
      if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid payment status filter.");
      conditions.push("p.status = ?");
      params.push(status);
    }
    const method = String(req.query.method || "");
    if (method && method !== "all") {
      if (!METHODS.includes(method)) throw new HttpError(400, "Invalid payment method filter.");
      conditions.push("p.method = ?");
      params.push(method);
    }
    const q = String(req.query.q || "").trim();
    if (q) {
      conditions.push("(o.order_code LIKE ? OR p.payment_code LIKE ? OR p.transaction_id LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (Number.isNaN(from.getTime())) throw new HttpError(400, "Invalid start date.");
      conditions.push("p.created_at >= ?");
      params.push(from.toISOString());
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (Number.isNaN(to.getTime())) throw new HttpError(400, "Invalid end date.");
      conditions.push("p.created_at <= ?");
      params.push(to.toISOString());
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 150, 1), 500);
    const rows = db
      .query(
        `SELECT p.*, o.order_code, o.public_token, t.table_name
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         JOIN tables t ON t.id = o.table_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY p.created_at DESC LIMIT ?`
      )
      .all(...params, limit);

    const summary = db
      .query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) AS collected,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) AS pending,
           COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount END), 0) AS refunded,
           COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
           COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count
         FROM payments WHERE restaurant_id = ?`
      )
      .get(restaurantId);

    res.json({
      payments: rows.map(serializePayment),
      summary: {
        collected: round2(summary.collected),
        pending: round2(summary.pending),
        refunded: round2(summary.refunded),
        paidCount: summary.paid_count,
        pendingCount: summary.pending_count,
      },
    });
  })
);

router.post(
  "/:id/mark-paid",
  rateLimit({ windowMs: 60_000, max: 30 }),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const payment = db
      .query("SELECT * FROM payments WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!payment) throw new HttpError(404, "Payment not found.");
    if (payment.status === "paid") throw new HttpError(409, "This payment is already marked paid.");
    if (payment.status === "refunded") throw new HttpError(409, "This payment was refunded.");

    const method = String(req.body.method || "CASH").toUpperCase();
    if (!METHODS.includes(method)) throw new HttpError(400, "Choose UPI, card or cash.");
    const result = markPaymentPaid(payment.id, {
      method,
      transactionId: req.body.transactionId || `MANUAL-${payment.payment_code}`,
      actorId: req.user.id,
      source: "manual",
    });
    res.json({ payment: serializePayment(loadPayment(result.payment.id)) });
  })
);

router.post(
  "/:id/refund",
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const payment = db
      .query("SELECT * FROM payments WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!payment) throw new HttpError(404, "Payment not found.");
    const result = refundPayment(payment.id, req.user.id);
    res.json({ payment: serializePayment(loadPayment(result.payment.id)) });
  })
);

export default router;
