import { env } from "../../config/env";

const TELEGRAM_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export const sendTelegramAlert = async (
  chatId: string,
  message: string
): Promise<any> => {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("❌ Telegram error:", err);
    }

    return res;
  } catch (error) {
    console.error("❌ Failed to send Telegram alert:", error);
  }
};