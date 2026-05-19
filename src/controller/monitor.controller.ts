import type { NextFunction, Request, Response } from "express";
import MonitorService from "../services/monitor.service";

const MonitorController = {
  async create(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return MonitorService.create(req.body, req.user!.id!);
  },

  async getAll(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return MonitorService.getAll(req.user!.id!);
  },

  async getById(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return MonitorService.getById(String(req.params["id"]), req.user!.id!);
  },

  async delete(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return MonitorService.delete(String(req.params["id"]), req.user!.id!);
  },
};

export default MonitorController;
