import HttpError from "../lib/helper/HttpError";
import { PaymentRepository } from "../repositories/payment.repository";
import { UserRepository } from "../repositories/user.repository";
import { PAID_PLAN_DURATION_DAYS, PAID_PLAN_PRICE_BDT, getActivePlan } from "../types/plan.type";
import type { PaymentRequestDTO } from "../schemas/payment.schema";

export const PaymentService = {
  submitRequest: async (userId: number, data: PaymentRequestDTO) => {
    const user = await UserRepository.findById(userId);
    if (!user) throw new HttpError({ statusCode: 404, message: "User not found" });

    const activePlan = getActivePlan(user.plan, user.paid_until);
    if (activePlan === "paid") {
      throw new HttpError({ statusCode: 400, message: "You already have an active paid plan." });
    }

    const existing = await PaymentRepository.findPendingByUserId(userId);
    if (existing) {
      throw new HttpError({
        statusCode: 409,
        message: "You already have a pending payment request. Please wait for approval.",
      });
    }

    if (data.amount < PAID_PLAN_PRICE_BDT) {
      throw new HttpError({
        statusCode: 400,
        message: `Minimum payment amount is ৳${PAID_PLAN_PRICE_BDT}.`,
      });
    }

    const request = await PaymentRepository.create({ user_id: userId, ...data });
    return { request, message: "Payment request submitted. You will be upgraded within a few hours after verification." };
  },

  getStatus: async (userId: number) => {
    const user = await UserRepository.findById(userId);
    if (!user) throw new HttpError({ statusCode: 404, message: "User not found" });

    const activePlan = getActivePlan(user.plan, user.paid_until);
    const latestRequest = await PaymentRepository.findLatestByUserId(userId);

    return {
      plan: activePlan,
      paid_until: user.paid_until,
      latest_request: latestRequest
        ? { status: latestRequest.status, created_at: latestRequest.created_at }
        : null,
    };
  },
};
