import { app, logger } from "./app";
import { connectDB } from "./config/database";
import { env } from "./config/env";

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
  logger.info(`Server ${NODE_ENV} running on port ${PORT}`);
});

const start = async () => {
  try {
    await connectDB();
  } catch (err) {
    logger.error("Failed to connect to database");
    process.exit(1); 
  }
};

start()


const onCloseSignal = () => {
  logger.info("sigint received , shutting down");
  server.close(() => {
    logger.info("Server closed");
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
