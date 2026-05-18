import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import HttpError from "../lib/helper/HttpError";

interface JwtPayload {
  id: number;
  email: string;
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HttpError({ statusCode: 401, message: "Authentication required" }));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch {
    next(new HttpError({ statusCode: 401, message: "Invalid or expired token" }));
  }
};
