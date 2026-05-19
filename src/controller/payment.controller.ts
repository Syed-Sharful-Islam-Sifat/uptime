import type { NextFunction, Request, Response } from "express";
import { PaymentService } from "../services/payment.service";

const PaymentController = {
  async submitRequest(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return PaymentService.submitRequest(req.user!.id!, req.body);
  },

  async getStatus(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return PaymentService.getStatus(req.user!.id!);
  },
};

export default PaymentController;
