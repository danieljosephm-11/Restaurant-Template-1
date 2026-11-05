import { Router } from "express";
import QRCode from "qrcode";
import { db, tx } from "../db.js";
import {
  asyncHandler,
  HttpError,
  hashToken,
  logAudit,
  newId,
  nowIso,
  publicRestaurant,
  randomToken,
  rateLimit,
  round2,
  requireNumber,
} from "../lib/util.js";
import {
  getOrderById,
  getOrderByToken,
  getOrderItems,
  serializeOrder,
} from "../lib/orders.js";
import {
  buildUpiUri,
  createRazorpayOrder,
  menuUrl,
  payUrl,
  paymentMode,
  razorpayKeyId,
} from "../lib/payments.js";
import {
  createOrderCode,
  createPaymentCode,
  expirePaymentIfStale,
  markPaymentPaid,
} from "../lib/payment-service.js";
import { emit, emitToRestaurant } from "../lib/realtime.js";

const router = Router();

function getTableByToken(token) {
  const table = db
    .query(
      `SELECT t.*,
              r.id AS restaurant_id, r.name AS restaurant_name, r.tagline AS restaurant_tagline,
              r.logo AS restaurant_logo, r.address AS restaurant_address, r.phone AS restaurant_phone,
              r.email AS restaurant_email, r.gstin AS restaurant_gstin, r.tax_percent,
              r.service_charge_percent, r.currency, r.upi_vpa, r.upi_name
       FROM tables t JOIN restaurants r ON r.id = t.restaurant_id
       WHERE t.token = ?`
    )
    .get(token);
  if (!table) throw new HttpError(404, "This QR code is not linked to a table. Please ask our staff for help.");
  return table;
}

function restaurantFromTable(table) {
  return {
    name: table.restaurant_name,
    tagline: table.restaurant_tagline,
    logo: table.restaurant_logo,
    address: table.restaurant_address,
    phone: table.restaurant_phone,
    email: table.restaurant_email,
    gstin: table.restaurant_gstin,
    taxPercent: table.tax_percent,
    serviceChargePercent: table.service_charge_percent,
    currency: table.currency,
    upiName: table.upi_name,
  };
}

