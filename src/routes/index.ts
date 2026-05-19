import { Router } from "express";
import authRoutes from "./auth.routes";
import monitorRoutes from "./monitor.routes";
import pingRoutes from "./ping.routes";
import paymentRoutes from "./payment.routes";
import adminRoutes from "./admin.routes";
import telegramRoutes from "./telegram.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/monitors", monitorRoutes);
// Nested under monitors so :monitorId is available via mergeParams
router.use("/monitors/:monitorId/pings", pingRoutes);
router.use("/payment", paymentRoutes);
router.use("/admin", adminRoutes);
router.use("/telegram", telegramRoutes);

export default router;
