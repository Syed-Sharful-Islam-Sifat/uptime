import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Sentry } from "../config/sentry";
import { env } from "../config/env";
import HttpError from "../lib/helper/HttpError";
import { sendVerificationEmail } from "../lib/email/resend";
import { EmailVerificationTokenRepository } from "../repositories/email-verification-token.repository";
import { UserRepository } from "../repositories/user.repository";
import type { LoginDTO, RegisterDTO } from "../schemas/auth.schema";

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Dummy hash used during "user not found" path to keep response time consistent
// and prevent timing-based user enumeration attacks.
const DUMMY_HASH = "$2b$12$dummyhashfortimingnormalizat1";

const generateJwt = (id: number, email: string): string =>
  jwt.sign({ id, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

const generateVerificationToken = (): string =>
  crypto.randomBytes(32).toString("hex"); // 64 hex chars, cryptographically random

export const AuthService = {
  register: async (data: RegisterDTO) => {
    const { email, first_name, last_name, password } = data;

    const existing = await UserRepository.findByEmailWithPassword(email);
    if (existing) {
      throw new HttpError({ statusCode: 409, message: "Email already in use" });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await UserRepository.create({ email, first_name, last_name, password_hash });

    // Generate and store verification token, then send email.
    // Email sending is fire-and-forget — a delivery failure does not block registration.
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await EmailVerificationTokenRepository.create(user.id, token, expiresAt);

    sendVerificationEmail(email, token).catch((err) => {
      Sentry.captureException(err);
      console.error("Failed to send verification email:", err);
    });

    return {
      user,
      message: "Account created. Please check your email to verify your account before logging in.",
    };
  },

  login: async (data: LoginDTO) => {
    const { email, password } = data;

    const user = await UserRepository.findByEmailWithPassword(email);

    // Always run bcrypt regardless of whether the user exists to normalize response
    // time and prevent timing-based email enumeration attacks.
    const hashToCompare = user?.password_hash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValid) {
      throw new HttpError({ statusCode: 401, message: "Invalid email or password" });
    }

    if (!user.is_email_verified) {
      throw new HttpError({
        statusCode: 403,
        message: "Please verify your email before logging in. Check your inbox or request a new link.",
      });
    }

    const token = generateJwt(user.id, user.email);
    const { password_hash: _removed, ...safeUser } = user;

    return { user: safeUser, token };
  },

  verifyEmail: async (token: string) => {
    const record = await EmailVerificationTokenRepository.findByToken(token);

    if (!record) {
      throw new HttpError({ statusCode: 400, message: "Invalid or expired verification link" });
    }

    if (new Date() > record.expires_at) {
      // Clean up the stale token, then tell the user to request a new one
      await EmailVerificationTokenRepository.deleteByUserId(record.user_id);
      throw new HttpError({
        statusCode: 400,
        message: "Verification link has expired. Please request a new one.",
      });
    }

    // Mark user as verified and delete all their tokens (single-use flow)
    await Promise.all([
      UserRepository.markEmailVerified(record.user_id),
      EmailVerificationTokenRepository.deleteByUserId(record.user_id),
    ]);

    return { message: "Email verified successfully. You can now log in." };
  },

  resendVerification: async (email: string) => {
    const user = await UserRepository.findByEmailWithPassword(email);

    // Return the same generic message whether the email exists or not.
    // Revealing "email not found" would allow attackers to enumerate registered accounts.
    if (!user) {
      return { message: "If that email is registered and unverified, a new link has been sent." };
    }

    if (user.is_email_verified) {
      throw new HttpError({ statusCode: 400, message: "This email is already verified." });
    }

    // Delete any existing tokens and issue a fresh one
    await EmailVerificationTokenRepository.deleteByUserId(user.id);

    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await EmailVerificationTokenRepository.create(user.id, token, expiresAt);

    sendVerificationEmail(email, token).catch((err) => {
      Sentry.captureException(err);
      console.error("Failed to resend verification email:", err);
    });

    return { message: "If that email is registered and unverified, a new link has been sent." };
  },
};
