import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { db, tx } from "./db.js";
import { newId, nowIso, randomToken, round2 } from "./lib/util.js";
import { menuUrl, payUrl } from "./lib/payments.js";

const RESTAURANT_ID = "rst_spiceroute";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@smartdine.app";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
const KITCHEN_EMAIL = process.env.SEED_KITCHEN_EMAIL || "kitchen@smartdine.app";
const KITCHEN_PASSWORD = process.env.SEED_KITCHEN_PASSWORD || "Kitchen@123";

const categories = [
  ["cat_starters", "Starters", 1],
  ["cat_mains", "Main Course", 2],
  ["cat_biryani", "Biryani", 3],
  ["cat_breads", "Breads", 4],
  ["cat_desserts", "Desserts", 5],
  ["cat_beverages", "Beverages", 6],
];

const foods = [
  ["food_paneer_tikka", "cat_starters", "Paneer Tikka", 280, 1, "paneer-tikka.jpg", "Charred cottage cheese, mint chutney and pickled onion.", 1],
  ["food_chicken_65", "cat_starters", "Chicken 65", 320, 0, "chicken-65.jpg", "Crisp fried chicken, curry leaf and a yoghurt chilli drizzle.", 2],
  ["food_spring_rolls", "cat_starters", "Vegetable Spring Rolls", 220, 1, "spring-rolls.jpg", "Crisp rolls with glass noodles, served with sweet chilli dip.", 3],
  ["food_tandoori_chicken", "cat_starters", "Tandoori Chicken", 380, 0, "tandoori-chicken.jpg", "Half chicken, overnight marinade, smoked in the tandoor.", 4],
  ["food_butter_chicken", "cat_mains", "Butter Chicken", 380, 0, "butter-chicken.jpg", "Tomato-cashew gravy, cultured butter and a swirl of cream.", 1],
  ["food_dal_makhani", "cat_mains", "Dal Makhani", 260, 1, "dal-makhani.jpg", "Black lentils slow-cooked overnight with smoked butter.", 2],
  ["food_paneer_butter", "cat_mains", "Paneer Butter Masala", 320, 1, "paneer-butter-masala.jpg", "Cottage cheese in a silky tomato and fenugreek gravy.", 3],
  ["food_masala_dosa", "cat_mains", "Masala Dosa", 190, 1, "masala-dosa.jpg", "Crisp rice crepe, spiced potato, coconut chutney and sambar.", 4],
  ["food_chicken_biryani", "cat_biryani", "Chicken Biryani", 340, 0, "chicken-biryani.jpg", "Dum-cooked long grain rice, saffron, tender chicken and raita.", 1],
  ["food_veg_biryani", "cat_biryani", "Vegetable Biryani", 280, 1, "veg-biryani.jpg", "Seasonal vegetables, whole spices and crisp fried onion.", 2],
  ["food_garlic_naan", "cat_breads", "Garlic Naan", 70, 1, "garlic-naan.jpg", "Tandoor-baked naan finished with garlic butter and coriander.", 1],
  ["food_tandoori_roti", "cat_breads", "Tandoori Roti", 45, 1, "tandoori-roti.jpg", "Whole wheat roti baked in the charcoal tandoor.", 2],
  ["food_gulab_jamun", "cat_desserts", "Gulab Jamun", 120, 1, "gulab-jamun.jpg", "Warm dumplings in saffron syrup, finished with pistachio.", 1],
  ["food_brownie", "cat_desserts", "Chocolate Brownie", 180, 1, "brownie.jpg", "Dark chocolate brownie, sea salt and vanilla bean ice cream.", 2],
  ["food_rasmalai", "cat_desserts", "Rasmalai", 150, 1, "rasmalai.jpg", "Soft cheese discs in saffron milk with cardamom and rose.", 3],
  ["food_lime_soda", "cat_beverages", "Fresh Lime Soda", 90, 1, "lime-soda.jpg", "Fresh lime and soda with black salt. Sweet or salted.", 1],
  ["food_masala_chai", "cat_beverages", "Masala Chai", 60, 1, "masala-chai.jpg", "Assam tea simmered with ginger, cardamom and milk.", 2],
  ["food_mango_lassi", "cat_beverages", "Mango Lassi", 120, 1, "mango-lassi.jpg", "Alphonso mango, hung curd and a dusting of pistachio.", 3],
  ["food_filter_coffee", "cat_beverages", "Filter Coffee", 70, 1, "filter-coffee.jpg", "South Indian filter decoction with frothed milk.", 4],
];

