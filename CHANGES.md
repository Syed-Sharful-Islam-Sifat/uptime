# Backend Changes — Frontend Integration Guide

These changes were made after the initial `FRONTEND_GUIDE.md` was written.
Update your frontend integration to reflect everything below.

---

## 1. User Object — New Fields

The `user` object returned from `POST /auth/login` and `POST /auth/register` now includes two new fields:

```json
{
  "id": 1,
  "email": "user@example.com",
  "first_name": "Sifat",
  "last_name": "Ahmed",
  "is_email_verified": true,
  "plan": "free",
  "paid_until": null
}
```

| Field | Type | Description |
|---|---|---|
| `plan` | `"free" \| "paid"` | Always `"free"` until a payment is approved |
| `paid_until` | `string (ISO date) \| null` | When the paid plan expires. `null` for free users |

**What to do:**
- Store `plan` and `paid_until` in your auth state (Zustand or context)
- Use `plan` to conditionally show the upgrade banner and monitor limit UI
- A user is on paid plan only when `plan === "paid"` AND `paid_until` is in the future — compute this on the frontend too as a guard

---

## 2. Monitor Creation — Plan Limit Enforcement

`POST /api/v1/monitors` now returns `403` when the user hits their plan limit.

**Free plan:** 3 monitors max
**Paid plan:** 50 monitors max

```json
{
  "type": "ERROR",
  "message": "Free plan allows 3 monitors. Upgrade to paid plan to add more.",
  "result": null,
  "error": null
}
```

**What to do:**
- On `403` from monitor creation, show an upgrade prompt instead of a generic error
- Optionally disable the "Add Monitor" button on the frontend if `monitorCount >= planLimit` to prevent the round trip

---

## 3. New Payment Endpoints

### Submit bKash Payment Request

User pays ৳299 to your personal bKash number, then submits the transaction details.

```
POST /api/v1/payment/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "transaction_id": "8N67GH5KL2",
  "phone_number": "01712345678",
  "amount": 299
}
```

**Validation rules:**
- `transaction_id` — required, max 100 chars
- `phone_number` — min 11 digits, max 15 chars
- `amount` — positive number, minimum ৳299

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "request": {
      "id": 1,
      "user_id": 42,
      "transaction_id": "8N67GH5KL2",
      "phone_number": "01712345678",
      "amount": "299.00",
      "method": "bkash",
      "status": "pending",
      "created_at": "2026-05-18T10:00:00.000Z",
      "updated_at": "2026-05-18T10:00:00.000Z"
    },
    "message": "Payment request submitted. You will be upgraded within a few hours after verification."
  },
  "error": null
}
```

**Error cases:**
| Status | Message |
|---|---|
| `400` | `"You already have an active paid plan."` |
| `400` | `"Minimum payment amount is ৳299."` |
| `409` | `"You already have a pending payment request. Please wait for approval."` |

---

### Get Payment / Plan Status

```
GET /api/v1/payment/status
Authorization: Bearer <token>
```

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "plan": "free",
    "paid_until": null,
    "latest_request": {
      "status": "pending",
      "created_at": "2026-05-18T10:00:00.000Z"
    }
  },
  "error": null
}
```

`latest_request` is `null` if the user has never submitted a payment request.
`latest_request.status` is one of: `"pending"` | `"approved"` | `"rejected"`.

**What to show based on `latest_request.status`:**
- `"pending"` — "Your payment is under review. You'll be upgraded shortly."
- `"approved"` — plan will already be `"paid"` at this point
- `"rejected"` — "Your payment could not be verified. Please contact support."

---

## 4. Upgrade Flow (Full Frontend Flow)

```
1. User clicks "Upgrade to Paid"
2. Show modal with:
   - bKash number to send ৳299 to
   - Form: Transaction ID + Phone Number
3. User sends money via their bKash app
4. User fills form → POST /api/v1/payment/request
5. Show "Under review" message
6. Poll GET /api/v1/payment/status every 30s (or show a manual "Check status" button)
7. When plan === "paid", refresh user state and dismiss upgrade UI
```

**Suggested page:** `/settings` or `/billing` — a dedicated page with:
- Current plan badge (Free / Paid)
- `paid_until` expiry date if on paid plan
- bKash payment instructions + form (only shown if on free plan)
- Payment request status if one is pending

---

## 5. New Admin Panel

Admin is a completely separate user type — not a regular user. Admin accounts are inserted manually into the `admins` DB table.

### Admin Login Flow

**Step 1 — Request OTP**
```
POST /api/v1/admin/auth/request-otp
Content-Type: application/json

{ "email": "admin@example.com" }
```

Response `200` (same message whether email exists or not):
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "message": "If that email is registered as an admin, a code has been sent."
  },
  "error": null
}
```

**Step 2 — Verify OTP**
```
POST /api/v1/admin/auth/verify-otp
Content-Type: application/json