// ── Menu ────────────────────────────────────────────────────────────────────
router.get(
  "/menu/:token",
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(async (req, res) => {
    const table = getTableByToken(req.params.token);
    if (table.status === "inactive") throw new HttpError(403, "This table is not currently in service.");

    const categories = db
      .query(
        "SELECT id, name, sort_order FROM categories WHERE restaurant_id = ? AND active = 1 ORDER BY sort_order, name"
      )
      .all(table.restaurant_id);
    const foods = db
      .query(
        `SELECT f.id, f.category_id, f.name, f.description, f.price, f.image, f.is_veg, f.available, f.sort_order
         FROM foods f JOIN categories c ON c.id = f.category_id
         WHERE f.restaurant_id = ? AND c.active = 1
         ORDER BY f.sort_order, f.name`
      )
      .all(table.restaurant_id);

    const menu = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: foods
          .filter((food) => food.category_id === category.id)
          .map((food) => ({
            id: food.id,
            name: food.name,
            description: food.description,
            price: food.price,
            image: food.image,
            isVeg: !!food.is_veg,
            available: !!food.available,
          })),
      }))
      .filter((category) => category.items.length > 0);

    const activeOrder = db
      .query(
        `SELECT public_token, order_code, status, payment_status, total, created_at
         FROM orders WHERE table_id = ? AND status IN ('placed','accepted','preparing','ready')
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(table.id);

    res.json({
      restaurant: restaurantFromTable(table),
      table: { number: table.table_number, name: table.table_name },
      categories: menu,
      activeOrder: activeOrder
        ? {
            publicToken: activeOrder.public_token,
            orderCode: activeOrder.order_code,
            status: activeOrder.status,
            paymentStatus: activeOrder.payment_status,
            total: activeOrder.total,
            createdAt: activeOrder.created_at,
          }
        : null,
    });
  })
);

// ── Place an order ──────────────────────────────────────────────────────────
router.post(
  "/orders",
  rateLimit({ windowMs: 60_000, max: 15, message: "Too many order attempts. Please wait a moment." }),
  asyncHandler(async (req, res) => {
    const table = getTableByToken(req.body.tableToken);
    if (table.status === "inactive") throw new HttpError(403, "This table is not currently in service.");

    const rawItems = req.body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new HttpError(400, "Your cart is empty. Add something delicious first.");
    }
    if (rawItems.length > 40) throw new HttpError(400, "That is too many items for one order.");

    const quantities = new Map();
    for (const raw of rawItems) {
      const foodId = typeof raw?.foodId === "string" ? raw.foodId : "";
      const quantity = Math.round(requireNumber(raw?.quantity ?? 1, "Quantity", { min: 1, max: 20, integer: true }));
      if (!foodId) throw new HttpError(400, "One of the cart items is invalid.");
      const next = (quantities.get(foodId) || 0) + quantity;
      if (next > 20) throw new HttpError(400, "Maximum quantity per dish is 20.");
      quantities.set(foodId, next);
    }

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(",");
    const foodRows = db
      .query(
        `SELECT f.* FROM foods f JOIN categories c ON c.id = f.category_id
         WHERE f.id IN (${placeholders}) AND f.restaurant_id = ? AND c.active = 1`
      )
      .all(...ids, table.restaurant_id);

    if (foodRows.length !== ids.length) {
      throw new HttpError(409, "A dish in your cart is no longer on the menu. Please refresh and try again.");
    }
    const unavailable = foodRows.find((food) => !food.available);
    if (unavailable) {
      throw new HttpError(409, `${unavailable.name} is sold out right now. Please remove it from your cart.`);
    }

    const items = foodRows.map((food) => {
      const quantity = quantities.get(food.id);
      return {
        food,
        quantity,
        lineTotal: round2(food.price * quantity),
      };
    });

    const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const tax = round2((subtotal * table.tax_percent) / 100);
    const serviceCharge = round2((subtotal * table.service_charge_percent) / 100);
    const total = round2(subtotal + tax + serviceCharge);
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim().slice(0, 300) : null;
    const publicToken = randomToken(18);
    const now = nowIso();
    let orderCode;

    tx(() => {
      orderCode = createOrderCode(table.restaurant_id);
      const orderId = newId("ord");
      db.query(
        `INSERT INTO orders
          (id, restaurant_id, order_code, table_id, public_token, status, payment_status, subtotal, tax,
           service_charge, total, notes, created_at, updated_at)
         VALUES (?,?,?,?,?,'placed','unpaid',?,?,?,?,?,?,?)`
      ).run(
        orderId,
        table.restaurant_id,
        orderCode,
        table.id,
        publicToken,
        subtotal,
        tax,
        serviceCharge,
        total,
        notes,
        now,
        now
      );
      for (const item of items) {
        db.query(
          `INSERT INTO order_items (id, order_id, food_id, name, price, quantity, line_total, is_veg)
           VALUES (?,?,?,?,?,?,?,?)`
        ).run(
          newId("oit"),
          orderId,
          item.food.id,
          item.food.name,
          item.food.price,
          item.quantity,
          item.lineTotal,
          item.food.is_veg
        );
      }
      db.query("UPDATE tables SET status = 'occupied' WHERE id = ? AND status = 'available'").run(table.id);
      logAudit(
        table.restaurant_id,
        null,
        "order.created",
        `${orderCode} · ${table.table_name} · ${items.length} items · ${total}`
      );
    });

    emitToRestaurant(table.restaurant_id, "order:created", {
      orderId: publicToken,
      orderCode,
      tableName: table.table_name,
      total,
      itemCount: items.length,
      status: "placed",
    });
    emitToRestaurant(table.restaurant_id, "order:updated", {
      orderCode,
      status: "placed",
      paymentStatus: "unpaid",
    });
    emit(`order:${publicToken}`, "order:updated", { status: "placed", paymentStatus: "unpaid" });

    res.status(201).json({
      publicToken,
      orderCode,
      total,
      tableToken: table.token,
    });
  })
);

// ── Customer order status ───────────────────────────────────────────────────
router.get(
  "/orders/:token",
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(async (req, res) => {
    const order = getOrderByToken(req.params.token);
    res.json(serializeOrder(order));
  })
);

// ── Table bill (from the payment QR) ───────────────────────────────────────
router.get(
  "/tables/:token/bill",
  rateLimit({ windowMs: 60_000, max: 60 }),
  asyncHandler(async (req, res) => {
    const table = getTableByToken(req.params.token);
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const orders = db
      .query(
        `SELECT o.public_token, o.order_code, o.status, o.payment_status, o.total, o.created_at,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o
         WHERE o.table_id = ? AND o.created_at >= ? AND o.status <> 'cancelled'
         ORDER BY o.created_at DESC LIMIT 25`
      )
      .all(table.id, since)
      .map((order) => ({
        publicToken: order.public_token,
        orderCode: order.order_code,
        status: order.status,
        paymentStatus: order.payment_status,
        total: order.total,
        itemCount: order.item_count,
        createdAt: order.created_at,
      }));

    const outstanding = round2(
      orders
        .filter((order) => !["paid", "refunded"].includes(order.paymentStatus))
        .reduce((sum, order) => sum + order.total, 0)
    );

    res.json({
      restaurant: restaurantFromTable(table),
      table: { number: table.table_number, name: table.table_name },
      orders,
      outstanding,
      totalOrders: orders.length,
      windowHours: 12,
    });
  })
);

// ── Create an order-specific payment session ────────────────────────────────
router.post(
  "/orders/:token/payment-session",
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(async (req, res) => {
    const order = getOrderByToken(req.params.token);
    if (order.status === "cancelled") throw new HttpError(409, "This order was cancelled, so there is nothing to pay.");
    if (["paid", "refunded"].includes(order.payment_status)) {
      throw new HttpError(409, "This order has already been paid.");
    }
    const alreadyPaid = db
      .query("SELECT id FROM payments WHERE order_id = ? AND status = 'paid'")
      .get(order.id);
    if (alreadyPaid) throw new HttpError(409, "This order has already been paid.");

    const mode = paymentMode();
    if (mode === "demo" && !order.upi_vpa) {
      throw new HttpError(409, "Online payment is not set up for this restaurant. Please pay at the counter.");
    }

    const sessionToken = randomToken(24);
    const sessionHash = hashToken(sessionToken);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    let providerOrder = null;

    if (mode === "razorpay") {
      providerOrder = await createRazorpayOrder({
        amount: order.total,
        orderCode: order.order_code,
        paymentCode: "PENDING",
        restaurantName: order.restaurant_name,
      });
    }

    let paymentCode;
    tx(() => {
      db.query("UPDATE payments SET status = 'expired' WHERE order_id = ? AND status = 'pending'").run(order.id);
      paymentCode = createPaymentCode(order.restaurant_id);
      db.query(
        `INSERT INTO payments
          (id, restaurant_id, payment_code, order_id, amount, method, status, provider,
           provider_order_id, session_hash, expires_at, created_at)
         VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?)`
      ).run(
        newId("pay"),
        order.restaurant_id,
        paymentCode,
        order.id,
        order.total,
        "UPI",
        mode,
        providerOrder?.providerOrderId || null,
        sessionHash,
        expiresAt,
        createdAt
      );
      db.query("UPDATE orders SET payment_status = 'pending', updated_at = ? WHERE id = ?").run(
        nowIso(),
        order.id
      );
      logAudit(
        order.restaurant_id,
        null,
        "payment.session_created",
        `${paymentCode} · ${order.order_code} · ${order.total}`
      );
    });

    emitToRestaurant(order.restaurant_id, "order:updated", {
      orderCode: order.order_code,
      status: order.status,
      paymentStatus: "pending",
    });
    emit(`order:${order.public_token}`, "order:updated", {
      status: order.status,
      paymentStatus: "pending",
    });

    res.status(201).json({
      sessionToken,
      expiresAt,
      mode,
      amount: order.total,
      orderCode: order.order_code,
      razorpay: providerOrder
        ? { keyId: providerOrder.keyId, orderId: providerOrder.providerOrderId, amount: order.total }
        : null,
    });
  })
);

function getPaymentBySession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== "string") throw new HttpError(404, "Payment session not found.");
  const payment = db.query("SELECT * FROM payments WHERE session_hash = ?").get(hashToken(sessionToken));
  if (!payment) throw new HttpError(404, "This payment link is invalid or has expired.");
  return payment;
}

function paymentPayload(paymentRow, sessionToken) {
  const order = getOrderById(paymentRow.order_id);
  const items = getOrderItems(order.id);
  const mode = paymentMode();
  const upiUri = buildUpiUri({
    vpa: order.upi_vpa,
    name: order.upi_name || order.restaurant_name,
    amount: paymentRow.amount,
    orderCode: order.order_code,
    note: `${order.restaurant_name} ${order.table_name}`,
  });

  return {
    sessionToken,
    paymentCode: paymentRow.payment_code,
    status: paymentRow.status,
    amount: paymentRow.amount,
    method: paymentRow.method,
    provider: paymentRow.provider,
    transactionId: paymentRow.transaction_id,
    paidAt: paymentRow.paid_at,
    expiresAt: paymentRow.expires_at,
    createdAt: paymentRow.created_at,
    canConfirm: paymentRow.status === "pending" && mode === "demo",
    mode,
    upiUri,
    qrUrl: `/api/public/payments/${sessionToken}/qr.png`,
    razorpay:
      paymentRow.provider === "razorpay" && paymentRow.provider_order_id
        ? {
            keyId: razorpayKeyId(),
            orderId: paymentRow.provider_order_id,
            amount: paymentRow.amount,
            name: order.restaurant_name,
            description: order.order_code,
          }
        : null,
    order: {
      ...serializeOrder(order, { items, payment: paymentRow }),
      // The payment status shown on this page must reflect this session, not a
      // different historical attempt.
      paymentStatus: paymentRow.status === "paid" ? "paid" : order.payment_status,
      payment: {
        paymentCode: paymentRow.payment_code,
        status: paymentRow.status,
        method: paymentRow.method,
        amount: paymentRow.amount,
        transactionId: paymentRow.transaction_id,
        paidAt: paymentRow.paid_at,
      },
    },
    restaurant: publicRestaurant({
      name: order.restaurant_name,
      tagline: order.restaurant_tagline,
      logo: order.restaurant_logo,
      address: order.restaurant_address,
      phone: order.restaurant_phone,
      email: null,
      gstin: order.restaurant_gstin,
      tax_percent: order.tax_percent,
      service_charge_percent: order.service_charge_percent,
      currency: order.currency,
      upi_name: order.upi_name,
    }),
  };
}

// ── Payment session details / status ───────────────────────────────────────
router.get(
  "/payments/:sessionToken",
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(async (req, res) => {
    let payment = getPaymentBySession(req.params.sessionToken);
    payment = expirePaymentIfStale(payment);
    res.json(paymentPayload(payment, req.params.sessionToken));
  })
);

router.get(
  "/payments/:sessionToken/qr.png",
  rateLimit({ windowMs: 60_000, max: 60 }),
  asyncHandler(async (req, res) => {
    const payment = getPaymentBySession(req.params.sessionToken);
    const order = db.query("SELECT * FROM orders WHERE id = ?").get(payment.order_id);
    const restaurant = db.query("SELECT * FROM restaurants WHERE id = ?").get(payment.restaurant_id);
    const uri = buildUpiUri({
      vpa: restaurant.upi_vpa,
      name: restaurant.upi_name || restaurant.name,
      amount: payment.amount,
      orderCode: order.order_code,
      note: `${restaurant.name} ${order.order_code}`,
    });
    if (!uri) throw new HttpError(404, "UPI payment is not configured yet.");
    const buffer = await QRCode.toBuffer(uri, {
      type: "png",
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#171512", light: "#ffffff" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  })
);

// ── Demo confirmation (disabled in live gateway mode) ──────────────────────
router.post(
  "/payments/:sessionToken/confirm",
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    if (paymentMode() !== "demo") {
      throw new HttpError(403, "Demo confirmation is disabled. Complete the payment with your UPI app.");
    }
    let payment = getPaymentBySession(req.params.sessionToken);
    payment = expirePaymentIfStale(payment);
    if (payment.status === "paid") {
      return res.json({ status: "paid", alreadyPaid: true, transactionId: payment.transaction_id });
    }
    if (payment.status !== "pending") {
      throw new HttpError(409, "This payment session has expired. Please start a new payment.");
    }
    const result = markPaymentPaid(payment.id, {
      method: "UPI",
      transactionId: `DEMO-${payment.payment_code}-${Math.floor(Math.random() * 900000 + 100000)}`,
      source: "demo",
    });
    res.json({
      status: "paid",
      transactionId: result.payment.transaction_id,
      paidAt: result.payment.paid_at,
    });
  })
);

// ── Table QR images ─────────────────────────────────────────────────────────
router.get(
  "/qr/:token/:type.png",
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(async (req, res) => {
    const table = getTableByToken(req.params.token);
    const type = req.params.type;
    if (!["menu", "payment"].includes(type)) throw new HttpError(404, "QR code not found.");
    const url = type === "menu" ? menuUrl(table.token) : payUrl(table.token);
    const buffer = await QRCode.toBuffer(url, {
      type: "png",
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#171512", light: "#ffffff" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  })
);

// ── Demo entry point used by the landing page ──────────────────────────────
router.get(
  "/demo",
  asyncHandler(async (_req, res) => {
    const restaurant = db.query("SELECT * FROM restaurants LIMIT 1").get();
    if (!restaurant) throw new HttpError(404, "No restaurant has been set up yet.");
    const table = db
      .query("SELECT * FROM tables WHERE restaurant_id = ? AND status <> 'inactive' ORDER BY table_number LIMIT 1")
      .get(restaurant.id);
    res.json({
      restaurant: publicRestaurant(restaurant),
      table: table ? { number: table.table_number, name: table.table_name, token: table.token } : null,
      paymentMode: paymentMode(),
    });
  })
);

// ── Invoice / digital bill ─────────────────────────────────────────────────
router.get(
  "/bill/:token",
  rateLimit({ windowMs: 60_000, max: 60 }),
  asyncHandler(async (req, res) => {
    const order = getOrderByToken(req.params.token);
    const payload = serializeOrder(order, { items: getOrderItems(order.id) });
    res.json({
      ...payload,
      invoiceNumber: `INV-${order.order_code.replace("ORD-", "")}`,
      generatedAt: nowIso(),
      payment: payload.payment,
    });
  })
);

export default router;
