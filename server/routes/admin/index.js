import { Router } from "express";
import { requireAuth, requireRole } from "../../lib/auth.js";
import dashboardRoutes from "./dashboard.js";
import menuRoutes from "./menu.js";
import tableRoutes from "./tables.js";
import orderRoutes from "./orders.js";
import paymentRoutes from "./payments.js";
import reportRoutes from "./reports.js";
import settingsRoutes from "./settings.js";
import uploadRoutes from "./uploads.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.use("/dashboard", dashboardRoutes);
router.use("/menu", menuRoutes);
router.use("/tables", tableRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/reports", reportRoutes);
router.use("/settings", settingsRoutes);
router.use("/uploads", uploadRoutes);

export default router;
