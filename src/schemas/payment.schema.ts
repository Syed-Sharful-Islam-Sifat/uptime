import { z } from "zod";

export const paymentRequestSchema = z.object({
  transaction_id: z.string().min(1, "Transaction ID is required").max(100),
  phone_number: z
    .string()
    .min(11, "Phone number must be at least 11 digits")
    .max(15, "Phone number too long"),
  amount: z.number({ error: "Amount must be a number" }).positive("Amount must be positive"),
});

export type PaymentRequestDTO = z.infer<typeof paymentRequestSchema>;
