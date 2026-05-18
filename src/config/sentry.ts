import * as Sentry from "@sentry/node";
import { env } from "./env";

export const initSentry = () => {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.isProduction ? 0.1 : 1.0,
  });
};

export { Sentry };
