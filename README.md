# SmartDine

**Double-QR restaurant ordering and payments — one code to order, one to settle the bill.**

SmartDine is a full-stack restaurant operating system built around two dynamic QR codes per table. Guests scan the first code to browse a live menu and send orders straight to the kitchen. The second code opens an order-aware bill, creates a short-lived payment session, and settles the exact amount on the server — never a static "pay ₹X" QR.

The project ships with a polished guest experience, an admin back office, a real-time kitchen display, seeded demo data, and a safe simulated payment mode, so it runs end to end on a laptop with no external services.

---

## Why two QR codes?

| QR | Route | Purpose |
| --- | --- | --- |
| **01 · Menu** | `/t/:tableToken` | Per-table digital menu, cart, order placement, live order tracking |
| **02 · Payment** | `/pay/:tableToken` | Per-table bill. Lists open orders and creates a payment session for one order |

The payment QR is **not** a static payment link. Every checkout creates a server-side payment session that:

- is tied to a single order and its server-calculated total,
- expires after **15 minutes**,
- is capped so one order can only ever be collected once,
- emits live updates to the guest page, admin dashboard, and kitchen display.

---

## Features

### Guest experience

- Per-table menu with categories, search, veg/non-veg marks, and dish photography
- Sticky cart drawer with quantity controls, notes, and live GST/total calculation
- Order placement with a human-readable order code (`ORD-1149`)
- Live order timeline (new → accepted → preparing → ready → served) over Socket.IO with polling fallback
- Table bill page showing every order from the last 12 hours
- Order-linked payment page: dynamic UPI QR, UPI deep link, countdown, and demo confirmation
- Printable / save-as-PDF tax invoice with paid stamp and payment reference
- Fully responsive layout, mobile cart bar, and accessible focus states

### Admin back office

- Email/password sign-in with JWT sessions and role-based access (`admin`, `kitchen`, `staff`)
- Service overview: revenue, orders, active tables, live activity
- Menu manager: categories, dishes, prices, availability, veg flags, image uploads
- Tables & QR: create tables, rotate tokens, preview and print double-QR table cards
- Order stream: filter by status/payment, open full tickets, advance or cancel orders
- Payments ledger: status, method, transaction IDs, retry/expiry handling
- Reports: revenue by day, top dishes, payment mix, category performance, status split, CSV export
- Settings: restaurant identity, tax and service charge, UPI VPA, currency
- Dedicated kitchen display with four live columns, sound alert, and fullscreen mode

### Platform

