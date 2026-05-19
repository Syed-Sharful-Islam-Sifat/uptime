import type { NextFunction, Request, Response } from "express";
import { AdminAuthService } from "../services/admin-auth.service";

const AdminAuthController = {
  async requestOtp(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return AdminAuthService.requestOtp(req.body.email);
  },

  async verifyOtp(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return AdminAuthService.verifyOtp(req.body.email, req.body.code);
  },
};

export default AdminAuthController;
