import { Router } from "express";
import authRoutes from "./auth.routes";
import monitorRoutes from "./monitor.routes";
import pingRoutes from "./ping.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/monitors", monitorRoutes);
// Nested under monitors so :monitorId is available via mergeParams
router.use("/monitors/:monitorId/pings", pingRoutes);

export default router;
