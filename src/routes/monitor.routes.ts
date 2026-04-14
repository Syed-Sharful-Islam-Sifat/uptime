import { Router } from "express";
import MonitorController from "../controller/monitor.controller";
import { apiMiddleWare } from "../middleware/apiMiddleWare";
const router = Router();

router.post("/", apiMiddleWare(MonitorController.create));
router.get("/", MonitorController.getAll);
router.delete("/:id", MonitorController.delete);

export default router;
