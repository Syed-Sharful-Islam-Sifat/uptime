import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Sentry } from "../config/sentry";
import { env } from "../config/env";
import HttpError from "../lib/helper/HttpError";
import { sendAdminOtpEmail } from "../lib/email/resend";
import { AdminRepository } from "../repositories/admin.repository";
import { AdminOtpRepository } from "../repositories/admin-otp.repository";

const OTP_EXPIRY_MS = 60 * 1000; // 1 minute

const generateOtp = (): string =>
  crypto.randomInt(1000, 10000).toString();

const generateAdminJwt = (email: string): string =>
  jwt.sign({ email, is_admin: true }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

export const AdminAuthService = {
  requestOtp: async (email: string) => {
    const admin = await AdminRepository.findByEmail(email);

    // Always return the same message — don't reveal whether the email is registered
    if (!admin) {
      return { message: "If that email is registered as an admin, a code has been sent." };
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await AdminOtpRepository.upsert(email, code, expiresAt);

    sendAdminOtpEmail(email, code).catch((err) => {
      Sentry.captureException(err);
      console.error("Failed to send admin OTP email:", err);
    });

    return { message: "If that email is registered as an admin, a code has been sent." };
  },

  verifyOtp: async (email: string, code: string) => {
    const record = await AdminOtpRepository.findByEmail(email);

    // Use a generic message to avoid leaking whether the email exists
    if (!record || record.code !== code) {
      throw new HttpError({ statusCode: 401, message: "Invalid or expired code." });
    }

    if (new Date() > record.expires_at) {
      await AdminOtpRepository.deleteByEmail(email);
      throw new HttpError({ statusCode: 401, message: "Invalid or expired code." });
    }

    // Single-use — delete immediately after successful verification
    await AdminOtpRepository.deleteByEmail(email);

    const token = generateAdminJwt(email);
    return { token };
  },
};
