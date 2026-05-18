import type { NextFunction, Request, Response } from "express";
import HttpError from "../lib/helper/HttpError";
import { AuthService } from "../services/auth.service";

const AuthController = {
  async register(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return AuthService.register(req.body);
  },

  async login(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return AuthService.login(req.body);
  },

  async verifyEmail(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    const token = typeof req.query["token"] === "string" ? req.query["token"] : null;
    if (!token) {
      throw new HttpError({ statusCode: 400, message: "Verification token is required" });
    }
    return AuthService.verifyEmail(token);
  },

  async resendVerification(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return AuthService.resendVerification(req.body.email);
  },
};

export default AuthController;