{
  "email": "admin@example.com",
  "code": "7382"
}
```

Success `200`:
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "token": "<admin JWT>"
  },
  "error": null
}
```

**Error cases:**
| Status | Message |
|---|---|
| `401` | `"Invalid or expired code."` |
| `400` | `"Code must be exactly 4 digits"` |

The OTP is **valid for 1 minute** and is **single-use** — deleted immediately on successful verify.

**Store the token separately from the regular user token** (e.g. `adminToken` in localStorage or a separate cookie). Do not mix admin and user sessions.

---

### Admin Panel Pages

All admin API routes require:
```
Authorization: Bearer <admin JWT>
```

A regular user JWT on an admin route returns `403 Forbidden`.

---

**List Pending Payment Requests**
```
GET /api/v1/admin/payment-requests
Authorization: Bearer <admin JWT>
```

Response:
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": [
    {
      "id": 1,
      "user_id": 42,
      "transaction_id": "8N67GH5KL2",
      "phone_number": "01712345678",
      "amount": "299.00",
      "method": "bkash",
      "status": "pending",
      "created_at": "2026-05-18T10:00:00.000Z",
      "updated_at": "2026-05-18T10:00:00.000Z",
      "email": "user@example.com",
      "first_name": "Sifat",
      "last_name": "Ahmed"
    }
  ],
  "error": null
}
```

---

**Approve a Payment Request**
```
POST /api/v1/admin/payment-requests/:requestId/approve
Authorization: Bearer <admin JWT>
```

Success `200`:
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "message": "Payment approved. User upgraded to paid plan.",
    "paid_until": "2026-06-17T10:00:00.000Z"
  },
  "error": null
}
```

**Error cases:**
| Status | Message |
|---|---|
| `404` | `"Payment request not found"` |
| `400` | `"Request is already approved."` |
| `400` | `"Request is already rejected."` |

---

**Reject a Payment Request**
```
POST /api/v1/admin/payment-requests/:requestId/reject
Authorization: Bearer <admin JWT>
```

Success `200`:
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "message": "Payment request rejected."
  },
  "error": null
}
```

---

## 6. Validation Schemas (copy into your frontend)

```ts
import { z } from "zod";

export const paymentRequestSchema = z.object({
  transaction_id: z.string().min(1, "Transaction ID is required").max(100),
  phone_number: z.string().min(11, "Phone number must be at least 11 digits").max(15),
  amount: z.number().positive("Amount must be positive"),
});

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
```

---

## 7. TypeScript Types

```ts
export type Plan = "free" | "paid";

export interface UserPlanStatus {
  plan: Plan;
  paid_until: string | null;
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  transaction_id: string;
  phone_number: string;
  amount: string;
  method: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface PaymentRequestWithUser extends PaymentRequest {
  email: string;
  first_name: string;
  last_name: string;
}

export interface PaymentStatusResult {
  plan: Plan;
  paid_until: string | null;
  latest_request: {
    status: "pending" | "approved" | "rejected";
    created_at: string;
  } | null;
}
```

---

## 8. Plan Limits — Fetch from Backend

Do **not** hardcode plan limits on the frontend. Fetch them from the backend so any pricing or limit change only needs to happen in one place.

```
GET /api/v1/payment/plans
```

No auth required. Call this once on app load (e.g. in a root Server Component or layout).

**Response `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "plans": {
      "free": {
        "name": "Free",
        "price_bdt": 0,
        "monitors": 3,
        "check_interval_minutes": 5
      },
      "paid": {
        "name": "Paid",
        "price_bdt": 299,
        "duration_days": 30,
        "monitors": 50,
        "check_interval_minutes": 1
      }
    }
  },
  "error": null
}
```

**TypeScript type:**
```ts
export interface PlanConfig {
  name: string;
  price_bdt: number;
  monitors: number;
  check_interval_minutes: number;
  duration_days?: number;
}

export interface PlansResult {
  plans: {
    free: PlanConfig;
    paid: PlanConfig;
  };
}
```

**How to use on the frontend:**
```ts
// Fetch once in a Server Component or layout
const { result } = await fetch("/api/v1/payment/plans").then(r => r.json());
const freePlan = result.plans.free;   // monitors: 3
const paidPlan = result.plans.paid;   // monitors: 50, price_bdt: 299

// Disable "Add Monitor" button
const atLimit = monitorCount >= activePlan === "paid" ? paidPlan.monitors : freePlan.monitors;

// Show price in upgrade modal
<p>৳{paidPlan.price_bdt} / {paidPlan.duration_days} days</p>
```

**Helper — still mirror `getActivePlan` on frontend since it uses local date logic:**
```ts
export const getActivePlan = (plan: Plan, paidUntil: string | null): Plan => {
  if (plan === "paid" && paidUntil && new Date() < new Date(paidUntil)) return "paid";
  return "free";
};
```
