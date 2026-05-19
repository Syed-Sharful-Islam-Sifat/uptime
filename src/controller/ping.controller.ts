import type { NextFunction, Request, Response } from "express";
import { PingService } from "../services/ping.service";

const PingController = {
  async getByMonitorId(req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    const monitorId = String(req.params["monitorId"]);
    const limit = Math.min(Number(req.query["limit"]) || 20, 100);
    const cursorRaw = req.query["cursor"];
    const cursor = cursorRaw ? Number(cursorRaw) : undefined;

    return PingService.getPingsByMonitorId(monitorId, req.user!.id!, limit, cursor);
  },
};

export default PingController;
