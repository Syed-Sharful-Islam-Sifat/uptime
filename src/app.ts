import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { env } from "./config/env";
import requestLogger from "./middleware/requestLogger";
import router from "./routes";
const logger = pino({ name: "Server start" });
const app = express();

//Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());

//requestLogging
app.use(requestLogger.addRequestId);
app.use(requestLogger.captureResponseBody);
app.use(requestLogger.httpLogger);

app.use("/api/v1", router);
export { app, logger };
