import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.email("Invalid email format"),
});

export const verifyOtpSchema = z.object({
  email: z.email("Invalid email format"),
  code: z
    .string()
    .length(4, "Code must be exactly 4 digits")
    .regex(/^\d{4}$/, "Code must be numeric"),
});

export type RequestOtpDTO = z.infer<typeof requestOtpSchema>;
export type VerifyOtpDTO = z.infer<typeof verifyOtpSchema>;
