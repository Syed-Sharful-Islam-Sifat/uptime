import HttpError from "../lib/helper/HttpError";
import { MonitorRepository } from "../repositories/monitor.repository";

const MonitorService = {
  create: async (body: any) => {
    const { url } = body;
    const isAlreadyExist = await MonitorRepository.findByUrl(url);

    if (isAlreadyExist) {
      throw new HttpError({
        statusCode: 409,
        message: "This url has already been registered",
      });
    }

    const result = await MonitorRepository.create(body);
    return result;
  },
  getAll: () => {},

  delete: (id: string) => {},
};

export default MonitorService;
