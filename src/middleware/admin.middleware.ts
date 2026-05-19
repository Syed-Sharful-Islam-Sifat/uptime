import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import HttpError from "../lib/helper/HttpError";

interface AdminJwtPayload {
  email: string;
  is_admin: boolean;
}

export const authenticateAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HttpError({ statusCode: 401, message: "Authentication required" }));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;

    if (!payload.is_admin) {
      return next(new HttpError({ statusCode: 403, message: "Forbidden" }));
    }

    req.user = { email: payload.email, is_admin: true };
    next();
  } catch {
    next(new HttpError({ statusCode: 401, message: "Invalid or expired token" }));
  }
};
