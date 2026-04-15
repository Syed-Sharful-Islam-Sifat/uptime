import { Request, Response, NextFunction } from "express";
import MonitorService from "../services/monitor.service";
import HttpError from "../lib/helper/HttpError";

const MonitorController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    const { id } = (req as any).user;
    const result = await MonitorService.create(req.body, id);
    return result;
  },
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const monitors = await MonitorService.getAll();
      res.json({ data: monitors });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await MonitorService.delete(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

export default MonitorController;
