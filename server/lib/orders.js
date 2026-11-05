import { db } from "../db.js";
import { HttpError } from "./util.js";

export const ORDER_JOIN = `
  SELECT o.*,
         t.table_number, t.table_name, t.token AS table_token,
         r.name AS restaurant_name, r.tagline AS restaurant_tagline, r.logo AS restaurant_logo,
         r.address AS restaurant_address, r.phone AS restaurant_phone, r.gstin AS restaurant_gstin,
         r.tax_percent, r.service_charge_percent, r.currency, r.upi_vpa, r.upi_name
  FROM orders o
  JOIN tables t ON t.id = o.table_id
  JOIN restaurants r ON r.id = o.restaurant_id
`;

export function getOrderByToken(token) {
  if (!token || typeof token !== "string") throw new HttpError(404, "Order not found.");
  const row = db.query(`${ORDER_JOIN} WHERE o.public_token = ?`).get(token);
  if (!row) throw new HttpError(404, "Order not found. Please scan the QR code again.");
  return row;
}

export function getOrderById(id) {
  const row = db.query(`${ORDER_JOIN} WHERE o.id = ?`).get(id);
  if (!row) throw new HttpError(404, "Order not found.");
  return row;
}

export function getOrderItems(orderId) {
  return db
    .query(
      `SELECT id, food_id, name, price, quantity, line_total, is_veg
       FROM order_items WHERE order_id = ? ORDER BY rowid ASC`
    )
    .all(orderId)
    .map((item) => ({
      id: item.id,
      foodId: item.food_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.line_total,
      isVeg: !!item.is_veg,
    }));
}

export function getLatestPayment(orderId) {
  return db
    .query(
      `SELECT * FROM payments WHERE order_id = ?
       ORDER BY CASE WHEN status = 'paid' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`
    )
    .get(orderId);
}

export function serializeOrder(row, { items, payment } = {}) {
  const orderItems = items ?? getOrderItems(row.id);
  const lastPayment = payment === undefined ? getLatestPayment(row.id) : payment;
  return {
    publicToken: row.public_token,
    orderCode: row.order_code,
    status: row.status,
    paymentStatus: row.payment_status,
    subtotal: row.subtotal,
    tax: row.tax,
    serviceCharge: row.service_charge,
    total: row.total,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    servedAt: row.served_at,
    table: {
      number: row.table_number,
      name: row.table_name,
    },
    restaurant: {
      name: row.restaurant_name,
      tagline: row.restaurant_tagline,
      logo: row.restaurant_logo,
      address: row.restaurant_address,
      phone: row.restaurant_phone,
      gstin: row.restaurant_gstin,
      taxPercent: row.tax_percent,
      serviceChargePercent: row.service_charge_percent,
      currency: row.currency,
      upiName: row.upi_name,
    },
    items: orderItems.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal ?? item.line_total,
      isVeg: item.isVeg ?? item.is_veg,
    })),
    payment: lastPayment
      ? {
          paymentCode: lastPayment.payment_code,
          status: lastPayment.status,
          method: lastPayment.method,
          amount: lastPayment.amount,
          transactionId: lastPayment.transaction_id,
          paidAt: lastPayment.paid_at,
          createdAt: lastPayment.created_at,
        }
      : null,
    canPay:
      row.status !== "cancelled" && !["paid", "refunded"].includes(row.payment_status),
  };
}
