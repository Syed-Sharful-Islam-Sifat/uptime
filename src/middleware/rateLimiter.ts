import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const errorResponse = (message: string) => ({
  type: "ERROR",
  message,
  result: null,
  error: null,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDevelopment ? 10_000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse("Too many requests, please try again later"),
});

// Stricter limit for auth endpoints to slow brute-force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDevelopment ? 1_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse("Too many authentication attempts, please try again later"),
});
