import { Router } from "express";
import PaymentController from "../controller/payment.controller";
import PlanController from "../controller/plan.controller";
import { authenticate } from "../middleware/auth.middleware";
import { apiMiddleWare } from "../middleware/apiMiddleWare";
import { validate } from "../middleware/validate";
import { paymentRequestSchema } from "../schemas/payment.schema";

const router = Router();

// Public — no auth required, frontend fetches this on load
router.get("/plans", apiMiddleWare(PlanController.getPlans));

router.post(
  "/request",
  authenticate,
  validate(paymentRequestSchema),
  apiMiddleWare(PaymentController.submitRequest),
);

router.get("/status", authenticate, apiMiddleWare(PaymentController.getStatus));

export default router;
