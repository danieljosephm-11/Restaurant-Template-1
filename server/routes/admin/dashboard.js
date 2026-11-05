import { Router } from "express";
import { db } from "../../db.js";
import { asyncHandler, round2 } from "../../lib/util.js";

const router = Router();
const ACTIVE = ["placed", "accepted", "preparing", "ready"];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const weekStart = new Date(todayStart.getTime() - 6 * DAY_MS);

    const ordersToday = db
      .query("SELECT * FROM orders WHERE restaurant_id = ? AND created_at >= ?")
      .all(restaurantId, todayStart.toISOString());
    const ordersYesterday = db
      .query("SELECT * FROM orders WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?")
      .all(restaurantId, yesterdayStart.toISOString(), todayStart.toISOString());
    const paidToday = db
      .query("SELECT * FROM payments WHERE restaurant_id = ? AND status = 'paid' AND paid_at >= ?")
      .all(restaurantId, todayStart.toISOString());
    const paidYesterday = db
      .query(
        "SELECT * FROM payments WHERE restaurant_id = ? AND status = 'paid' AND paid_at >= ? AND paid_at < ?"
      )
      .all(restaurantId, yesterdayStart.toISOString(), todayStart.toISOString());

    const revenueToday = round2(paidToday.reduce((sum, payment) => sum + payment.amount, 0));
    const revenueYesterday = round2(paidYesterday.reduce((sum, payment) => sum + payment.amount, 0));
    const activeOrders = db
      .query(
        `SELECT o.*, t.table_number, t.table_name,
          (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o JOIN tables t ON t.id = o.table_id
         WHERE o.restaurant_id = ? AND o.status IN ('placed','accepted','preparing','ready')
         ORDER BY o.created_at ASC`
      )
      .all(restaurantId);

    const tables = db
      .query(
        `SELECT t.*,
          (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status IN ('placed','accepted','preparing','ready')) AS active_orders
         FROM tables t WHERE t.restaurant_id = ? ORDER BY t.table_number`
      )
      .all(restaurantId);

    const weekPaid = db
      .query("SELECT amount, paid_at FROM payments WHERE restaurant_id = ? AND status = 'paid' AND paid_at >= ?")
      .all(restaurantId, weekStart.toISOString());
    const weekOrders = db
      .query("SELECT created_at FROM orders WHERE restaurant_id = ? AND created_at >= ? AND status <> 'cancelled'")
      .all(restaurantId, weekStart.toISOString());

    const series = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * DAY_MS);
      series.push({
        date: dayKey(d),
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        revenue: 0,
        orders: 0,
      });
    }
    for (const payment of weekPaid) {
      const entry = series.find((point) => point.date === dayKey(payment.paid_at));
      if (entry) entry.revenue = round2(entry.revenue + payment.amount);
    }
    for (const order of weekOrders) {
      const entry = series.find((point) => point.date === dayKey(order.created_at));
      if (entry) entry.orders += 1;
    }

    const topItems = db
      .query(
        `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue, MAX(oi.is_veg) AS is_veg
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.restaurant_id = ? AND o.created_at >= ? AND o.status <> 'cancelled'
         GROUP BY oi.name ORDER BY qty DESC LIMIT 5`
      )
      .all(restaurantId, weekStart.toISOString())
      .map((item) => ({
        name: item.name,
        qty: item.qty,
        revenue: round2(item.revenue),
        isVeg: !!item.is_veg,
      }));

    const recentOrders = db
      .query(
        `SELECT o.*, t.table_number, t.table_name,
          (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o JOIN tables t ON t.id = o.table_id
         WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 8`
      )
      .all(restaurantId)
      .map((order) => ({
        id: order.id,
        orderCode: order.order_code,
        status: order.status,
        paymentStatus: order.payment_status,
        total: order.total,
        createdAt: order.created_at,
        itemCount: order.item_count,
        tableName: order.table_name,
        tableNumber: order.table_number,
      }));

    const paymentSplit = db
      .query(
        `SELECT method, COUNT(*) AS count, SUM(amount) AS total
         FROM payments WHERE restaurant_id = ? AND status = 'paid' AND paid_at >= ?
         GROUP BY method ORDER BY total DESC`
      )
      .all(restaurantId, todayStart.toISOString())
      .map((row) => ({ method: row.method, count: row.count, total: round2(row.total) }));

    const activity = db
      .query("SELECT id, action, detail, created_at FROM audit_log WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 8")
      .all(restaurantId);

    const activeTables = tables.filter((table) => table.active_orders > 0 || table.status === "occupied").length;
    const pendingPayments = db
      .query(
        `SELECT COUNT(*) AS count FROM orders
         WHERE restaurant_id = ? AND status <> 'cancelled' AND payment_status IN ('unpaid','pending')`
      )
      .get(restaurantId).count;

    res.json({
      today: {
        revenue: revenueToday,
        yesterdayRevenue: revenueYesterday,
        revenueChangePercent:
          revenueYesterday > 0 ? round2(((revenueToday - revenueYesterday) / revenueYesterday) * 100) : null,
        orders: ordersToday.length,
        yesterdayOrders: ordersYesterday.length,
        paidOrders: paidToday.length,
        averageOrder: paidToday.length ? round2(revenueToday / paidToday.length) : 0,
        activeOrders: activeOrders.length,
        pendingPayments,
        activeTables,
        totalTables: tables.length,
      },
      series,
      topItems,
      recentOrders,
      liveOrders: activeOrders.slice(0, 7).map((order) => ({
        id: order.id,
        orderCode: order.order_code,
        tableName: order.table_name,
        status: order.status,
        total: order.total,
        itemCount: order.item_count,
        createdAt: order.created_at,
      })),
      tables: tables.map((table) => ({
        id: table.id,
        number: table.table_number,
        name: table.table_name,
        status: table.active_orders > 0 ? "occupied" : table.status,
        activeOrders: table.active_orders,
      })),
      paymentSplit,
      activity,
    });
  })
);

export default router;
