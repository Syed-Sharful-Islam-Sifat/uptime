import { PingRepository } from "../repositories/ping.repository";
import { MonitorRepository } from "../repositories/monitor.repository";
import { sendTelegramAlert } from "../lib/telegram/telegraam";
import HttpError from "../lib/helper/HttpError";

export const PingService = {
  // called by the cron job for each monitor
  pingMonitor: async (monitorId: number): Promise<void> => {
    const monitor = await MonitorRepository.findById(String(monitorId));
    if (!monitor) return;

    const start = Date.now();
    let status: "up" | "down" = "down";
    let latency: number | null = null;
    let response_code: number | null = null;

    try {
      const res = await fetch(monitor.url, {
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      latency = Date.now() - start;
      response_code = res.status;
      status = res.ok ? "up" : "down";
    } catch {
      // unreachable or timed out — stays "down"
      latency = null;
      response_code = null;
    }

    // store the ping result
    await PingRepository.create({
      monitor_id: monitorId,
      status,
      latency,
      response_code,
    });

    // only alert if: current is "down" AND last ping was "up" (avoid spam)
    if (status === "down" && monitor.telegram_chat_id) {
      const lastPing = await PingRepository.findLastByMonitorId(monitorId);
      const wasUp = !lastPing || lastPing.status === "up";

      if (wasUp) {
        const message =
          `🚨 *Monitor Down Alert*\n\n` +
          `*Name:* ${monitor.name}\n` +
          `*URL:* ${monitor.url}\n` +
          `*Status:* ❌ Down\n` +
          `*Time:* ${new Date().toUTCString()}`;

        await sendTelegramAlert(monitor.telegram_chat_id, message);
      }
    }

    // alert recovery — was down, now up
    if (status === "up" && monitor.telegram_chat_id) {
      const lastPing = await PingRepository.findLastByMonitorId(monitorId);
      const wasDown = lastPing && lastPing.status === "down";

      if (wasDown) {
        const message =
          `✅ *Monitor Recovered*\n\n` +
          `*Name:* ${monitor.name}\n` +
          `*URL:* ${monitor.url}\n` +
          `*Latency:* ${latency}ms\n` +
          `*Time:* ${new Date().toUTCString()}`;

        await sendTelegramAlert(monitor.telegram_chat_id, message);
      }
    }
  },

  // for the API — get ping history for a monitor
  getPingsByMonitorId: async (monitorId: string, limit = 20, offset = 0) => {
    const monitor = await MonitorRepository.findById(monitorId);
    if (!monitor) {
      throw new HttpError({ statusCode: 404, message: "Monitor not found" });
    }

    const [pings, uptime] = await Promise.all([
      PingRepository.findAllByMonitorId(Number(monitorId), limit, offset),
      PingRepository.getUptimePercentage(Number(monitorId)),
    ]);

    return { pings, uptime };
  },
};