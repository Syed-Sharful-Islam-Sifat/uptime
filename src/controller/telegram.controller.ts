import type { Request, Response, NextFunction } from "express";
import TelegramService from "../services/telegram.service";

export const getConnectLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = await TelegramService.getConnectLink(req.user!.id);
    res.json({ url });
  } catch (err) {
    next(err);
  }
};

export const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await TelegramService.getStatus(req.user!.id);
    
    res.json(status);
  } catch (err) {
    next(err);
  }
};

export const disconnect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await TelegramService.disconnect(req.user!.id);
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
};
