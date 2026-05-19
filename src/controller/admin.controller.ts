import type { NextFunction, Request, Response } from "express";
import { AdminService } from "../services/admin.service";

const AdminController = {
  async listPendingRequests(_req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return AdminService.listPendingRequests();
  },

  async approvePayment(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    const requestId = parseInt(String(req.params["requestId"]), 10);
    return AdminService.approvePayment(requestId);
  },

  async rejectPayment(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    const requestId = parseInt(String(req.params["requestId"]), 10);
    return AdminService.rejectPayment(requestId);
  },
};

export default AdminController;
