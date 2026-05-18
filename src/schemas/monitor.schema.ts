import { z } from "zod";

export const createMonitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  url: z.url("Invalid URL format"),
  telegram_chat_id: z.string().max(255).optional(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
