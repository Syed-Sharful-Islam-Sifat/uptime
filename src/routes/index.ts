import { Router } from "express";
import monitorRoutes from "./monitor.routes";

const router = Router();

router.use("/monitors", monitorRoutes);

export default router;
