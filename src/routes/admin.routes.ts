import { Router } from "express";
import AdminAuthController from "../controller/admin-auth.controller";
import AdminController from "../controller/admin.controller";
import { authenticateAdmin } from "../middleware/admin.middleware";
import { apiMiddleWare } from "../middleware/apiMiddleWare";
import { validate } from "../middleware/validate";
import { requestOtpSchema, verifyOtpSchema } from "../schemas/admin-auth.schema";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

// Public — OTP request and verification (rate-limited)
router.post("/auth/request-otp", authLimiter, validate(requestOtpSchema), apiMiddleWare(AdminAuthController.requestOtp));
router.post("/auth/verify-otp", authLimiter, validate(verifyOtpSchema), apiMiddleWare(AdminAuthController.verifyOtp));

// Protected — requires valid admin JWT
router.get("/payment-requests", authenticateAdmin, apiMiddleWare(AdminController.listPendingRequests));
router.post("/payment-requests/:requestId/approve", authenticateAdmin, apiMiddleWare(AdminController.approvePayment));
router.post("/payment-requests/:requestId/reject", authenticateAdmin, apiMiddleWare(AdminController.rejectPayment));

export default router;
