import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Sentry } from "../config/sentry";
import HttpError from "../lib/helper/HttpError";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const apiMiddleWare = (handler: AsyncHandler): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req, res, next);
      const statusCode = res.statusCode >= 200 ? res.statusCode : 200;
      res.status(statusCode).json({
        type: "RESULT",
        message: "OK",
        result: result ?? {},
        error: null,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({
          type: "ERROR",
          message: error.message,
          result: null,
          error: null,
        });
      } else {
        // Unexpected error — capture for monitoring, return generic message to avoid leaking internals
        Sentry.captureException(error);
        res.status(500).json({
          type: "ERROR",
          message: "Something went wrong",
          result: null,
          error: null,
        });
      }
    }
  };
};
