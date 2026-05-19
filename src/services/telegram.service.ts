import crypto from "crypto";
import { env } from "../config/env";
import { TelegramTokenRepository } from "../repositories/telegram-token.repository";
import { UserRepository } from "../repositories/user.repository";

const TELEGRAM_BOT_USERNAME = env.TELEGRAM_BOT_USERNAME;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

const TelegramService = {
  getConnectLink: async (userId: number): Promise<string> => {
    const token = crypto.randomBytes(32).toString("hex");
    console.log(userId,token)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await TelegramTokenRepository.create(userId, token, expiresAt);
    return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
  },

  getStatus: async (userId: number): Promise<{ connected: boolean; chat_id: string | null }> => {
    const user = await UserRepository.findById(userId);
    return {
      connected: !!user?.telegram_chat_id,
      chat_id: user?.telegram_chat_id ?? null,
    };
  },

  disconnect: async (userId: number): Promise<void> => {
    await UserRepository.saveTelegramChatId(userId, null);
    await TelegramTokenRepository.deleteByUserId(userId);
  },
};

export default TelegramService;
