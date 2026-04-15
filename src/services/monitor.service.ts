import HttpError from "../lib/helper/HttpError";
import { MonitorRepository } from "../repositories/monitor.repository";

const MonitorService = {
  create: async (body: any,id:string) => {
    const { url } = body;
    
    const isAlreadyExist = await MonitorRepository.findByUrl(url);
    if (isAlreadyExist) {
      throw new HttpError({
        statusCode: 409,
        message: "This url has already been registered",
      });
    }

    return MonitorRepository.create(body,id);
  },

  getAll: async () => {
    return MonitorRepository.findAll();
  },

  delete: async (id: string) => {
    const monitor = await MonitorRepository.findById(id);
    if (!monitor) {
      throw new HttpError({
        statusCode: 404,
        message: "Monitor not found",
      });
    }

    const deleted = await MonitorRepository.delete(id);
    if (!deleted) {
      throw new HttpError({
        statusCode: 500,
        message: "Failed to delete monitor",
      });
    }

    return { deleted: true };
  },
};

export default MonitorService;