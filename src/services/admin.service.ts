import HttpError from "../lib/helper/HttpError";
import { PaymentRepository } from "../repositories/payment.repository";
import { UserRepository } from "../repositories/user.repository";
import { PAID_PLAN_DURATION_DAYS } from "../types/plan.type";

export const AdminService = {
  listPendingRequests: async () => {
    return PaymentRepository.listByStatus("pending");
  },

  approvePayment: async (requestId: number) => {
    const request = await PaymentRepository.findById(requestId);
    if (!request) {
      throw new HttpError({ statusCode: 404, message: "Payment request not found" });
    }
    if (request.status !== "pending") {
      throw new HttpError({ statusCode: 400, message: `Request is already ${request.status}.` });
    }

    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + PAID_PLAN_DURATION_DAYS);

    await Promise.all([
      UserRepository.upgradePlan(request.user_id, paidUntil),
      PaymentRepository.updateStatus(request.id, "approved"),
    ]);

    return { message: "Payment approved. User upgraded to paid plan.", paid_until: paidUntil };
  },

  rejectPayment: async (requestId: number) => {
    const request = await PaymentRepository.findById(requestId);
    if (!request) {
      throw new HttpError({ statusCode: 404, message: "Payment request not found" });
    }
    if (request.status !== "pending") {
      throw new HttpError({ statusCode: 400, message: `Request is already ${request.status}.` });
    }

    await PaymentRepository.updateStatus(request.id, "rejected");
    return { message: "Payment request rejected." };
  },
};
