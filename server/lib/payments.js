import { createHmac, timingSafeEqual } from "node:crypto";

const MODE = process.env.PAYMENT_MODE === "razorpay" ? "razorpay" : "demo";
const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

// Hosted platforms expose their public origin automatically. Prefer an explicit
// APP_URL so custom domains are always reflected in QR codes.
const PLATFORM_URL =
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") ||
  "http://localhost:5173";

export const APP_URL = (process.env.APP_URL || PLATFORM_URL).replace(/\/+$/, "");

export function paymentMode() {
  if (MODE === "razorpay" && KEY_ID && KEY_SECRET) return "razorpay";
  return "demo";
}

export function razorpayKeyId() {
  return KEY_ID;
}

export function appUrl() {
  return APP_URL;
}

export function menuUrl(token) {
  return `${APP_URL}/t/${token}`;
}

export function payUrl(token) {
  return `${APP_URL}/pay/${token}`;
}

export function buildUpiUri({ vpa, name, amount, orderCode, note }) {
  if (!vpa) return null;
  const params = new URLSearchParams();
  params.set("pa", vpa);
  params.set("pn", name || "Restaurant");
  params.set("am", Number(amount).toFixed(2));
  params.set("cu", "INR");
  params.set("tn", (note || `Payment for ${orderCode}`).slice(0, 50));
  if (orderCode) params.set("tr", orderCode);
  return `upi://pay?${params.toString()}`;
}

export async function createRazorpayOrder({ amount, orderCode, paymentCode, restaurantName }) {
  if (paymentMode() !== "razorpay") return null;
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: orderCode,
      notes: { paymentCode, restaurantName },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("[razorpay] order creation failed:", response.status, text.slice(0, 300));
    throw new Error("Could not start the payment gateway. Please try again.");
  }
  const data = await response.json();
  return { providerOrderId: data.id, amount: data.amount, keyId: KEY_ID };
}

export function verifyRazorpayWebhook(rawBody, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hasWebhookSecret() {
  return Boolean(WEBHOOK_SECRET);
}
