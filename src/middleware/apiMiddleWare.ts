// src/middleware/apiMiddleware.ts

import { Request, Response, NextFunction, RequestHandler } from "express";
import HttpError from "../lib/helper/HttpError";

// ✅ Add NextFunction as optional 3rd param to match Express's handler signature
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction  // ✅ required, not optional
) => Promise<unknown>;
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
          error: error.stack ?? null,
        });
      } else if (error instanceof Error) {
        res.status(500).json({
          type: "ERROR",
          message: error.message,
          result: null,
          error: error.stack ?? null,
        });
      } else {
        res.status(500).json({
          type: "ERROR",
          message: "Internal Server Error",
          result: null,
          error: null,
        });
      }
    }
  };
};