import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { HttpError } from "./util.js";

const SECRET = process.env.JWT_SECRET || "smartdine-dev-secret-change-me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[smartdine] JWT_SECRET is not set — using the development fallback. Set it before going live.");
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, rid: user.restaurant_id, role: user.role },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurant_id,
  };
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, "Please sign in to continue."));
  const payload = verifyToken(token);
  if (!payload) return next(new HttpError(401, "Your session has expired. Please sign in again."));
  const user = db
    .query("SELECT id, restaurant_id, name, email, role FROM users WHERE id = ?")
    .get(payload.sub);
  if (!user) return next(new HttpError(401, "Account not found."));
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Please sign in to continue."));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "You do not have access to this area."));
    next();
  };
}
