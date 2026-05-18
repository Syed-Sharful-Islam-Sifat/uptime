import { Router } from "express";
import PingController from "../controller/ping.controller";
import { authenticate } from "../middleware/auth.middleware";
import { apiMiddleWare } from "../middleware/apiMiddleWare";

const router = Router({ mergeParams: true });

router.get("/", authenticate, apiMiddleWare(PingController.getByMonitorId));

export default router;
