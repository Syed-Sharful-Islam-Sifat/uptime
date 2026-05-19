import { env } from "../../config/env";
import { TelegramTokenRepository } from "../../repositories/telegram-token.repository";
import { UserRepository } from "../../repositories/user.repository";

const TELEGRAM_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export const handleTelegramWebhook = async (body: any): Promise<void> => {
  const message = body?.message;
  if (!message) return;

  const chatId: string = String(message.chat?.id ?? "");
  const text: string = message.text ?? "";
  console.log(chatId,text)
  

  if (text.startsWith("/start")) {
    const token = text.split(" ")[1]?.trim();
    console.log(token)
    if (token) {
      const record = await TelegramTokenRepository.findByToken(token);
      console.log(record)
      if (record) {
        await UserRepository.saveTelegramChatId(record.user_id, chatId);
        await TelegramTokenRepository.deleteByToken(token);

        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "✅ Telegram connected! You will now receive downtime alerts here.",
            parse_mode: "Markdown",
          }),
        });
      } else {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "❌ This link has expired or is invalid. Please generate a new one from the app.",
          }),
        });
      }
    } else {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Please use the *Connect Telegram* button in the app to link your account.",
          parse_mode: "Markdown",
        }),
      });
    }
  }
};

export const registerTelegramWebhook = async (webhookUrl: string): Promise<void> => {
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const data = await res.json();
 
  if (data.ok) {
    console.log("✅ Telegram webhook registered:", webhookUrl);
  } else {
    console.error("❌ Failed to register Telegram webhook:", data);
  }
};

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