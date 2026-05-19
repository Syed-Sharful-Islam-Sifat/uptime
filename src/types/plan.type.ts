export const PLAN_LIMITS = {
  free: { monitors: 3, interval: 5 },
  paid: { monitors: 50, interval: 1 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export const PAID_PLAN_PRICE_BDT = 299;
export const PAID_PLAN_DURATION_DAYS = 30;

export const getActivePlan = (plan: Plan, paidUntil: Date | null): Plan => {
  if (plan === "paid" && paidUntil && new Date() < paidUntil) return "paid";
  return "free";
};
