import { Router } from "express";
import monitorRoutes from "./monitor.routes";
import pingRoutes from "./ping.routes"
const router = Router();

router.use("/monitors", monitorRoutes);
router.use("/pings",pingRoutes)

export default router;
