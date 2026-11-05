import { Router } from "express";
import { db } from "../../db.js";
import {
  asyncHandler,
  HttpError,
  logAudit,
  newId,
  nowIso,
  randomToken,
  rateLimit,
  requireNumber,
  requireString,
  toBool,
} from "../../lib/util.js";
import { menuUrl, payUrl } from "../../lib/payments.js";
import { emitToRestaurant } from "../../lib/realtime.js";

const router = Router();
const STATUSES = ["available", "occupied", "reserved", "inactive"];

function serializeTable(table) {
  return {
    id: table.id,
    number: table.table_number,
    name: table.table_name,
    token: table.token,
    status: table.status,
    activeOrders: table.active_orders || 0,
    menuUrl: menuUrl(table.token),
    payUrl: payUrl(table.token),
    qr: {
      menu: `/api/public/qr/${table.token}/menu.png`,
      payment: `/api/public/qr/${table.token}/payment.png`,
    },
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = db
      .query(
        `SELECT t.*,
          (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status IN ('placed','accepted','preparing','ready')) AS active_orders
         FROM tables t WHERE t.restaurant_id = ? ORDER BY t.table_number`
      )
      .all(req.user.restaurant_id);
    res.json({ tables: rows.map(serializeTable) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const number = requireNumber(req.body.number, "Table number", { min: 1, max: 999, integer: true });
    const name = req.body.name
      ? requireString(req.body.name, "Table name", { max: 40 })
      : `Table ${String(number).padStart(2, "0")}`;
    const duplicate = db
      .query("SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ?")
      .get(restaurantId, number);
    if (duplicate) throw new HttpError(409, `Table ${number} already exists.`);

    const id = newId("tbl");
    const token = randomToken(16);
    db.query(
      "INSERT INTO tables (id, restaurant_id, table_number, table_name, token, status, created_at) VALUES (?,?,?,?,?,'available',?)"
    ).run(id, restaurantId, number, name, token, nowIso());
    logAudit(restaurantId, req.user.id, "table.created", name);

    const table = db
      .query(
        `SELECT t.*, 0 AS active_orders FROM tables t WHERE t.id = ?`
      )
      .get(id);
    emitToRestaurant(restaurantId, "table:updated", { tableId: id });
    res.status(201).json({ table: serializeTable(table) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db
      .query("SELECT * FROM tables WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!existing) throw new HttpError(404, "Table not found.");

    const number =
      req.body.number !== undefined
        ? requireNumber(req.body.number, "Table number", { min: 1, max: 999, integer: true })
        : existing.table_number;
    const name = req.body.name !== undefined ? requireString(req.body.name, "Table name", { max: 40 }) : existing.table_name;
    const status = req.body.status !== undefined ? String(req.body.status) : existing.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, "Choose a valid table status.");
    const duplicate = db
      .query("SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ? AND id <> ?")
      .get(restaurantId, number, existing.id);
    if (duplicate) throw new HttpError(409, `Table ${number} already exists.`);

    db.query("UPDATE tables SET table_number = ?, table_name = ?, status = ? WHERE id = ? AND restaurant_id = ?").run(
      number,
      name,
      status,
      existing.id,
      restaurantId
    );
    logAudit(restaurantId, req.user.id, "table.updated", `${name} · ${status}`);
    emitToRestaurant(restaurantId, "table:updated", { tableId: existing.id });

    const table = db
      .query(
        `SELECT t.*,
          (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status IN ('placed','accepted','preparing','ready')) AS active_orders
         FROM tables t WHERE t.id = ?`
      )
      .get(existing.id);
    res.json({ table: serializeTable(table) });
  })
);

router.post(
  "/:id/regenerate",
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db
      .query("SELECT * FROM tables WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!existing) throw new HttpError(404, "Table not found.");
    const token = randomToken(16);
    db.query("UPDATE tables SET token = ? WHERE id = ?").run(token, existing.id);
    logAudit(restaurantId, req.user.id, "table.qr_regenerated", existing.table_name);
    emitToRestaurant(restaurantId, "table:updated", { tableId: existing.id });
    res.json({
      table: serializeTable({
        ...existing,
        token,
        active_orders: 0,
      }),
      warning: "The previous printed QR codes for this table no longer work.",
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db
      .query("SELECT * FROM tables WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!existing) throw new HttpError(404, "Table not found.");
    const active = db
      .query(
        "SELECT COUNT(*) AS count FROM orders WHERE table_id = ? AND status IN ('placed','accepted','preparing','ready')"
      )
      .get(existing.id).count;
    if (active > 0) throw new HttpError(409, "Close the open orders on this table before deleting it.");
    const history = db.query("SELECT COUNT(*) AS count FROM orders WHERE table_id = ?").get(existing.id).count;
    if (history > 0) {
      throw new HttpError(409, "This table has order history. Mark it inactive instead of deleting it.");
    }
    db.query("DELETE FROM tables WHERE id = ? AND restaurant_id = ?").run(existing.id, restaurantId);
    logAudit(restaurantId, req.user.id, "table.deleted", existing.table_name);
    emitToRestaurant(restaurantId, "table:updated", { tableId: existing.id });
    res.json({ ok: true });
  })
);

export default router;
