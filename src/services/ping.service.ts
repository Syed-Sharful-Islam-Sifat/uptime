import { Sentry } from "../config/sentry";
import HttpError from "../lib/helper/HttpError";
import { sendTelegramAlert } from "../lib/telegram/telegraam";
import { MonitorRepository } from "../repositories/monitor.repository";
import { PingRepository } from "../repositories/ping.repository";

export const PingService = {
  // Called by the cron job for each monitor
  pingMonitor: async (monitorId: number): Promise<void> => {
    const monitor = await MonitorRepository.findById(String(monitorId));
    if (!monitor) return;

    const start = Date.now();
    let status: "up" | "down" = "down";
    let latency: number | null = null;
    let response_code: number | null = null;

    try {
      const res = await fetch(monitor.url, {
        signal: AbortSignal.timeout(10_000),
      });

      latency = Date.now() - start;
      response_code = res.status;
      status = res.ok ? "up" : "down";
    } catch {
      // Unreachable host or timed out — stays "down"
    }

    // Fetch the last ping and store the new result in parallel
    const [lastPing] = await Promise.all([
      PingRepository.findLastByMonitorId(monitorId),
      PingRepository.create({ monitor_id: monitorId, status, latency, response_code }),
    ]);

    if (!monitor.telegram_chat_id) return;

    const wasUp = !lastPing || lastPing.status === "up";
    const wasDown = lastPing?.status === "down";

    if (status === "down" && wasUp) {
      const message =
        `🚨 *Monitor Down Alert*\n\n` +
        `*Name:* ${monitor.name}\n` +
        `*URL:* ${monitor.url}\n` +
        `*Status:* ❌ Down\n` +
        `*Time:* ${new Date().toUTCString()}`;

      await sendTelegramAlert(monitor.telegram_chat_id, message).catch((err) =>
        Sentry.captureException(err),
      );
    }

    if (status === "up" && wasDown) {
      const message =
        `✅ *Monitor Recovered*\n\n` +
        `*Name:* ${monitor.name}\n` +
        `*URL:* ${monitor.url}\n` +
        `*Latency:* ${latency}ms\n` +
        `*Time:* ${new Date().toUTCString()}`;

      await sendTelegramAlert(monitor.telegram_chat_id, message).catch((err) =>
        Sentry.captureException(err),
      );
    }
  },

  // For the API — get paginated ping history for a monitor (IDOR-safe)
  getPingsByMonitorId: async (
    monitorId: string,
    userId: number,
    limit: number,
    cursor?: number,
  ) => {
    const monitor = await MonitorRepository.findById(monitorId);

    if (!monitor || monitor.user_id !== userId) {
      throw new HttpError({ statusCode: 404, message: "Monitor not found" });
    }

    const [pings, uptime] = await Promise.all([
      PingRepository.findByMonitorId(Number(monitorId), limit, cursor),
      PingRepository.getUptimePercentage(Number(monitorId)),
    ]);

    const nextCursor = pings.length === limit ? (pings[pings.length - 1]?.id ?? null) : null;

    return { pings, uptime, nextCursor };
  },
};
