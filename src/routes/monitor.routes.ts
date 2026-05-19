import { Router } from "express";
import MonitorController from "../controller/monitor.controller";
import { authenticate } from "../middleware/auth.middleware";
import { apiMiddleWare } from "../middleware/apiMiddleWare";
import { validate } from "../middleware/validate";
import { createMonitorSchema } from "../schemas/monitor.schema";

const router = Router();

router.post("/", authenticate, validate(createMonitorSchema), apiMiddleWare(MonitorController.create));
router.get("/", authenticate, apiMiddleWare(MonitorController.getAll));
router.get("/:id", authenticate, apiMiddleWare(MonitorController.getById));
router.delete("/:id", authenticate, apiMiddleWare(MonitorController.delete));

export default router;
