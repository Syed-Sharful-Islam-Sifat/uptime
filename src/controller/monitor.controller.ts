import { Request, Response, NextFunction } from "express";
import MonitorService from "../services/monitor.service";

const MonitorController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const monitor = await MonitorService.create(req.body);
      res.status(201).json({ data: monitor });
    } catch (err) {
      next(err);
    }
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
