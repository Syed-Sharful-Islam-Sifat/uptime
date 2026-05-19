import { initSentry } from "./config/sentry";

// Sentry must be initialised before anything else to capture startup errors
initSentry();

import { app } from "./app";
import { connectDB } from "./config/database";
import { env } from "./config/env";
import { startPingJob } from "./jobs/ping.job";
import { registerTelegramWebhook } from "./lib/telegram/telegraam";
import requestLogger from "./middleware/requestLogger";

const logger = requestLogger.logger;

const server = app.listen(env.PORT, () => {
  logger.info(`Server ${env.NODE_ENV} running on port ${env.PORT}`);
});

const start = async () => {
  try {
    await connectDB();
    startPingJob();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  registerTelegramWebhook(`${env.APP_URL}/api/v1/telegram/webhook`).catch((err) => {
    logger.warn(`Telegram webhook registration failed: ${err instanceof Error ? err.message : String(err)}`);
  });
};

start();

const onCloseSignal = () => {
  logger.info("sigint received, shutting down");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
