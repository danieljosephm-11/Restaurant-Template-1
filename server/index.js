import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { db, UPLOAD_DIR } from "./db.js";
import { ensureSeed } from "./seed.js";
import { initRealtime } from "./lib/realtime.js";
import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin/index.js";
import kitchenRoutes from "./routes/kitchen.js";
import webhookRoutes from "./routes/webhooks.js";

ensureSeed();

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const distDir = join(import.meta.dirname, "..", "dist");

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// Razorpay signs the raw request body, so this must run before the JSON parser.
app.use("/api/webhooks", webhookRoutes);
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "SmartDine", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/kitchen", kitchenRoutes);

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", immutable: true }));

if (existsSync(join(distDir, "index.html"))) {
  app.use(express.static(distDir, { maxAge: "1h", index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
    res.sendFile(join(distDir, "index.html"));
  });
}

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "That request is too large. Images must be under 3 MB." });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error("[smartdine] request failed:", err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong on our side. Please try again." : err.message });
});

const server = createServer(app);
initRealtime(server);

server.listen(PORT, () => {
  console.log(`
  SmartDine API running on http://localhost:${PORT}
  ${existsSync(join(distDir, "index.html")) ? "Serving the built app from /dist" : "Run `npm run dev` for the React dev server on :5173"}
  `);
});

function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
