import { initSentry } from "./config/sentry";

// Sentry must be initialised before anything else to capture startup errors
initSentry();

import { app } from "./app";
import { connectDB } from "./config/database";
import { env } from "./config/env";
import { startPingJob } from "./jobs/ping.job";
import requestLogger from "./middleware/requestLogger";

const logger = requestLogger.logger;

const server = app.listen(env.PORT, () => {
  logger.info(`Server ${env.NODE_ENV} running on port ${env.PORT}`);
});

const start = async () => {
  try {
    await connectDB();
    startPingJob();
  } catch {
    logger.error("Failed to connect to database");
    process.exit(1);
  }
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
