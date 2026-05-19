import HttpError from "../lib/helper/HttpError";
import { MonitorRepository } from "../repositories/monitor.repository";
import { UserRepository } from "../repositories/user.repository";
import type { CreateMonitorInput } from "../schemas/monitor.schema";
import { PLAN_LIMITS, getActivePlan } from "../types/plan.type";

const MonitorService = {
  create: async (data: CreateMonitorInput, userId: number) => {
    const user = await UserRepository.findById(userId);
    if (!user) throw new HttpError({ statusCode: 404, message: "User not found" });

    const plan = getActivePlan(user.plan, user.paid_until);
    const limit = PLAN_LIMITS[plan].monitors;
    const count = await MonitorRepository.countByUserId(userId);

    if (count >= limit) {
      const msg =
        plan === "free"
          ? `Free plan allows ${limit} monitors. Upgrade to paid plan to add more.`
          : `You have reached the maximum of ${limit} monitors.`;
      throw new HttpError({ statusCode: 403, message: msg });
    }

    return MonitorRepository.create(data, userId, PLAN_LIMITS[plan].interval);
  },

  getAll: async (userId: number) => {
    return MonitorRepository.findAllByUserId(userId);
  },

  getById: async (id: string, userId: number) => {
    const monitor = await MonitorRepository.findById(id);
    if (!monitor || monitor.user_id !== userId) {
      throw new HttpError({ statusCode: 404, message: "Monitor not found" });
    }
    return monitor;
  },

  delete: async (id: string, userId: number) => {
    const monitor = await MonitorRepository.findById(id);

    if (!monitor) {
      throw new HttpError({ statusCode: 404, message: "Monitor not found" });
    }

    // Return 404 (not 403) when the monitor exists but belongs to another user.
    // This prevents IDOR — attackers can't distinguish "not found" from "not yours".
    if (monitor.user_id !== userId) {
      throw new HttpError({ statusCode: 404, message: "Monitor not found" });
    }

    const deleted = await MonitorRepository.delete(id);
    if (!deleted) {
      throw new HttpError({ statusCode: 500, message: "Failed to delete monitor" });
    }

    return { deleted: true };
  },
};

export default MonitorService;
