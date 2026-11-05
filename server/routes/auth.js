import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { publicUser, requireAuth, signToken } from "../lib/auth.js";
import { asyncHandler, HttpError, publicRestaurant, rateLimit, requireEmail, requireString } from "../lib/util.js";

const router = Router();

router.post(
  "/login",
  rateLimit({ windowMs: 10 * 60_000, max: 15, message: "Too many sign-in attempts. Please try again shortly." }),
  asyncHandler(async (req, res) => {
    const email = requireEmail(req.body.email);
    const password = requireString(req.body.password, "Password", { min: 1, max: 200 });
    const user = db.query("SELECT * FROM users WHERE email = ?").get(email);
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) throw new HttpError(401, "Email or password is incorrect.");

    const restaurant = db.query("SELECT * FROM restaurants WHERE id = ?").get(user.restaurant_id);
    res.json({
      token: signToken(user),
      user: publicUser(user),
      restaurant: restaurant ? publicRestaurant(restaurant) : null,
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const restaurant = db.query("SELECT * FROM restaurants WHERE id = ?").get(req.user.restaurant_id);
    res.json({
      user: publicUser(req.user),
      restaurant: restaurant ? publicRestaurant(restaurant) : null,
    });
  })
);

export default router;
