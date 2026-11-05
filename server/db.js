import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(import.meta.dirname, "data");
mkdirSync(dataDir, { recursive: true });

export const DB_PATH = join(dataDir, "smartdine.db");
export const UPLOAD_DIR = join(dataDir, "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

// The app runs on Node 22+ using the built-in SQLite driver, or on Bun using
// bun:sqlite. Both expose a tiny, shared query()/exec() surface below.
let database;
if (typeof Bun !== "undefined") {
  const { Database } = await import("bun:sqlite");
  database = new Database(DB_PATH, { create: true });
  database.query = (sql) => database.prepare(sql);
} else {
  const { DatabaseSync } = await import("node:sqlite");
  database = new DatabaseSync(DB_PATH);
  database.query = (sql) => database.prepare(sql);
}

export const db = database;

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS restaurants (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  tagline                TEXT,
  logo                   TEXT,
  address                TEXT,
  phone                  TEXT,
  email                  TEXT,
  gstin                  TEXT,
  tax_percent            REAL NOT NULL DEFAULT 5,
  service_charge_percent REAL NOT NULL DEFAULT 0,
  upi_vpa                TEXT,
  upi_name               TEXT,
  currency               TEXT NOT NULL DEFAULT 'INR',
  order_seq              INTEGER NOT NULL DEFAULT 1000,
  payment_seq            INTEGER NOT NULL DEFAULT 1000,
  created_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','kitchen','staff')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS foods (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  description   TEXT,
  price         REAL NOT NULL,
  image         TEXT,
  is_veg        INTEGER NOT NULL DEFAULT 1,
  available     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tables (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number  INTEGER NOT NULL,
  table_name    TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','inactive')),
  created_at    TEXT NOT NULL,
  UNIQUE (restaurant_id, table_number)
);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  restaurant_id  TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_code     TEXT NOT NULL,
  table_id       TEXT NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  public_token   TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'placed'
                 CHECK (status IN ('placed','accepted','preparing','ready','served','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
                 CHECK (payment_status IN ('unpaid','pending','paid','failed','refunded')),
  subtotal       REAL NOT NULL,
  tax            REAL NOT NULL DEFAULT 0,
  service_charge REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  served_at      TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_id    TEXT REFERENCES foods(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  price      REAL NOT NULL,
  quantity   INTEGER NOT NULL,
  line_total REAL NOT NULL,
  is_veg     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,
  restaurant_id       TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  payment_code        TEXT NOT NULL,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount              REAL NOT NULL,
  method              TEXT NOT NULL DEFAULT 'UPI',
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','failed','expired','refunded')),
  provider            TEXT NOT NULL DEFAULT 'demo',
  provider_order_id   TEXT,
  provider_payment_id TEXT,
  transaction_id      TEXT,
  session_hash        TEXT UNIQUE,
  expires_at          TEXT,
  created_at          TEXT NOT NULL,
  paid_at             TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  actor_id      TEXT,
  action        TEXT NOT NULL,
  detail        TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_foods_restaurant   ON foods(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_foods_category     ON foods(category_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant  ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant  ON orders(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table       ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order     ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON payments(status);
`);

export function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}