- Zero-setup SQLite database (Node's built-in `node:sqlite`, or `bun:sqlite` on Bun)
- Auto-seeds a realistic demo restaurant on first boot
- Server-side price calculation, Zod-free validation helpers, rate limiting, audit log
- Razorpay checkout + signed webhook support (optional)
- No Tailwind or UI framework — handcrafted CSS design system
- Self-hosted fonts and food photography, so the demo works offline

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite 6, React Router 6, lucide-react |
| Styling | Hand-written CSS (`styles.css`, `admin.css`, `responsive.css`, `print.css`) |
| Backend | Node.js 22.13+, Express 4 |
| Database | SQLite via `node:sqlite` (Bun: `bun:sqlite`) |
| Realtime | Socket.IO (rooms for restaurant, order, and payment session) |
| Auth | JWT + bcrypt |
| Payments | Demo UPI simulation or Razorpay Orders + signed webhooks |
| QR | `qrcode` (server-rendered PNGs) |

---

## Quick start

**Requirements:** Node.js **22.13 or newer** (Node 24 recommended). No database server, Docker, or API keys needed.

```bash
git clone https://github.com/danieljosephm-11/Restaurant-Template-1.git
cd Restaurant-Template-1

npm install
npm run dev
```

Open **http://localhost:5173**.

The first API boot creates `server/data/smartdine.db` and seeds the demo restaurant automatically.

### Production-style run

```bash
npm run build
npm start
```

Express serves the built SPA and API from **http://localhost:4000**.

### Configuration

Copy `.env.example` to `.env` when you need to override defaults.

```ini
PORT=4000
APP_URL=http://localhost:5173
JWT_SECRET=change-me-to-a-long-random-string
PAYMENT_MODE=demo
```

> On a hosted platform, set `APP_URL` to the public origin (for example `https://your-service.onrender.com`). QR codes embed this value, so a wrong URL produces QR codes that point at localhost. On Render, `RENDER_EXTERNAL_URL` is used automatically when `APP_URL` is unset.

### Demo access

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@smartdine.app` | `Admin@123` |
| Kitchen | `kitchen@smartdine.app` | `Kitchen@123` |

Demo table 1 menu: `/t/fpmnYlOGtMfDPKlM`  
Demo table 1 bill: `/pay/fpmnYlOGtMfDPKlM`

The landing page's **Start the demo** button resolves the current demo table from `/api/public/demo`, so seeded tokens are never hard-coded into the UI.

---

## Payment modes

### Demo mode (default)

`PAYMENT_MODE=demo` shows a real UPI intent QR and a clearly labelled **Simulate successful payment** action. The QR uses the restaurant's configured VPA (the seed value `spiceroute@upi` is fictional). No money moves, and the UI states this explicitly.

Demo confirmation is refused when the server is in Razorpay mode.

### Razorpay mode

```ini
PAYMENT_MODE=razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
APP_URL=https://your-domain.example
```

- Checkout is created server-side with the server-calculated amount.
- The webhook endpoint is `POST /api/webhooks/razorpay`.
- Signatures are verified against the **raw** request body before parsing.
- Amounts are compared against the stored payment before an order is marked paid.
- Webhook events are idempotent: replaying a capture does not double-credit an order.

Use Razorpay test keys and a tunnel (for example Cloudflare Tunnel or ngrok) while developing webhooks locally.

---

## Security notes

- Prices, tax, and totals are always calculated on the server; client totals are display-only.
- Payment sessions are random 24-byte tokens; only a SHA-256 hash is stored in the database.
- Session tokens expire after 15 minutes and are scoped to one order.
- Completing a payment retires every other pending session for that order.
- Admin and kitchen routes require a valid JWT and the correct role.
- Passwords are hashed with bcrypt; login responses do not reveal whether an email exists.
- Rate limits protect public order, payment, QR, and login endpoints.
- Responses set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive permissions policy.
- `.env`, SQLite data, uploaded files, and logs are gitignored.

For production, also: use HTTPS, rotate `JWT_SECRET`, set a restricted CORS/`APP_URL`, move uploads to object storage, back up the database, and complete a PCI/UPI compliance review with your payment provider.

---

## Deployment

### Render (recommended for this demo)

The repository includes `render.yaml`. On Render, create a **Blueprint** from the repo, or create a Web Service manually with:

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Health check:** `/api/health`
- **Node version:** `24` (or any 22.13+)

Set `JWT_SECRET` to a long random value. Leave `PAYMENT_MODE=demo` for a public demo.

> **SQLite persistence:** Render's free plan has an ephemeral filesystem. The database is recreated and reseeded whenever the service restarts or redeploys. For durable orders, attach a persistent disk (paid plans) mounted at `/opt/render/project/src/server/data`, or run on Railway/Fly.io with a volume mounted at the same path.

### Railway / Fly.io

Both platforms support Node and persistent volumes:

- Build: `npm ci && npm run build`
- Start: `npm start`
- Mount a volume at `server/data` (relative to the app root) for SQLite and uploads
- Set `APP_URL` to the public URL

### Static frontend only

`npm run build` produces `dist/`. The app expects an API and WebSocket server, so deploy the Node server alongside it rather than hosting `dist/` alone.

---

## Project structure

```text
.
├── client/
│   ├── public/                 # fonts, favicon, seeded food photography
│   ├── src/
│   │   ├── components/         # shared UI, logo, layouts, badges
│   │   ├── context/            # auth and toast providers
│   │   ├── hooks/              # query/title/interval hooks
│   │   ├── lib/                # API client, format helpers, socket client
│   │   ├── pages/              # guest pages, kitchen display, admin pages
│   │   ├── admin.css           # admin shell and back-office styles
│   │   ├── print.css           # invoice and report print rules
│   │   ├── responsive.css      # breakpoint rules
│   │   └── styles.css          # design tokens, guest pages, kitchen board
│   └── vite.config.js
├── server/
│   ├── lib/                    # auth, orders, payments, realtime, helpers
│   ├── routes/                 # public, auth, kitchen, admin, webhooks
│   ├── data/                   # SQLite database + uploads (gitignored)
│   ├── db.js                   # schema and SQLite adapter
│   ├── index.js                # Express + Socket.IO entry
│   └── seed.js                 # demo restaurant seed/reset
├── .env.example
├── render.yaml
└── package.json
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API with watch mode + Vite dev server |
| `npm run dev:api` | API only (port 4000) |
| `npm run dev:web` | Vite only (port 5173) |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve API + built SPA from one Node process |
| `npm run seed` | Seed an empty database |
| `npm run reset` | Delete the demo database and reseed |

Reset demo data at any time with `npm run reset` (stops and recreates the database).

---

## API overview

| Area | Examples |
| --- | --- |
| Public | `GET /api/public/demo`, `GET /api/public/tables/:token/menu`, `POST /api/public/tables/:token/orders`, `GET /api/public/orders/:token`, `GET /api/public/bill/:token` |
| Payments | `POST /api/public/orders/:token/payment-session`, `GET /api/public/payments/:sessionToken`, `GET /api/public/payments/:sessionToken/qr.png`, `POST /api/public/payments/:sessionToken/confirm` (demo only) |
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Admin | `/api/admin/dashboard`, `/api/admin/menu`, `/api/admin/tables`, `/api/admin/orders`, `/api/admin/payments`, `/api/admin/reports`, `/api/admin/settings` |
| Kitchen | `GET /api/kitchen/tickets`, `PATCH /api/kitchen/orders/:id/status` |
| Webhook | `POST /api/webhooks/razorpay` |

---

## Credits

- Food photography is sourced from **Wikimedia Commons** under free licences and used here as demo imagery. If you publish this project, replace the images with your own or add per-image author/licence attribution from their Commons file pages.
- Typography: **Fraunces** and **Inter** (SIL Open Font License), self-hosted in `client/public/fonts`.
- Icons: **lucide-react** (ISC licence).

## Disclaimer

SmartDine is a demonstration product. The seeded restaurant, UPI VPA, GSTIN, staff accounts, and payments are fictional. Demo mode does not move real money. Review security, tax, and payment-compliance requirements before using it in a real restaurant.
