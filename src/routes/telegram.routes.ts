import { Router, Request, Response } from "express";
import { handleTelegramWebhook } from "../lib/telegram/telegraam";
import { getConnectLink, getStatus, disconnect } from "../controller/telegram.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Called by Telegram — no auth
router.post("/webhook", async (req: Request, res: Response) => {
  await handleTelegramWebhook(req.body);
  res.sendStatus(200);
});

// Called by the frontend — requires login
router.get("/connect", authenticate, getConnectLink);
router.get("/status", authenticate, getStatus);
router.delete("/disconnect", authenticate, disconnect);

export default router;
