import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { Sentry } from "./config/sentry";
import { env } from "./config/env";
import HttpError from "./lib/helper/HttpError";
import requestLogger from "./middleware/requestLogger";
import { generalLimiter } from "./middleware/rateLimiter";
import router from "./routes";

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());

app.use(requestLogger.addRequestId);
app.use(requestLogger.captureResponseBody);
app.use(requestLogger.httpLogger);

app.use(generalLimiter);

app.use("/api/v1", router);

// Global error handler — catches errors forwarded via next(err) from middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      type: "ERROR",
      message: err.message,
      result: null,
      error: null,
    });
    return;
  }

  Sentry.captureException(err);
  res.status(500).json({
    type: "ERROR",
    message: "Something went wrong",
    result: null,
    error: null,
  });
});
