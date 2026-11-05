import { Router } from "express";
import { db } from "../../db.js";
import {
  asyncHandler,
  HttpError,
  logAudit,
  optionalString,
  requireEmail,
  requireNumber,
  requireString,
} from "../../lib/util.js";
import { appUrl, paymentMode } from "../../lib/payments.js";

const router = Router();

function serializeSettings(restaurant) {
  return {
    name: restaurant.name,
    tagline: restaurant.tagline,
    logo: restaurant.logo,
    address: restaurant.address,
    phone: restaurant.phone,
    email: restaurant.email,
    gstin: restaurant.gstin,
    taxPercent: restaurant.tax_percent,
    serviceChargePercent: restaurant.service_charge_percent,
    upiVpa: restaurant.upi_vpa,
    upiName: restaurant.upi_name,
    currency: restaurant.currency,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const restaurant = db.query("SELECT * FROM restaurants WHERE id = ?").get(req.user.restaurant_id);
    res.json({
      settings: serializeSettings(restaurant),
      environment: {
        appUrl: appUrl(),
        paymentMode: paymentMode(),
      },
    });
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db.query("SELECT * FROM restaurants WHERE id = ?").get(restaurantId);
    if (!existing) throw new HttpError(404, "Restaurant not found.");

    const name = req.body.name !== undefined ? requireString(req.body.name, "Restaurant name", { max: 80 }) : existing.name;
    const tagline =
      req.body.tagline !== undefined ? optionalString(req.body.tagline, 120) : existing.tagline;
    const logo = req.body.logo !== undefined ? optionalString(req.body.logo, 500) : existing.logo;
    const address = req.body.address !== undefined ? optionalString(req.body.address, 300) : existing.address;
    const phone = req.body.phone !== undefined ? optionalString(req.body.phone, 30) : existing.phone;
    let email = existing.email;
    if (req.body.email !== undefined) {
      email = req.body.email ? requireEmail(req.body.email) : null;
    }
    const gstin = req.body.gstin !== undefined ? optionalString(req.body.gstin, 20) : existing.gstin;
    if (gstin && !/^[0-9A-Z]{15}$/i.test(gstin)) {
      throw new HttpError(400, "A GSTIN must be 15 letters and numbers.");
    }
    const taxPercent =
      req.body.taxPercent !== undefined
        ? requireNumber(req.body.taxPercent, "GST", { min: 0, max: 28 })
        : existing.tax_percent;
    const serviceChargePercent =
      req.body.serviceChargePercent !== undefined
        ? requireNumber(req.body.serviceChargePercent, "Service charge", { min: 0, max: 20 })
        : existing.service_charge_percent;
    const upiVpa = req.body.upiVpa !== undefined ? optionalString(req.body.upiVpa, 60) : existing.upi_vpa;
    if (upiVpa && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z][a-zA-Z0-9.\-_]{1,}$/.test(upiVpa)) {
      throw new HttpError(400, "Enter a valid UPI ID, for example restaurant@bank.");
    }
    const upiName =
      req.body.upiName !== undefined ? optionalString(req.body.upiName, 60) : existing.upi_name;

    db.query(
      `UPDATE restaurants SET name = ?, tagline = ?, logo = ?, address = ?, phone = ?, email = ?, gstin = ?,
       tax_percent = ?, service_charge_percent = ?, upi_vpa = ?, upi_name = ? WHERE id = ?`
    ).run(
      name,
      tagline,
      logo,
      address,
      phone,
      email,
      gstin,
      taxPercent,
      serviceChargePercent,
      upiVpa,
      upiName || name,
      restaurantId
    );
    logAudit(restaurantId, req.user.id, "settings.updated", name);
    const updated = db.query("SELECT * FROM restaurants WHERE id = ?").get(restaurantId);
    res.json({
      settings: serializeSettings(updated),
      environment: { appUrl: appUrl(), paymentMode: paymentMode() },
    });
  })
);

export default router;
