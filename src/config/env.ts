import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("production"),
  HOST: z.string().min(1).default("localhost"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.url().default("http://localhost:8080"),
  COMMON_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string().default("uptime-monitor"),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_BOT_USERNAME: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SENTRY_DSN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("onboarding@resend.dev"),
  APP_URL: z.url().default("http://localhost:8080"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.issues);
  throw new Error("Invalid environment variables");
}

export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === "development",
  isProduction: parsedEnv.data.NODE_ENV === "production",
};
