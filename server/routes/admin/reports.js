import { Router } from "express";
import { db } from "../../db.js";
import { asyncHandler, HttpError, round2 } from "../../lib/util.js";

const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `Choose a valid ${label} date.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new HttpError(400, `Choose a valid ${label} date.`);
  }
  return date;
}

function dateKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRange(query) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultFrom = new Date(today.getTime() - 6 * DAY_MS);
  const from = query.from ? parseDateOnly(query.from, "start") : defaultFrom;
  const to = query.to ? parseDateOnly(query.to, "end") : today;
  if (from > to) throw new HttpError(400, "The start date must be before the end date.");
  if (to.getTime() - from.getTime() > 366 * DAY_MS) throw new HttpError(400, "Please choose a range of one year or less.");
  const toExclusive = new Date(to.getTime() + DAY_MS);
  const days = [];
  for (let time = from.getTime(); time < toExclusive.getTime(); time += DAY_MS) {
    days.push(new Date(time));
  }
  return {
    from,
    to,
    fromIso: from.toISOString(),
    toIso: toExclusive.toISOString(),
    fromDate: dateKey(from),
    toDate: dateKey(to),
    days,
  };
}

function buildReport(restaurantId, range) {
  const orders = db
    .query("SELECT * FROM orders WHERE restaurant_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at ASC")
    .all(restaurantId, range.fromIso, range.toIso);
  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const payments = db
    .query(
      "SELECT * FROM payments WHERE restaurant_id = ? AND status = 'paid' AND paid_at >= ? AND paid_at < ?"
    )
    .all(restaurantId, range.fromIso, range.toIso);
  const revenue = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const paidOrderIds = new Set(payments.map((payment) => payment.order_id));
  const tax = round2(validOrders.reduce((sum, order) => sum + order.tax, 0));
  const pending = round2(
    validOrders
      .filter((order) => ["unpaid", "pending"].includes(order.payment_status))
      .reduce((sum, order) => sum + order.total, 0)
  );

  const byDay = range.days.map((day) => ({
    date: dateKey(day),
    label: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    revenue: 0,
    orders: 0,
  }));
  for (const payment of payments) {
    const entry = byDay.find((day) => day.date === dateKey(payment.paid_at));
    if (entry) entry.revenue = round2(entry.revenue + payment.amount);
  }
  for (const order of validOrders) {
    const entry = byDay.find((day) => day.date === dateKey(order.created_at));
    if (entry) entry.orders += 1;
  }

  const methodMap = new Map();
  for (const payment of payments) {
    const entry = methodMap.get(payment.method) || { method: payment.method, count: 0, total: 0 };
    entry.count += 1;
    entry.total = round2(entry.total + payment.amount);
    methodMap.set(payment.method, entry);
  }
  const byMethod = [...methodMap.values()].sort((a, b) => b.total - a.total);

  const topItems = db
    .query(
      `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue, MAX(oi.is_veg) AS is_veg
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.restaurant_id = ? AND o.created_at >= ? AND o.created_at < ? AND o.status <> 'cancelled'
       GROUP BY oi.name ORDER BY qty DESC LIMIT 10`
    )
    .all(restaurantId, range.fromIso, range.toIso)
    .map((item) => ({ name: item.name, qty: item.qty, revenue: round2(item.revenue), isVeg: !!item.is_veg }));

  const byCategory = db
    .query(
      `SELECT c.name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN foods f ON f.id = oi.food_id
       JOIN categories c ON c.id = f.category_id
       WHERE o.restaurant_id = ? AND o.created_at >= ? AND o.created_at < ? AND o.status <> 'cancelled'
       GROUP BY c.name ORDER BY revenue DESC`
    )
    .all(restaurantId, range.fromIso, range.toIso)
    .map((row) => ({ name: row.name, qty: row.qty, revenue: round2(row.revenue) }));

  const statusSplit = {};
  for (const status of ["placed", "accepted", "preparing", "ready", "served", "cancelled"]) {
    statusSplit[status] = orders.filter((order) => order.status === status).length;
  }

  return {
    range: { from: range.fromDate, to: range.toDate, days: range.days.length },
    summary: {
      revenue,
      orders: validOrders.length,
      paidOrders: paidOrderIds.size,
      cancelledOrders: orders.length - validOrders.length,
      averageOrder: paidOrderIds.size ? round2(revenue / paidOrderIds.size) : 0,
      tax,
      pending,
    },
    byDay,
    byMethod,
    byCategory,
    topItems,
    statusSplit,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = getRange(req.query);
    res.json(buildReport(req.user.restaurant_id, range));
  })
);

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const range = getRange(req.query);
    const orders = db
      .query(
        `SELECT o.order_code, o.created_at, t.table_name, o.status, o.payment_status, o.subtotal, o.tax,
                o.service_charge, o.total, o.notes,
                (SELECT group_concat(oi.quantity || ' x ' || oi.name, '; ')
                 FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o JOIN tables t ON t.id = o.table_id
         WHERE o.restaurant_id = ? AND o.created_at >= ? AND o.created_at < ?
         ORDER BY o.created_at ASC`
      )
      .all(restaurantId, range.fromIso, range.toIso);

    const header = [
      "Order",
      "Date",
      "Table",
      "Order status",
      "Payment status",
      "Items",
      "Subtotal",
      "GST",
      "Service charge",
      "Total",
      "Notes",
    ];
    const lines = [header.join(",")];
    for (const order of orders) {
      lines.push(
        [
          order.order_code,
          new Date(order.created_at).toLocaleString("en-IN"),
          order.table_name,
          order.status,
          order.payment_status,
          order.items,
          order.subtotal,
          order.tax,
          order.service_charge,
          order.total,
          order.notes,
        ]
          .map(csvCell)
          .join(",")
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="smartdine-orders-${range.fromDate}-to-${range.toDate}.csv"`
    );
    res.send(`\uFEFF${lines.join("\r\n")}`);
  })
);

export default router;
