import cron from "node-cron";
import { MonitorRepository } from "../repositories/monitor.repository";
import { PingService } from "../services/ping.service";

export const startPingJob = () => {
  // runs every minute — checks all active monitors
  cron.schedule("* * * * *", async () => {
    console.log(`🔍 [${new Date().toISOString()}] Running ping job...`);

    try {
      const monitors = await MonitorRepository.findAll();
      const activeMonitors = monitors.filter(m => m.status === "up");

      // ping all active monitors concurrently
      await Promise.allSettled(
        activeMonitors.map(monitor => PingService.pingMonitor(monitor.id))
      );

      console.log(`✅ Pinged ${activeMonitors.length} monitors`);
    } catch (error) {
      console.error("❌ Ping job failed:", error);
    }
  });

  console.log("⏰ Ping job scheduler started");
};