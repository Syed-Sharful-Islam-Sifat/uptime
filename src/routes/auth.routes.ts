import { Router } from "express";
import AuthController from "../controller/auth.controller";
import { apiMiddleWare } from "../middleware/apiMiddleWare";
import { authLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { loginSchema, registerSchema, resendVerificationSchema } from "../schemas/auth.schema";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), apiMiddleWare(AuthController.register));
router.post("/login", authLimiter, validate(loginSchema), apiMiddleWare(AuthController.login));

// Token comes from the link in the email — no body, no auth required
router.get("/verify-email", apiMiddleWare(AuthController.verifyEmail));

// Rate-limited to prevent abuse (requesting infinite emails for someone else's address)
router.post(
  "/resend-verification",
  authLimiter,
  validate(resendVerificationSchema),
  apiMiddleWare(AuthController.resendVerification),
);

export default router;
