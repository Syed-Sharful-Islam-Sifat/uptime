import { Request, Response, NextFunction } from "express";
import { PingService } from "../services/ping.service";

const PingController = {
  async getByMonitorId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    const { monitorId}  = req.params;
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const result = await PingService.getPingsByMonitorId(monitorId as string, limit, offset);
    return result;
  },
};

export default PingController;