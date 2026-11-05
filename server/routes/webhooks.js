import { Router } from "express";
import express from "express";
import { db } from "../db.js";
import { verifyRazorpayWebhook, hasWebhookSecret } from "../lib/payments.js";
import { markPaymentFailed, markPaymentPaid } from "../lib/payment-service.js";

const router = Router();

const METHOD_MAP = { upi: "UPI", card: "CARD", netbanking: "UPI", wallet: "UPI" };

router.post(
  "/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    if (!hasWebhookSecret()) {
      console.warn("[razorpay] webhook received but RAZORPAY_WEBHOOK_SECRET is not configured");
      return res.status(503).json({ error: "Webhook is not configured." });
    }
    const signature = req.headers["x-razorpay-signature"];
    if (!verifyRazorpayWebhook(req.body, signature)) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON body." });
    }

    const paymentEntity = event?.payload?.payment?.entity;
    const orderEntity = event?.payload?.order?.entity;
    const providerOrderId = paymentEntity?.order_id || orderEntity?.id;
    if (!providerOrderId) return res.json({ received: true, ignored: "no order reference" });

    const payment = db.query("SELECT * FROM payments WHERE provider_order_id = ?").get(providerOrderId);
    if (!payment) {
      console.warn("[razorpay] webhook for unknown order", providerOrderId);
      return res.json({ received: true, ignored: "unknown order" });
    }

    try {
      if (event.event === "payment.captured" || event.event === "order.paid") {
        if (paymentEntity?.amount) {
          const expected = Math.round(payment.amount * 100);
          if (Math.abs(Number(paymentEntity.amount) - expected) > 1) {
            console.error("[razorpay] amount mismatch", { expected, received: paymentEntity.amount });
            return res.status(400).json({ error: "Amount mismatch." });
          }
        }
        markPaymentPaid(payment.id, {
          method: METHOD_MAP[paymentEntity?.method] || "UPI",
          transactionId: paymentEntity?.id || providerOrderId,
          providerPaymentId: paymentEntity?.id || null,
          paidAt: paymentEntity?.created_at
            ? new Date(paymentEntity.created_at * 1000).toISOString()
            : undefined,
          source: "gateway",
        });
      } else if (event.event === "payment.failed") {
        markPaymentFailed(payment.id, { reason: paymentEntity?.error_description || "Payment failed" });
      }
      res.json({ received: true });
    } catch (error) {
      console.error("[razorpay] webhook handling failed", error);
      res.status(500).json({ error: "Webhook handling failed." });
    }
  }
);

export default router;
