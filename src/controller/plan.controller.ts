import type { NextFunction, Request, Response } from "express";
import { PLAN_LIMITS, PAID_PLAN_PRICE_BDT, PAID_PLAN_DURATION_DAYS } from "../types/plan.type";

const PlanController = {
  async getPlans(_req: Request, _res: Response, _next: NextFunction): Promise<unknown> {
    return {
      plans: {
        free: {
          name: "Free",
          price_bdt: 0,
          monitors: PLAN_LIMITS.free.monitors,
          check_interval_minutes: PLAN_LIMITS.free.interval,
        },
        paid: {
          name: "Paid",
          price_bdt: PAID_PLAN_PRICE_BDT,
          duration_days: PAID_PLAN_DURATION_DAYS,
          monitors: PLAN_LIMITS.paid.monitors,
          check_interval_minutes: PLAN_LIMITS.paid.interval,
        },
      },
    };
  },
};

export default PlanController;
