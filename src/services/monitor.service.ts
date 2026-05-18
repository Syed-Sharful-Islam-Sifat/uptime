import HttpError from "../lib/helper/HttpError";
import { MonitorRepository } from "../repositories/monitor.repository";
import type { CreateMonitorInput } from "../schemas/monitor.schema";

const MonitorService = {
  create: async (data: CreateMonitorInput, userId: number) => {
    return MonitorRepository.create(data, userId);
  },

  getAll: async (userId: number) => {
    return MonitorRepository.findAllByUserId(userId);
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
