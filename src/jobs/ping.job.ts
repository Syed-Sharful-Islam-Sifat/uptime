import cron from "node-cron";
import { Sentry } from "../config/sentry";
import { MonitorRepository } from "../repositories/monitor.repository";
import { PingService } from "../services/ping.service";

const BATCH_SIZE = 100;

const runPingJob = async () => {
  let lastId = 0;
  let totalPinged = 0;

  // Cursor-based batching — never loads the full monitors table into memory
  while (true) {
    const batch = await MonitorRepository.findActiveBatch(lastId, BATCH_SIZE);
    console.log(batch)
    if (batch.length === 0) break;

    await Promise.allSettled(batch.map((monitor) => PingService.pingMonitor(monitor.id)));

    totalPinged += batch.length;
    lastId = batch[batch.length - 1]?.id ?? lastId;

    if (batch.length < BATCH_SIZE) break;
  }

  console.log(`✅ [${new Date().toISOString()}] Pinged ${totalPinged} monitors`);
};

export const startPingJob = () => {
  cron.schedule("* * * * *", async () => {
    console.log(`🔍 [${new Date().toISOString()}] Running ping job...`);
    try {
      await runPingJob();
    } catch (error) {
      Sentry.captureException(error);
      console.error("❌ Ping job failed:", error);
    }
  });

  console.log("⏰ Ping job scheduler started");
};
