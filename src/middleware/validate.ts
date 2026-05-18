import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import HttpError from "../lib/helper/HttpError";

export const validate = (schema: z.ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return next(new HttpError({ statusCode: 400, message: first?.message ?? "Invalid request body" }));
    }
    req.body = parsed.data;
    next();
  };
};