const tableTokens = {};
for (let n = 1; n <= 8; n++) {
  tableTokens[n] = createHash("sha256")
    .update(`smartdine-demo-table-${n}-v1`)
    .digest("base64url")
    .slice(0, 16);
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function atHour(base, hour, minute = 0) {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function seedNow() {
  const now = new Date();
  const nowIsoStr = now.toISOString();
  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const kitchenHash = bcrypt.hashSync(KITCHEN_PASSWORD, 10);

  tx(() => {
    db.query(
      `INSERT INTO restaurants
        (id, name, tagline, logo, address, phone, email, gstin, tax_percent, service_charge_percent,
         upi_vpa, upi_name, currency, order_seq, payment_seq, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      RESTAURANT_ID,
      "Spice Route",
      "Modern Indian kitchen · Indiranagar",
      null,
      "14, 3rd Cross, Indiranagar, Bengaluru 560038",
      "+91 80 4123 8890",
      "hello@spiceroute.in",
      "29ABCDE1234F1Z5",
      5,
      0,
      "spiceroute@upi",
      "Spice Route",
      "INR",
      1000,
      1000,
      nowIsoStr
    );

    db.query(
      "INSERT INTO users (id, restaurant_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(newId("usr"), RESTAURANT_ID, "Aarav Mehta", ADMIN_EMAIL, adminHash, "admin", nowIsoStr);

    db.query(
      "INSERT INTO users (id, restaurant_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(newId("usr"), RESTAURANT_ID, "Kitchen Team", KITCHEN_EMAIL, kitchenHash, "kitchen", nowIsoStr);

    for (const [id, name, sort] of categories) {
      db.query(
        "INSERT INTO categories (id, restaurant_id, name, sort_order, active, created_at) VALUES (?,?,?,?,1,?)"
      ).run(id, RESTAURANT_ID, name, sort, nowIsoStr);
    }

    for (const [id, catId, name, price, isVeg, image, description, sort] of foods) {
      db.query(
        `INSERT INTO foods
          (id, restaurant_id, category_id, name, description, price, image, is_veg, available, sort_order, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,1,?,?,?)`
      ).run(
        id,
        RESTAURANT_ID,
        catId,
        name,
        description,
        price,
        `/foods/${image}`,
        isVeg,
        sort,
        nowIsoStr,
        nowIsoStr
      );
    }

    const tableIds = {};
    for (let n = 1; n <= 8; n++) {
      const id = `tbl_spiceroute_${String(n).padStart(2, "0")}`;
      tableIds[n] = id;
      db.query(
        "INSERT INTO tables (id, restaurant_id, table_number, table_name, token, status, created_at) VALUES (?,?,?,?,?,'available',?)"
      ).run(id, RESTAURANT_ID, n, `Table ${String(n).padStart(2, "0")}`, tableTokens[n], nowIsoStr);
    }

    const rng = mulberry32(20261105);
    const menu = foods.map((f) => ({
      id: f[0],
      name: f[2],
      price: f[3],
      isVeg: f[4],
      category: f[1],
    }));

    let orderSeq = 1000;
    let paymentSeq = 1000;

    const insertOrder = ({ tableNumber, status, paymentStatus, createdAt, items, notes, paidMethod, paid }) => {
      orderSeq += 1;
      const orderId = `ord_${String(orderSeq)}`;
      const orderCode = `ORD-${orderSeq}`;
      const publicToken = randomToken(18);
      const subtotal = round2(items.reduce((sum, it) => sum + it.price * it.quantity, 0));
      if (!Number.isFinite(subtotal)) {
        console.error("Bad seed items", items);
        throw new Error("Seed item price is not a number");
      }
      const tax = round2((subtotal * 5) / 100);
      const service = 0;
      const total = round2(subtotal + tax + service);
      const createdIso = createdAt.toISOString();
      const updatedIso = new Date(createdAt.getTime() + 1000 * 60 * 8).toISOString();
      const servedAt = ["served"].includes(status) ? updatedIso : null;

      db.query(
        `INSERT INTO orders
          (id, restaurant_id, order_code, table_id, public_token, status, payment_status, subtotal, tax,
           service_charge, total, notes, created_at, updated_at, served_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        orderId,
        RESTAURANT_ID,
        orderCode,
        tableIds[tableNumber],
        publicToken,
        status,
        paymentStatus,
        subtotal,
        tax,
        service,
        total,
        notes || null,
        createdIso,
        updatedIso,
        servedAt
      );

      for (const it of items) {
        db.query(
          `INSERT INTO order_items (id, order_id, food_id, name, price, quantity, line_total, is_veg)
           VALUES (?,?,?,?,?,?,?,?)`
        ).run(newId("oit"), orderId, it.id, it.name, it.price, it.quantity, round2(it.price * it.quantity), it.isVeg);
      }

      if (paid) {
        paymentSeq += 1;
        const paidAt = new Date(createdAt.getTime() + 1000 * 60 * (8 + Math.floor(rng() * 25))).toISOString();
        const paymentCode = `PAY-${paymentSeq}`;
        const method = paidMethod || "UPI";
        db.query(
          `INSERT INTO payments
            (id, restaurant_id, payment_code, order_id, amount, method, status, provider,
             provider_order_id, provider_payment_id, transaction_id, session_hash, expires_at, created_at, paid_at)
           VALUES (?,?,?,?,?,?,'paid','demo',NULL,NULL,?,NULL,NULL,?,?)`
        ).run(
          newId("pay"),
          RESTAURANT_ID,
          paymentCode,
          orderId,
          total,
          method,
          `TXN${String(paymentSeq).slice(-6)}${Math.floor(rng() * 9000 + 1000)}`,
          createdIso,
          paidAt
        );
      }

      if (["placed", "accepted", "preparing", "ready"].includes(status)) {
        db.query("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableIds[tableNumber]);
      }

      return { orderId, orderCode, publicToken, total };
    };

    const commonItems = ["food_chicken_biryani", "food_butter_chicken", "food_paneer_tikka", "food_garlic_naan"];
    const drinkItems = ["food_lime_soda", "food_masala_chai", "food_mango_lassi", "food_filter_coffee"];
    const dessertItems = ["food_gulab_jamun", "food_brownie", "food_rasmalai"];

    function randomItems() {
      const pool = [...menu];
      const chosen = [];
      const count = 2 + Math.floor(rng() * 3);
      const source = rng() > 0.35 ? [...commonItems, ...drinkItems] : pool.map((m) => m.id);
      const used = new Set();
      while (chosen.length < count) {
        const id = pick(rng, source);
        if (used.has(id)) continue;
        used.add(id);
        const food = menu.find((m) => m.id === id);
        if (!food) continue;
        chosen.push({ ...food, quantity: rng() > 0.65 ? 2 : 1 });
      }
      if (rng() > 0.62) {
        const dessertId = pick(rng, dessertItems);
        const dessert = menu.find((m) => m.id === dessertId);
        if (dessert) chosen.push({ ...dessert, quantity: 1 });
      }
      return chosen;
    }

    // 14 days of trading history, 8–12 covers a day.
    for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
      const base = new Date(now);
      base.setDate(base.getDate() - daysAgo);
      const count = 8 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) {
        const created = atHour(base, 11 + Math.floor(rng() * 10), Math.floor(rng() * 60));
        const isCancelled = rng() < 0.025;
        const isPaid = !isCancelled && rng() < 0.94;
        insertOrder({
          tableNumber: 1 + Math.floor(rng() * 8),
          status: isCancelled ? "cancelled" : "served",
          paymentStatus: isCancelled ? "unpaid" : isPaid ? "paid" : "unpaid",
          createdAt: created,
          items: randomItems(),
          notes: rng() > 0.85 ? pick(rng, ["Less spicy, please.", "No onion in the biryani.", "Birthday — please bring a candle.", "Pack one dessert to go."]) : null,
          paid: isPaid,
          paidMethod: pick(rng, ["UPI", "UPI", "UPI", "CARD", "CASH"]),
        });
      }
    }

    // Today: a busy lunch and dinner service.
    const todayOrders = 16;
    for (let i = 0; i < todayOrders; i++) {
      const hour = 11 + Math.floor((i / todayOrders) * 9.4);
      const minute = Math.floor(rng() * 60);
      const created = atHour(now, Math.min(hour, now.getHours()), minute);
      if (created > now) created.setTime(now.getTime() - 1000 * 60 * (10 + i * 3));
      const isPaid = rng() < 0.72;
      insertOrder({
        tableNumber: 1 + Math.floor(rng() * 8),
        status: "served",
        paymentStatus: isPaid ? "paid" : "unpaid",
        createdAt: created,
        items: randomItems(),
        notes: null,
        paid: isPaid,
        paidMethod: pick(rng, ["UPI", "UPI", "CARD", "CASH"]),
      });
    }

    // Live tickets for the kitchen display.
    const live = [
      {
        tableNumber: 3,
        status: "placed",
        minutesAgo: 2,
        items: [
          { ...menu.find((m) => m.id === "food_chicken_biryani"), quantity: 2 },
          { ...menu.find((m) => m.id === "food_paneer_tikka"), quantity: 1 },
          { ...menu.find((m) => m.id === "food_lime_soda"), quantity: 2 },
        ],
        notes: "One biryani mild, please.",
      },
      {
        tableNumber: 6,
        status: "preparing",
        minutesAgo: 11,
        items: [
          { ...menu.find((m) => m.id === "food_butter_chicken"), quantity: 1 },
          { ...menu.find((m) => m.id === "food_garlic_naan"), quantity: 3 },
          { ...menu.find((m) => m.id === "food_dal_makhani"), quantity: 1 },
        ],
      },
      {
        tableNumber: 2,
        status: "ready",
        minutesAgo: 18,
        items: [
          { ...menu.find((m) => m.id === "food_veg_biryani"), quantity: 1 },
          { ...menu.find((m) => m.id === "food_rasmalai"), quantity: 2 },
          { ...menu.find((m) => m.id === "food_masala_chai"), quantity: 2 },
        ],
      },
    ];

    let liveIndex = 0;
    for (const ticket of live) {
      const created = new Date(now.getTime() - ticket.minutesAgo * 60_000);
      const result = insertOrder({
        tableNumber: ticket.tableNumber,
        status: ticket.status,
        paymentStatus: liveIndex === 0 ? "unpaid" : liveIndex === 1 ? "pending" : "paid",
        createdAt: created,
        items: ticket.items,
        notes: ticket.notes || null,
        paid: liveIndex === 2,
        paidMethod: "UPI",
      });
      if (liveIndex === 1) {
        const order = db.query("SELECT * FROM orders WHERE id = ?").get(result.orderId);
        paymentSeq += 1;
        db.query(
          `INSERT INTO payments
            (id, restaurant_id, payment_code, order_id, amount, method, status, provider,
             provider_order_id, provider_payment_id, transaction_id, session_hash, expires_at, created_at, paid_at)
           VALUES (?,?,?,?,?,?,'pending','demo',NULL,NULL,NULL,?,?,?,NULL)`
        ).run(
          newId("pay"),
          RESTAURANT_ID,
          `PAY-${paymentSeq}`,
          order.id,
          order.total,
          "UPI",
          `seed_pending_${order.id}`,
          new Date(now.getTime() + 15 * 60_000).toISOString(),
          created.toISOString()
        );
      }
      liveIndex += 1;
    }

    db.query("UPDATE restaurants SET order_seq = ?, payment_seq = ? WHERE id = ?").run(
      orderSeq,
      paymentSeq,
      RESTAURANT_ID
    );

    db.query(
      "INSERT INTO audit_log (id, restaurant_id, actor_id, action, detail, created_at) VALUES (?,?,?,?,?,?)"
    ).run(newId("aud"), RESTAURANT_ID, null, "seed.created", "Demo restaurant seeded", nowIsoStr);
  });
}

export function isSeeded() {
  const row = db.query("SELECT COUNT(*) AS count FROM restaurants").get();
  return row.count > 0;
}

export function ensureSeed() {
  if (!isSeeded()) {
    console.log("[smartdine] Empty database — seeding demo restaurant…");
    seedNow();
  }
}

export function resetSeed() {
  tx(() => {
    db.query("DELETE FROM audit_log").run();
    db.query("DELETE FROM payments").run();
    db.query("DELETE FROM order_items").run();
    db.query("DELETE FROM orders").run();
    db.query("DELETE FROM foods").run();
    db.query("DELETE FROM categories").run();
    db.query("DELETE FROM tables").run();
    db.query("DELETE FROM users").run();
    db.query("DELETE FROM restaurants").run();
  });
  seedNow();
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  if (process.argv.includes("--reset")) {
    console.log("[smartdine] Resetting demo data…");
    resetSeed();
  } else {
    ensureSeed();
  }
  const table = db
    .query("SELECT table_name, token FROM tables WHERE restaurant_id = ? ORDER BY table_number LIMIT 1")
    .get(RESTAURANT_ID);
  console.log(`
  SmartDine demo data is ready.

  Admin sign-in    ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}
  Kitchen sign-in  ${KITCHEN_EMAIL}  /  ${KITCHEN_PASSWORD}

  Demo menu QR     ${menuUrl(table.token)}
  Demo payment QR  ${payUrl(table.token)}

  8 tables · 19 dishes · ~120 orders of history
`);
}
