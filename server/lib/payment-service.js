import { db, tx } from "../db.js";
import { emit, emitToRestaurant } from "./realtime.js";
import { HttpError, logAudit, newId, nowIso } from "./util.js";

function announce(payment, order, event) {
  const payload = {
    paymentId: payment.id,
    paymentCode: payment.payment_code,
    orderId: order.id,
    orderCode: order.order_code,
    amount: payment.amount,
    status: payment.status,
    method: payment.method,
    paymentStatus: order.payment_status,
    at: nowIso(),
  };
  if (payment.session_hash) emit(`payment:${payment.session_hash}`, event, payload);
  emit(`order:${order.public_token}`, "payment:updated", payload);
  emitToRestaurant(order.restaurant_id, "payment:updated", payload);
  emitToRestaurant(order.restaurant_id, "order:updated", {
    orderId: order.id,
    orderCode: order.order_code,
    status: order.status,
    paymentStatus: order.payment_status,
  });
}

export function markPaymentPaid(paymentId, options = {}) {
  let result;
  tx(() => {
    const payment = db.query("SELECT * FROM payments WHERE id = ?").get(paymentId);
    if (!payment) throw new HttpError(404, "Payment not found.");
    const order = db.query("SELECT * FROM orders WHERE id = ?").get(payment.order_id);
    if (!order) throw new HttpError(404, "Order not found.");

    if (payment.status === "paid") {
      result = { payment, order, alreadyPaid: true };
      return;
    }
    if (payment.status === "refunded") {
      throw new HttpError(409, "This payment has already been refunded.");
    }

    const paidAt = options.paidAt || nowIso();
    db.query(
      `UPDATE payments
       SET status = 'paid',
           method = COALESCE(?, method),
           transaction_id = COALESCE(?, transaction_id),
           provider_payment_id = COALESCE(?, provider_payment_id),
           paid_at = ?
       WHERE id = ?`
    ).run(
      options.method || null,
      options.transactionId || null,
      options.providerPaymentId || null,
      paidAt,
      paymentId
    );

    // One order can only ever have one successful collection. Any other open
    // payment sessions for the same order are retired, preventing double payment.
    db.query(
      "UPDATE payments SET status = 'expired' WHERE order_id = ? AND id <> ? AND status = 'pending'"
    ).run(order.id, paymentId);

    db.query("UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ?").run(paidAt, order.id);

    logAudit(
      order.restaurant_id,
      options.actorId || null,
      options.source === "demo" ? "payment.demo_confirmed" : "payment.captured",
      `${payment.payment_code} · ${payment.amount} ${payment.method}`
    );

    result = {
      payment: db.query("SELECT * FROM payments WHERE id = ?").get(paymentId),
      order: db.query("SELECT * FROM orders WHERE id = ?").get(order.id),
      alreadyPaid: false,
    };
  });

  if (!result.alreadyPaid) announce(result.payment, result.order, "payment:updated");
  return result;
}

export function markPaymentFailed(paymentId, options = {}) {
  const payment = db.query("SELECT * FROM payments WHERE id = ?").get(paymentId);
  if (!payment || payment.status === "paid") return null;
  db.query("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'").run(paymentId);
  const order = db.query("SELECT * FROM orders WHERE id = ?").get(payment.order_id);
  if (order) {
    const stillPending = db
      .query("SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND status = 'pending'")
      .get(order.id).count;
    if (!stillPending && order.payment_status === "pending") {
      db.query("UPDATE orders SET payment_status = 'unpaid', updated_at = ? WHERE id = ?").run(nowIso(), order.id);
    }
    emitToRestaurant(order.restaurant_id, "payment:updated", {
      paymentId,
      orderId: order.id,
      status: "failed",
      reason: options.reason || null,
    });
  }
  return db.query("SELECT * FROM payments WHERE id = ?").get(paymentId);
}

export function expirePaymentIfStale(payment) {
  if (!payment || payment.status !== "pending" || !payment.expires_at) return payment;
  if (new Date(payment.expires_at).getTime() > Date.now()) return payment;

  db.query("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending'").run(payment.id);
  const order = db.query("SELECT * FROM orders WHERE id = ?").get(payment.order_id);
  if (order) {
    const stillPending = db
      .query("SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND status = 'pending'")
      .get(order.id).count;
    if (!stillPending && order.payment_status === "pending") {
      db.query("UPDATE orders SET payment_status = 'unpaid', updated_at = ? WHERE id = ?").run(nowIso(), order.id);
    }
    emitToRestaurant(order.restaurant_id, "payment:updated", {
      paymentId: payment.id,
      orderId: order.id,
      status: "expired",
    });
  }
  return db.query("SELECT * FROM payments WHERE id = ?").get(payment.id);
}

export function refundPayment(paymentId, actorId) {
  let result;
  tx(() => {
    const payment = db.query("SELECT * FROM payments WHERE id = ?").get(paymentId);
    if (!payment) throw new HttpError(404, "Payment not found.");
    if (payment.status !== "paid") throw new HttpError(409, "Only a completed payment can be refunded.");
    const order = db.query("SELECT * FROM orders WHERE id = ?").get(payment.order_id);
    db.query("UPDATE payments SET status = 'refunded' WHERE id = ?").run(paymentId);
    db.query("UPDATE orders SET payment_status = 'refunded', updated_at = ? WHERE id = ?").run(nowIso(), order.id);
    logAudit(order.restaurant_id, actorId, "payment.refunded", `${payment.payment_code} · ${payment.amount}`);
    result = {
      payment: db.query("SELECT * FROM payments WHERE id = ?").get(paymentId),
      order: db.query("SELECT * FROM orders WHERE id = ?").get(order.id),
    };
  });
  announce(result.payment, result.order, "payment:updated");
  return result;
}

export function createPaymentCode(restaurantId) {
  const row = db
    .query("UPDATE restaurants SET payment_seq = payment_seq + 1 WHERE id = ? RETURNING payment_seq")
    .get(restaurantId);
  return `PAY-${row.payment_seq}`;
}

export function createOrderCode(restaurantId) {
  const row = db
    .query("UPDATE restaurants SET order_seq = order_seq + 1 WHERE id = ? RETURNING payment_seq, order_seq")
    .get(restaurantId);
  return `ORD-${row.order_seq}`;
}

export function audit(restaurantId, actorId, action, detail) {
  logAudit(restaurantId, actorId, action, detail);
}

export function newAuditId() {
  return newId("aud");
}
