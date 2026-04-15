import { Router } from "express";
import PingController from "../controller/ping.controller";
import { apiMiddleWare } from "../middleware/apiMiddleWare";

const router = Router({ mergeParams: true }); 

router.get("/", apiMiddleWare(PingController.getByMonitorId));

export default router;
