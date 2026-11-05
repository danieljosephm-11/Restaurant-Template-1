import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "../db.js";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const nowIso = () => new Date().toISOString();

export const newId = (prefix) => `${prefix}_${randomUUID()}`;

export const randomToken = (bytes = 18) => randomBytes(bytes).toString("base64url");

export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const toBool = (v, fallback = false) => {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
};

export function requireString(value, label, { min = 1, max = 200 } = {}) {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length < min) throw new HttpError(400, `${label} is required.`);
  if (s.length > max) throw new HttpError(400, `${label} must be under ${max} characters.`);
  return s;
}

export function optionalString(value, max = 500) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > max) throw new HttpError(400, `Text must be under ${max} characters.`);
  return s;
}

export function requireNumber(value, label, { min = 0, max = 1_000_000, integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  if (n < min || n > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return integer ? Math.round(n) : n;
}

export function requireEmail(value) {
  const email = requireString(value, "Email", { max: 160 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  return email;
}

export function publicRestaurant(r) {
  return {
    name: r.name,
    tagline: r.tagline,
    logo: r.logo,
    address: r.address,
    phone: r.phone,
    email: r.email,
    gstin: r.gstin,
    taxPercent: r.tax_percent,
    serviceChargePercent: r.service_charge_percent,
    currency: r.currency,
    upiName: r.upi_name,
  };
}

export function logAudit(restaurantId, actorId, action, detail = null) {
  db.query(
    "INSERT INTO audit_log (id, restaurant_id, actor_id, action, detail, created_at) VALUES (?,?,?,?,?,?)"
  ).run(newId("aud"), restaurantId, actorId, action, detail, nowIso());
}

export function rateLimit({ windowMs = 60_000, max = 30, message = "Too many requests. Please slow down." } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.reset < now) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.reset - now) / 1000));
      return next(new HttpError(429, message));
    }
    next();
  };
}
