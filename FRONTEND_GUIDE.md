# Frontend Implementation Guide — Uptime Monitor

This document is the complete engineering specification for the frontend. Read it fully before writing a single line of code. Every architectural decision is explained so you can make informed trade-offs as the project grows.

---

## Table of Contents

1. [What the Site Should Feel Like](#1-what-the-site-should-feel-like)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [The Core Mental Model — Server vs Client](#3-the-core-mental-model--server-vs-client)
4. [State Management](#4-state-management)
5. [Project Structure](#5-project-structure)
6. [Design System](#6-design-system)
7. [Page-by-Page Breakdown](#7-page-by-page-breakdown)
8. [Server Actions](#8-server-actions)
9. [API Client Layer](#9-api-client-layer)
10. [API Contract — Every Request & Response](#10-api-contract--every-request--response)
11. [Frontend Validation Schemas (Exact Match to Backend)](#11-frontend-validation-schemas-exact-match-to-backend)
12. [Authentication Flow](#12-authentication-flow)
13. [Route Protection](#13-route-protection)
14. [Forms & Validation Wiring](#14-forms--validation-wiring)
15. [Project Setup Instructions](#15-project-setup-instructions)

---

## 1. What the Site Should Feel Like

Look at **Better Uptime**, **UptimeRobot**, and **Checkly** for visual reference. These share a design language that works for monitoring dashboards:

- **Status is the hero.** Open the dashboard and you instantly know whether everything is healthy. No decorative noise. Color communicates state before the user reads a word.
- **The monitor list is the home screen.** It is not a landing page. It is a live, scannable grid with status, uptime percentage, and last response time visible at a glance.
- **Detail on demand.** Clicking a monitor reveals the full history — a latency line chart and a compact status history bar (last N pings shown as tiny colored blocks, like GitHub's contribution graph).

### Color Language

| State | Hex | Usage |
|---|---|---|
| Up | `#22c55e` | Status dot, badge, chart fill |
| Down | `#ef4444` | Status dot, badge, alert text |
| Pending | `#f59e0b` | Status dot, badge |
| Background (dark) | `#0f172a` | Page background |
| Surface (dark) | `#1e293b` | Cards, modals, sidebar |
| Background (light) | `#f8fafc` | Page background |
| Surface (light) | `#ffffff` | Cards, modals |

### Typography
- Font: **Inter** (Google Fonts). Excellent tabular numbers for uptime percentages.
- Uptime %: large, bold, colored by state.
- URLs: `font-mono`, truncated with `title` tooltip on hover.

### Layout (Desktop)
```
┌──────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px fixed)  │         MAIN CONTENT               │
│                         │                                     │
│  ● Uptime Monitor       │  All Monitors        [+ Add]       │
│  ───────────────        │  ─────────────────────────────────  │
│  Dashboard          ←   │                                     │
│  Settings               │  ┌───────────┐  ┌───────────┐      │
│                         │  │ ● Prod API│  │ ● Staging │      │
│  ───────────────        │  │  99.50%   │  │  87.30%   │      │
│  Jane Doe               │  │  142ms    │  │  —        │      │
│  Log out                │  │ ▮▮▮▮▮▮▮▮ │  │ ▮▮▮░▮▮▮▮ │      │
│                         │  └───────────┘  └───────────┘      │
└──────────────────────────────────────────────────────────────┘
```
On mobile: sidebar collapses to a hamburger drawer or a bottom navigation bar.

---

## 2. Tech Stack Decisions

| Technology | Role | Why |
|---|---|---|
| **Next.js 14+ App Router** | Framework | Layouts, Server Components, Middleware, Server Actions — all built in |
| **Tailwind CSS** | Styling | Utility-first, works perfectly with Server Components |
| **shadcn/ui** | Component library | Copy-pasted into your codebase — you own the source, no black-box |
| **Recharts** | Charts | React-native, composable, handles null values (down pings = gaps in line) |
| **Lucide React** | Icons | Consistent, minimal, already used by shadcn/ui |
| **next-themes** | Dark mode | One-line setup, persists to localStorage |
| **Axios** | HTTP client | Interceptors for auth cookie + global error handling |
| **TanStack Query** | Client-side server state | Only for components that genuinely need client fetching (polling, cursor pagination) |
| **Zustand** | Client UI state | Sidebar open/closed, modal visibility — nothing that touches the server |
| **React Hook Form + Zod** | Forms & validation | Performant, mirrors backend schemas |

---

## 3. The Core Mental Model — Server vs Client

This is the most important section. Read it before touching any component.

### The rule is not binary

The question is not "do I use server or client?" The question is **"what does this specific component actually need?"** Start from server-side by default. Only move to client-side when you have a concrete reason.

### The decision framework

```
Does the component display data that never changes after initial load?
  YES → Server Component, fetch on the server. Done.

Does the component need to update in real-time (polling)?
  YES → Client Component + router.refresh() on interval
         OR TanStack Query with refetchInterval (if already client for other reasons)

Does the component trigger a mutation (create / delete / update)?
  YES → Server Action. The page re-validates automatically.
        If instant feedback matters → useOptimistic before the Server Action fires.

Does the component need cursor pagination driven by user interaction?
  YES → Client Component + TanStack Query useInfiniteQuery

Does the component use a browser-only library (Recharts, etc.)?
  YES → Client Component. Fetch data on the server above it and pass as props,
        or fetch client-side if the data depends on client state (cursor, etc.)
```

### The page pattern — always the same

Every route file (`page.tsx`) is a **Server Component** that does one thing: fetch whatever data can be fetched on the server and call the single top-level component for that page. The top-level component composes all sub-components.

```
page.tsx (Server Component)
  │  fetches initial data
  │  calls one component
  ▼
<MonitorListPage initialMonitors={monitors} />   ← the "main component"
  │  composes everything
  ├─ <PageHeader />
  ├─ <MonitorGrid monitors={monitors} />
  │     ├─ <MonitorCard />
  │     └─ <MonitorCard />
  └─ <AddMonitorDialog />
```

The `page.tsx` file should never contain JSX beyond a single component call. It is a data loader, not a layout.

### Concrete rules

| Situation | What to use |
|---|---|
| Displaying the initial monitor list | Server Component fetch |
| Keeping monitor status live (refreshes every 30s) | `router.refresh()` on an interval inside a thin Client Component |
| Creating a monitor | Server Action → `revalidatePath` |
| Deleting a monitor | Server Action → `revalidatePath`, `useOptimistic` for instant removal |
| Ping history with "load more" (cursor) | TanStack Query `useInfiniteQuery` — this is inherently client-side state |
| Latency line chart | Client Component (Recharts requires browser APIs) |
| Auth forms | Client Component (React Hook Form requires browser events) |
| Verify-email page (fires on mount) | Client Component (needs `useEffect` on token query param) |

---

## 4. State Management

### Three separate concerns

| Concern | Tool | What belongs here |
|---|---|---|
| Server data for initial render | Next.js Server Components | Monitor list, monitor detail, user profile |
| Server data that updates dynamically | `router.refresh()` or TanStack Query | Live monitor status, cursor-paginated pings |
| Client UI state | Zustand | Sidebar open, dialog open/closed |

### Why not TanStack Query for everything?

TanStack Query is excellent but it is a client-side tool. Using it for the monitor list means the user sees a spinner on every page visit because the data is fetched after hydration. Server Components eliminate that entirely — data arrives with the HTML.

TanStack Query earns its place when:
1. The data must update without a full page re-render (polling)
2. Pagination state lives on the client (cursor)

For everything else, use the server.

### router.refresh() for polling

When the user has the dashboard open, monitor statuses can change every minute (the cron job runs every minute). To keep the dashboard live without TanStack Query:

```tsx
// components/monitors/LiveRefresh.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Drop this invisible component anywhere in a server-rendered page
// to keep it automatically refreshing. It re-runs the server fetch.
export const LiveRefresh = ({ intervalMs = 30_000 }: { intervalMs?: number }) => {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
};
```

Usage in the dashboard main component:
```tsx
<LiveRefresh intervalMs={30_000} />
```

This is a single-purpose Client Component with no UI. It re-renders the Server Components above it every 30 seconds by calling `router.refresh()`.

### useOptimistic for instant mutation feedback

When the user deletes a monitor, waiting for the Server Action + server re-fetch would show a ~500ms lag. `useOptimistic` removes it from the UI instantly before the server responds:

```tsx
const [optimisticMonitors, removeOptimistic] = useOptimistic(
  monitors,
  (current, id: number) => current.filter((m) => m.id !== id),
);

const handleDelete = async (id: number) => {
  removeOptimistic(id);        // instant — UI removes it immediately
  await deleteMonitorAction(id); // actual Server Action — revalidates on the server
};
```

If the Server Action fails, React automatically rolls back `useOptimistic` to the real `monitors` value.

### Zustand — only for UI state

```typescript
// lib/stores/ui.store.ts
import { create } from "zustand";

interface UIStore {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isAddMonitorOpen: boolean;
  setAddMonitorOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  isAddMonitorOpen: false,
  setAddMonitorOpen: (open) => set({ isAddMonitorOpen: open }),
}));
```

No monitors. No user data. No tokens. Only state that never touches the server.

---

## 5. Project Structure

```
src/
├── app/
│   ├── (auth)/                         # No dashboard shell
│   │   ├── login/
│   │   │   └── page.tsx                # Server Component → <LoginPage />
│   │   ├── register/
│   │   │   └── page.tsx                # Server Component → <RegisterPage />
│   │   └── verify-email/
│   │       └── page.tsx                # Server Component → <VerifyEmailPage />
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Server Component — sidebar shell, fetches user
│   │   └── dashboard/
│   │       ├── page.tsx                # Server Component — fetches monitors → <MonitorListPage />
│   │       └── monitors/
│   │           └── [id]/
│   │               └── page.tsx        # Server Component — fetches monitor → <MonitorDetailPage />
│   │
│   ├── actions/                        # All Server Actions live here
│   │   ├── monitor.actions.ts          # createMonitor, deleteMonitor
│   │   └── auth.actions.ts             # setTokenCookie, clearTokenCookie
│   │
│   ├── layout.tsx                      # Root layout (fonts, Providers)
│   └── middleware.ts                   # Edge route protection
│
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── auth/
│   │   ├── LoginPage.tsx               # Client Component (form)
│   │   └── RegisterPage.tsx            # Client Component (form)
│   │   └── VerifyEmailPage.tsx         # Client Component (fires on mount)
│   ├── monitors/
│   │   ├── MonitorListPage.tsx         # Can be Server or Client — see breakdown
│   │   ├── MonitorDetailPage.tsx       # Composes detail sub-components
│   │   ├── MonitorGrid.tsx             # Grid layout for cards
│   │   ├── MonitorCard.tsx             # Single card — Client (delete action, useOptimistic)
│   │   ├── AddMonitorDialog.tsx        # Client Component (form + dialog)
│   │   ├── DeleteMonitorButton.tsx     # Client Component (useOptimistic + Server Action)
│   │   ├── StatusBadge.tsx             # Server Component (pure display)
│   │   ├── StatusDot.tsx               # Server Component (pure display, CSS animation)
│   │   └── UptimeBar.tsx               # Server Component (pure display)
│   ├── pings/
│   │   ├── PingHistorySection.tsx      # Client Component (cursor pagination)
│   │   ├── LatencyChart.tsx            # Client Component (Recharts)
│   │   └── UptimeStat.tsx              # Server Component (pure display)
│   └── layout/
│       ├── Sidebar.tsx                 # Client Component (Zustand for mobile toggle)
│       ├── Topbar.tsx                  # Server Component
│       ├── LiveRefresh.tsx             # Client Component (router.refresh interval)
│       └── Providers.tsx              # Client Component (QueryClient, ThemeProvider)
│
├── lib/
│   ├── api/
│   │   ├── client.ts                   # Axios instance
│   │   ├── monitors.ts                 # getMonitors(), getMonitorById()
│   │   ├── pings.ts                    # getPings() — cursor-paginated
│   │   └── auth.ts                     # register(), login(), verifyEmail()
│   ├── hooks/
│   │   └── usePings.ts                 # useInfiniteQuery — only hook needed
│   ├── stores/
│   │   └── ui.store.ts                 # Zustand UI state
│   ├── schemas/
│   │   ├── auth.schema.ts
│   │   └── monitor.schema.ts
│   ├── query-keys.ts
│   └── status.ts                       # Status color/label config
│
└── types/
    ├── api.ts
    ├── monitor.ts
    ├── ping.ts
    └── auth.ts
```

---

## 6. Design System

### API response type

```typescript
// types/api.ts
export interface ApiResponse<T> {
  type: "RESULT" | "ERROR";
  message: string;
  result: T | null;
  error: null;
}
```

### Domain types

```typescript
// types/monitor.ts
export interface Monitor {
  id: number;
  user_id: number;
  name: string;
  url: string;
  interval: number;
  status: "up" | "down" | "pending";
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

// types/ping.ts
export interface Ping {
  id: number;
  monitor_id: number;
  status: "up" | "down";
  latency: number | null;
  response_code: number | null;
  checked_at: string;
}

export interface PingHistoryResponse {
  pings: Ping[];
  uptime: number;
  nextCursor: number | null;
}
```

### Status config utility

```typescript
// lib/status.ts
import type { Monitor } from "@/types/monitor";

export const statusConfig = {
  up:      { label: "Up",      dot: "bg-green-500", badge: "bg-green-500/10 text-green-500 border-green-500/20" },
  down:    { label: "Down",    dot: "bg-red-500",   badge: "bg-red-500/10 text-red-500 border-red-500/20" },
  pending: { label: "Pending", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
} as const;

export const getStatus = (status: Monitor["status"]) => statusConfig[status];
```

### cn() utility

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

---

## 7. Page-by-Page Breakdown

### Pattern repeated on every page

```tsx
// ✅ Correct — page.tsx is a server data loader only
export default async function SomePage() {
  const data = await fetchSomething();
  return <SomePageComponent data={data} />;
}

// ❌ Wrong — page.tsx should not contain JSX structure
export default async function SomePage() {
  const data = await fetchSomething();
  return (
    <div>
      <Header />
      <main><SomeComponent data={data} /></main>
    </div>
  );
}
```

---

### `/register` — `page.tsx`

```tsx
// app/(auth)/register/page.tsx
import { RegisterPage } from "@/components/auth/RegisterPage";
export default function Register() {
  return <RegisterPage />;
}
```

`RegisterPage` is a **Client Component** because it contains a React Hook Form. No server data needed.

**Flow on submit:**
1. Zod validates the form client-side
2. Call `POST /api/v1/auth/register` via Axios
3. On `200` → redirect to `/login?registered=true`
4. On `409` → show "Email already in use" inline error
5. On `400` → show the Zod field error from the API response

---

### `/login` — `page.tsx`

```tsx
// app/(auth)/login/page.tsx
import { LoginPage } from "@/components/auth/LoginPage";
export default function Login() {
  return <LoginPage />;
}
```

`LoginPage` is a **Client Component** (form). On submit:
1. Call `POST /api/v1/auth/login` via Axios
2. On `200` → call `setTokenCookie` Server Action (sets the httpOnly cookie) → redirect to `/dashboard`
3. On `403` → show "Please verify your email. [Resend link →]"
4. On `401` → show "Invalid email or password"

If `searchParams.registered === "true"` (passed from register page), show a blue banner: "Account created. Check your inbox before logging in."

---

### `/verify-email` — `page.tsx`

```tsx
// app/(auth)/verify-email/page.tsx
import { VerifyEmailPage } from "@/components/auth/VerifyEmailPage";
export default function VerifyEmail() {
  return <VerifyEmailPage />;
}
```

`VerifyEmailPage` is a **Client Component** because it must fire the API call on mount, reading `window.location.search` (or `useSearchParams`) for the token.

Three render states:
```
Verifying...  →  spinner

Success        →  ✅ "Email verified. You can now log in."
                     [Go to Login] button

Error          →  ❌ "This link is invalid or has expired."
                     [Request a new link] button → inline email input
```

---

### `/dashboard` — Monitor List

```tsx
// app/(dashboard)/dashboard/page.tsx
import { cookies } from "next/headers";
import { MonitorListPage } from "@/components/monitors/MonitorListPage";
import { monitorsApi } from "@/lib/api/monitors";

export default async function Dashboard() {
  // Fetch on the server — no loading spinner on initial render
  const monitors = await monitorsApi.getAll(cookies().get("auth_token")?.value);
  return <MonitorListPage initialMonitors={monitors} />;
}
```

**`MonitorListPage`** — can be a **Server Component** if you only need the initial list. But because it contains `<LiveRefresh />` (a Client Component that polls), it needs to handle both:

```tsx
// components/monitors/MonitorListPage.tsx
import { LiveRefresh } from "@/components/layout/LiveRefresh";
import { MonitorGrid } from "./MonitorGrid";
import { AddMonitorDialog } from "./AddMonitorDialog";
import type { Monitor } from "@/types/monitor";

// This is a Server Component — it receives server-fetched data as props.
// LiveRefresh is a thin Client Component that triggers router.refresh() on interval.
// When router.refresh() fires, this Server Component re-renders with fresh data.
export const MonitorListPage = ({ initialMonitors }: { initialMonitors: Monitor[] }) => {
  return (
    <div>
      <LiveRefresh intervalMs={30_000} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Monitors</h1>
        <AddMonitorDialog />
      </div>
      <MonitorGrid monitors={initialMonitors} />
    </div>
  );
};
```

**Why this works:**
- On page load: server fetches monitors, renders immediately, no spinner
- Every 30 seconds: `LiveRefresh` calls `router.refresh()` → Next.js re-runs the server fetch → `MonitorListPage` re-renders with updated data
- No TanStack Query required here because the data does not depend on client-side state

**`MonitorGrid`** — Server Component (pure display):
```tsx
export const MonitorGrid = ({ monitors }: { monitors: Monitor[] }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {monitors.map((monitor) => (
      <MonitorCard key={monitor.id} monitor={monitor} />
    ))}
    {monitors.length === 0 && (
      <p className="col-span-full text-center text-slate-500 py-16">
        No monitors yet. Add one to get started.
      </p>
    )}
  </div>
);
```

**`MonitorCard`** — **Client Component** because it needs `useOptimistic` for delete:
```tsx
"use client";
import { useOptimistic } from "react";
import { deleteMonitorAction } from "@/app/actions/monitor.actions";

export const MonitorCard = ({ monitor }: { monitor: Monitor }) => {
  const status = getStatus(monitor.status);
  
  const handleDelete = async () => {
    await deleteMonitorAction(monitor.id);
    // router.refresh() is called inside the Server Action via revalidatePath
  };

  return (
    <div className={cn("rounded-xl border p-5", ...)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={monitor.status} />
          <span className="font-semibold truncate max-w-[160px]">{monitor.name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/monitors/${monitor.id}`)}>
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-500" onClick={handleDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
      <p className="text-xs font-mono text-slate-500 truncate mt-1" title={monitor.url}>
        {monitor.url}
      </p>
      {/* Uptime % */}
      {/* Last latency */}
      {/* UptimeBar */}
    </div>
  );
};
```

**`AddMonitorDialog`** — **Client Component** (form + dialog state):

On submit → calls `createMonitorAction` Server Action → Server Action calls API + `revalidatePath("/dashboard")` → page re-renders with new monitor in the list → dialog closes.

---

### `/dashboard/monitors/[id]` — Monitor Detail

```tsx
// app/(dashboard)/dashboard/monitors/[id]/page.tsx
import { monitorsApi } from "@/lib/api/monitors";
import { MonitorDetailPage } from "@/components/monitors/MonitorDetailPage";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function MonitorDetail({ params }: { params: { id: string } }) {
  const token = cookies().get("auth_token")?.value;
  const monitor = await monitorsApi.getById(params.id, token);
  if (!monitor) notFound();
  return <MonitorDetailPage monitor={monitor} />;
}
```

**`MonitorDetailPage`** — Server Component (pure composition):

```tsx
// components/monitors/MonitorDetailPage.tsx
import type { Monitor } from "@/types/monitor";
import { StatusBadge } from "./StatusBadge";
import { UptimeStat } from "@/components/pings/UptimeStat";
import { PingHistorySection } from "@/components/pings/PingHistorySection";

export const MonitorDetailPage = ({ monitor }: { monitor: Monitor }) => (
  <div>
    {/* Header */}
    <div className="flex items-center gap-3 mb-8">
      <StatusBadge status={monitor.status} />
      <div>
        <h1 className="text-2xl font-bold">{monitor.name}</h1>
        <p className="font-mono text-sm text-slate-500">{monitor.url}</p>
      </div>
    </div>

    {/* PingHistorySection is Client — cursor pagination requires client state */}
    <PingHistorySection monitorId={monitor.id} />
  </div>
);
```

**`PingHistorySection`** — **Client Component** with TanStack Query.

This is where TanStack Query earns its place. Cursor pagination is inherently client-side state — the cursor depends on what the user has already loaded, which lives in the browser, not on the server.

```tsx
// components/pings/PingHistorySection.tsx
"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pingsApi } from "@/lib/api/pings";
import { queryKeys } from "@/lib/query-keys";
import { LatencyChart } from "./LatencyChart";

export const PingHistorySection = ({ monitorId }: { monitorId: number }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: queryKeys.pings.byMonitor(monitorId),
      queryFn: ({ pageParam }) =>
        pingsApi.getByMonitorId(monitorId, { limit: 20, cursor: pageParam }),
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

  const allPings = data?.pages.flatMap((p) => p.pings) ?? [];

  if (isLoading) return <PingHistorySkeleton />;

  return (
    <div className="space-y-6">
      <UptimeStat uptime={data?.pages[0]?.uptime ?? 0} />
      <LatencyChart pings={allPings} />

      <div>
        <h2 className="text-lg font-semibold mb-3">Ping History</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Code</th>
              <th className="text-left py-2">Latency</th>
              <th className="text-left py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {allPings.map((ping) => (
              <tr key={ping.id} className="border-b border-slate-800/50">
                <td className="py-2">
                  <StatusDot status={ping.status} />
                </td>
                <td className="py-2 font-mono">{ping.response_code ?? "—"}</td>
                <td className="py-2">{ping.latency != null ? `${ping.latency}ms` : "—"}</td>
                <td className="py-2 text-slate-500">{formatRelativeTime(ping.checked_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-4 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
};
```

**`LatencyChart`** — **Client Component** because Recharts requires browser APIs:

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Ping } from "@/types/ping";

export const LatencyChart = ({ pings }: { pings: Ping[] }) => {
  // Show oldest first in the chart, newest first in the table
  const chartData = [...pings].reverse().map((p) => ({
    time: new Date(p.checked_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    latency: p.latency,   // null values create gaps in the line (down pings)
    status: p.status,
  }));

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Response Time</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis unit="ms" tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => value != null ? [`${value}ms`, "Latency"] : ["Timeout", "Status"]}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            connectNulls={false}   // gaps show where the site was down
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

---

## 8. Server Actions

Server Actions are Next.js functions that run on the server, called directly from Client Components. They replace the need for custom API routes for mutations, and they automatically revalidate server-rendered pages.

### Why Server Actions (not useMutation) for create/delete?

Because this project calls an **external API** (the Express backend), Server Actions act as a secure proxy:
- The auth cookie is read on the server — never exposed to the browser in the request
- After the mutation, `revalidatePath` triggers a fresh server fetch — the list updates without a separate invalidation step
- The Client Component calls a function, not a URL — simpler, type-safe

### Create Monitor

```typescript
// app/actions/monitor.actions.ts
"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createMonitorSchema } from "@/lib/schemas/monitor.schema";
import type { Monitor } from "@/types/monitor";
import type { ApiResponse } from "@/types/api";

export async function createMonitorAction(formData: {
  name: string;
  url: string;
  telegram_chat_id?: string;
}): Promise<{ success: boolean; error?: string; monitor?: Monitor }> {
  // Validate on the server too — never trust client-only validation
  const parsed = createMonitorSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const token = cookies().get("auth_token")?.value;

  const res = await fetch(`${process.env.API_URL}/api/v1/monitors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `auth_token=${token}`,
    },
    body: JSON.stringify(parsed.data),
  });

  const body: ApiResponse<Monitor> = await res.json();

  if (!res.ok) {
    return { success: false, error: body.message };
  }

  // Re-runs the server fetch in /dashboard — list updates automatically
  revalidatePath("/dashboard");
  return { success: true, monitor: body.result ?? undefined };
}
```

### Delete Monitor

```typescript
export async function deleteMonitorAction(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const token = cookies().get("auth_token")?.value;

  const res = await fetch(`${process.env.API_URL}/api/v1/monitors/${id}`, {
    method: "DELETE",
    headers: { Cookie: `auth_token=${token}` },
  });

  if (!res.ok) {
    const body = await res.json();
    return { success: false, error: body.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
```

### Using a Server Action with useOptimistic in MonitorCard

```tsx
"use client";
import { useOptimistic, useTransition } from "react";
import { deleteMonitorAction } from "@/app/actions/monitor.actions";
import type { Monitor } from "@/types/monitor";

// MonitorCard receives the full list so useOptimistic can operate on it.
// This is lifted to MonitorGrid so the whole grid can optimistically update.
export const MonitorGrid = ({ monitors }: { monitors: Monitor[] }) => {
  const [optimisticMonitors, removeOptimistic] = useOptimistic(
    monitors,
    (current, id: number) => current.filter((m) => m.id !== id),
  );
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    startTransition(async () => {
      removeOptimistic(id);             // instant UI removal
      await deleteMonitorAction(id);    // server mutation + revalidatePath
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {optimisticMonitors.map((monitor) => (
        <MonitorCard key={monitor.id} monitor={monitor} onDelete={handleDelete} />
      ))}
    </div>
  );
};
```

### Auth Server Actions (cookie management)

```typescript
// app/actions/auth.actions.ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setTokenCookieAction(token: string) {
  cookies().set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function logoutAction() {
  cookies().delete("auth_token");
  redirect("/login");
}
```

---

## 9. API Client Layer

### Axios instance

```typescript
// lib/api/client.ts
import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Redirect to /login on 401 (token expired)
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (typeof window !== "undefined" && error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
```

### Monitor API (used by Server Actions and server fetches)

The server-side fetches use raw `fetch()` with the cookie forwarded. The client-side Axios instance is used only from Client Components (ping history).

```typescript
// lib/api/monitors.ts
import type { ApiResponse } from "@/types/api";
import type { Monitor } from "@/types/monitor";

// Called from Server Components and Server Actions
export const monitorsApi = {
  getAll: async (token?: string): Promise<Monitor[]> => {
    const res = await fetch(`${process.env.API_URL}/api/v1/monitors`, {
      headers: { Cookie: `auth_token=${token}` },
      next: { tags: ["monitors"] }, // cache tag for revalidateTag if needed
    });
    if (!res.ok) return [];
    const body: ApiResponse<Monitor[]> = await res.json();
    return body.result ?? [];
  },

  getById: async (id: string, token?: string): Promise<Monitor | null> => {
    const res = await fetch(`${process.env.API_URL}/api/v1/monitors/${id}`, {
      headers: { Cookie: `auth_token=${token}` },
    });
    if (!res.ok) return null;
    const body: ApiResponse<Monitor> = await res.json();
    return body.result ?? null;
  },
};
```

### Ping API (used by Client Components)

```typescript
// lib/api/pings.ts — called from Client Components only
import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type { PingHistoryResponse } from "@/types/ping";

export const pingsApi = {
  getByMonitorId: async (
    monitorId: number,
    params: { limit?: number; cursor?: number },
  ): Promise<PingHistoryResponse> => {
    const res = await apiClient.get<ApiResponse<PingHistoryResponse>>(
      `/monitors/${monitorId}/pings`,
      { params },
    );
    return res.data.result!;
  },
};
```

---

## 10. API Contract — Every Request & Response

This section is the single source of truth for API integration. Every field name, every status code, and every exact error message string is taken directly from the backend source code.

### Universal response envelope

Every single response from the API — success or error — uses this shape:

```typescript
// Success
{
  "type": "RESULT",
  "message": "OK",
  "result": { ... },   // the actual data
  "error": null
}

// Error
{
  "type": "ERROR",
  "message": "Human readable error message",  // exact string shown below per endpoint
  "result": null,
  "error": null
}
```

**Never read `message` to determine success.** Always check `type === "RESULT"` or the HTTP status code. The `message` field on errors is safe to display to the user as-is — it is intentionally human-readable and never exposes internals.

### Rate limit response (429)

All auth endpoints (register, login, resend-verification) have a stricter rate limit: **10 requests per 15 minutes per IP**. All other endpoints: **100 requests per 15 minutes per IP**.

```json
{
  "type": "ERROR",
  "message": "Too many authentication attempts, please try again later",
  "result": null,
  "error": null
}
```

---

### `POST /api/v1/auth/register`

**Headers:** `Content-Type: application/json`  
**Auth required:** No

**Request body:**
```json
{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "password": "Secret123"
}
```

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "user": {
      "id": 1,
      "email": "jane@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "is_email_verified": false
    },
    "message": "Account created. Please check your email to verify your account before logging in."
  },
  "error": null
}
```

> `is_email_verified` will always be `false` here. The user must click the link in their email before they can log in.

**Errors:**

| Status | `message` | When |
|---|---|---|
| `400` | e.g. `"Password must be at least 8 characters"` | Any Zod validation rule fails |
| `409` | `"Email already in use"` | That email is already registered |
| `429` | `"Too many authentication attempts, please try again later"` | Rate limit hit |

---

### `POST /api/v1/auth/login`

**Headers:** `Content-Type: application/json`  
**Auth required:** No

**Request body:**
```json
{
  "email": "jane@example.com",
  "password": "Secret123"
}
```

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "user": {
      "id": 1,
      "email": "jane@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "is_email_verified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqYW5lQGV4YW1wbGUuY29tIn0.signature"
  },
  "error": null
}
```

> Store this `token` by passing it to the `setTokenCookieAction` Server Action. Never put it in `localStorage`. The token expires in **7 days**.

**Errors:**

| Status | `message` | When |
|---|---|---|
| `400` | e.g. `"Invalid email format"` | Validation fails |
| `401` | `"Invalid email or password"` | Wrong credentials (same message whether email or password is wrong — intentional) |
| `403` | `"Please verify your email before logging in. Check your inbox or request a new link."` | Correct credentials but email not verified |
| `429` | `"Too many authentication attempts, please try again later"` | Rate limit |

---

### `GET /api/v1/auth/verify-email`

**Auth required:** No  
**Query param:** `token` (string, required) — taken from the email link

**Example request:**
```
GET /api/v1/auth/verify-email?token=a3f8c2e1d4b5...64hexchars
```

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "message": "Email verified successfully. You can now log in."
  },
  "error": null
}
```

**Errors:**

| Status | `message` | When |
|---|---|---|
| `400` | `"Verification token is required"` | No `?token=` in URL |
| `400` | `"Invalid or expired verification link"` | Token not found in DB |
| `400` | `"Verification link has expired. Please request a new one."` | Token found but `expires_at` is in the past (tokens expire after 24 hours) |

---

### `POST /api/v1/auth/resend-verification`

**Headers:** `Content-Type: application/json`  
**Auth required:** No

**Request body:**
```json
{
  "email": "jane@example.com"
}
```

**Success `200`** (same message whether the email exists or not — intentional to prevent account enumeration):
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "message": "If that email is registered and unverified, a new link has been sent."
  },
  "error": null
}
```

**Errors:**

| Status | `message` | When |
|---|---|---|
| `400` | `"Invalid email format"` | Validation |
| `400` | `"This email is already verified."` | Email exists and is already verified |
| `429` | `"Too many authentication attempts, please try again later"` | Rate limit |

---

### `POST /api/v1/monitors`

**Headers:** `Content-Type: application/json`  
**Auth required:** Yes (httpOnly cookie `auth_token`)

**Request body:**
```json
{
  "name": "Production API",
  "url": "https://api.example.com/health",
  "telegram_chat_id": "-1001234567890"
}
```

> `telegram_chat_id` is optional. Omit the field entirely or pass `undefined` — do not send `null` or an empty string.

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "id": 7,
    "user_id": 1,
    "name": "Production API",
    "url": "https://api.example.com/health",
    "interval": 5,
    "status": "pending",
    "telegram_chat_id": "-1001234567890",
    "created_at": "2026-05-18T10:00:00.000Z",
    "updated_at": "2026-05-18T10:00:00.000Z"
  },
  "error": null
}
```

> `status` is always `"pending"` on creation. The cron job will flip it to `"up"` or `"down"` on its next run.  
> `interval` is always `5` (minutes) — not configurable in the current version.  
> `telegram_chat_id` is `null` when not provided.

**Errors:**

| Status | `message` | When |
|---|---|---|
| `400` | e.g. `"Invalid URL format"` | Validation |
| `401` | `"Authentication required"` | No token cookie |
| `401` | `"Invalid or expired token"` | Token expired or tampered |
| `409` | `"You are already monitoring this URL"` | This user already has a monitor for this exact URL |
| `429` | `"Too many requests, please try again later"` | General rate limit |

---

### `GET /api/v1/monitors`

**Auth required:** Yes

**No request body or query params.**

**Success `200`** — returns newest monitors first:
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": [
    {
      "id": 8,
      "user_id": 1,
      "name": "Staging",
      "url": "https://staging.example.com",
      "interval": 5,
      "status": "down",
      "telegram_chat_id": null,
      "created_at": "2026-05-18T09:00:00.000Z",
      "updated_at": "2026-05-18T10:00:00.000Z"
    },
    {
      "id": 7,
      "user_id": 1,
      "name": "Production API",
      "url": "https://api.example.com/health",
      "interval": 5,
      "status": "up",
      "telegram_chat_id": "-1001234567890",
      "created_at": "2026-05-18T08:00:00.000Z",
      "updated_at": "2026-05-18T10:00:00.000Z"
    }
  ],
  "error": null
}
```

**When the user has no monitors:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": [],
  "error": null
}
```

**Errors:**

| Status | `message` | When |
|---|---|---|
| `401` | `"Authentication required"` | No token |
| `401` | `"Invalid or expired token"` | Bad token |

---

### `DELETE /api/v1/monitors/:id`

**Auth required:** Yes  
**No request body.**

**Example:**
```
DELETE /api/v1/monitors/7
```

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "deleted": true
  },
  "error": null
}
```

> All ping records for this monitor are **automatically deleted** by the database cascade. No separate cleanup needed.

**Errors:**

| Status | `message` | When |
|---|---|---|
| `401` | `"Authentication required"` | No token |
| `404` | `"Monitor not found"` | ID doesn't exist **or** the monitor belongs to a different user (intentional — IDOR protection) |

---

### `GET /api/v1/monitors/:monitorId/pings`

**Auth required:** Yes

**Query params:**

| Param | Type | Default | Max | Description |
|---|---|---|---|---|
| `limit` | number | `20` | `100` | How many pings per page |
| `cursor` | number | — | — | The `id` of the last ping from the previous page. Omit for the first page. |

**First page:**
```
GET /api/v1/monitors/7/pings?limit=20
```

**Success `200`:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "pings": [
      {
        "id": 540,
        "monitor_id": 7,
        "status": "up",
        "latency": 142,
        "response_code": 200,
        "checked_at": "2026-05-18T10:01:00.000Z"
      },
      {
        "id": 539,
        "monitor_id": 7,
        "status": "down",
        "latency": null,
        "response_code": null,
        "checked_at": "2026-05-18T10:00:00.000Z"
      }
    ],
    "uptime": 99.50,
    "nextCursor": 521
  },
  "error": null
}
```

> `latency` and `response_code` are **`null`** when the host was unreachable or timed out (status `"down"`).  
> `uptime` is a float (e.g. `99.50`) — the percentage of `"up"` pings among the last 100 checks. Returns `0` when there are no pings yet.  
> `nextCursor` is the `id` of the last ping in the current page. Pass it as `?cursor=521` in the next request. When `nextCursor` is `null`, you have reached the last page.

**Next page:**
```
GET /api/v1/monitors/7/pings?limit=20&cursor=521
```

**Last page (`nextCursor` is `null`):**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "pings": [ { "id": 501, ... }, { "id": 500, ... } ],
    "uptime": 99.50,
    "nextCursor": null
  },
  "error": null
}
```

**Brand new monitor — no pings yet:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "pings": [],
    "uptime": 0,
    "nextCursor": null
  },
  "error": null
}
```

**Errors:**

| Status | `message` | When |
|---|---|---|
| `401` | `"Authentication required"` | No token |
| `404` | `"Monitor not found"` | Monitor doesn't exist or belongs to another user |

---

### How to handle errors on the client

Parse errors consistently in one place — the Axios interceptor or a wrapper function:

```typescript
// lib/api/handle-error.ts
import axios from "axios";

export interface ApiError {
  status: number;
  message: string;
}

export const extractApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status ?? 0,
      message: error.response?.data?.message ?? "Something went wrong",
    };
  }
  return { status: 0, message: "Something went wrong" };
};
```

Usage in a form:
```typescript
try {
  await someApiCall();
} catch (error) {
  const { status, message } = extractApiError(error);
  if (status === 409) {
    setError("url", { message });   // show under the URL field
  } else {
    setGlobalError(message);         // show as a top-level alert
  }
}
```

---

## 11. Frontend Validation Schemas (Exact Match to Backend)

These schemas are **copied exactly from the backend source code**. If the backend changes a rule (e.g. minimum password length), update both files.

The backend uses **Zod v4**. Install the same version on the frontend:
```bash
npm install zod@^4
```

---

### `lib/schemas/auth.schema.ts`

```typescript
import { z } from "zod";

// Mirrors: src/schemas/auth.schema.ts (backend)
export const registerSchema = z.object({
  email: z.email("Invalid email format"),
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const resendVerificationSchema = z.object({
  email: z.email("Invalid email format"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
```

---

### `lib/schemas/monitor.schema.ts`

```typescript
import { z } from "zod";

// Mirrors: src/schemas/monitor.schema.ts (backend)
export const createMonitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  url: z.url("Invalid URL format"),
  telegram_chat_id: z.string().max(255).optional(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
```

---

### `types/api.ts` — Full TypeScript types

```typescript
// Universal response envelope
export interface ApiResponse<T> {
  type: "RESULT" | "ERROR";
  message: string;
  result: T | null;
  error: null;
}

// Auth
export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
}

export interface RegisterResponse {
  user: AuthUser;
  message: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export interface MessageResponse {
  message: string;
}

// Monitors
export interface Monitor {
  id: number;
  user_id: number;
  name: string;
  url: string;
  interval: number;
  status: "up" | "down" | "pending";
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeleteResponse {
  deleted: true;
}

// Pings
export interface Ping {
  id: number;
  monitor_id: number;
  status: "up" | "down";
  latency: number | null;
  response_code: number | null;
  checked_at: string;
}

export interface PingHistoryResponse {
  pings: Ping[];
  uptime: number;        // float, e.g. 99.50
  nextCursor: number | null;
}
```

---

### Typed API client functions

With the types above, wire up fully typed API calls:

```typescript
// lib/api/auth.ts
import { apiClient } from "./client";
import type { ApiResponse, RegisterResponse, LoginResponse, MessageResponse } from "@/types/api";
import type { RegisterInput, LoginInput, ResendVerificationInput } from "@/lib/schemas/auth.schema";

export const authApi = {
  register: async (data: RegisterInput): Promise<RegisterResponse> => {
    const res = await apiClient.post<ApiResponse<RegisterResponse>>("/auth/register", data);
    return res.data.result!;
  },

  login: async (data: LoginInput): Promise<LoginResponse> => {
    const res = await apiClient.post<ApiResponse<LoginResponse>>("/auth/login", data);
    return res.data.result!;
  },

  verifyEmail: async (token: string): Promise<MessageResponse> => {
    const res = await apiClient.get<ApiResponse<MessageResponse>>("/auth/verify-email", {
      params: { token },
    });
    return res.data.result!;
  },

  resendVerification: async (data: ResendVerificationInput): Promise<MessageResponse> => {
    const res = await apiClient.post<ApiResponse<MessageResponse>>(
      "/auth/resend-verification",
      data,
    );
    return res.data.result!;
  },
};
```

```typescript
// lib/api/monitors.ts  (client-side version — called from Client Components)
import { apiClient } from "./client";
import type { ApiResponse, Monitor, DeleteResponse } from "@/types/api";
import type { CreateMonitorInput } from "@/lib/schemas/monitor.schema";

export const monitorsClientApi = {
  getAll: async (): Promise<Monitor[]> => {
    const res = await apiClient.get<ApiResponse<Monitor[]>>("/monitors");
    return res.data.result ?? [];
  },

  create: async (data: CreateMonitorInput): Promise<Monitor> => {
    const res = await apiClient.post<ApiResponse<Monitor>>("/monitors", data);
    return res.data.result!;
  },

  delete: async (id: number): Promise<DeleteResponse> => {
    const res = await apiClient.delete<ApiResponse<DeleteResponse>>(`/monitors/${id}`);
    return res.data.result!;
  },
};
```

```typescript
// lib/api/pings.ts  (always client-side — cursor pagination requires client state)
import { apiClient } from "./client";
import type { ApiResponse, PingHistoryResponse } from "@/types/api";

export const pingsApi = {
  getByMonitorId: async (
    monitorId: number,
    params: { limit?: number; cursor?: number },
  ): Promise<PingHistoryResponse> => {
    const res = await apiClient.get<ApiResponse<PingHistoryResponse>>(
      `/monitors/${monitorId}/pings`,
      { params },
    );
    return res.data.result!;
  },
};
```

---

## 12. Authentication Flow

### Token storage: httpOnly cookie

The token never touches `localStorage` or client JavaScript. The login flow is:

```
LoginPage (Client Component)
    │
    ├─ Axios: POST /api/v1/auth/login
    │
    ├─ On success: call setTokenCookieAction(token)   ← Server Action
    │                sets httpOnly cookie server-side
    │
    └─ redirect("/dashboard")
```

### Full register → verify → login sequence

```
/register
  └─ RegisterPage submits → POST /auth/register
       ├─ 409: "Email already in use"
       └─ 200: redirect /login?registered=true

/login (with registered=true banner: "Check your inbox")
  └─ User checks email, clicks verification link

/verify-email?token=abc123
  └─ VerifyEmailPage fires on mount → GET /auth/verify-email?token=abc123
       ├─ 400: expired/invalid → show error + resend form
       └─ 200: show ✅ + [Go to Login] button

/login
  └─ LoginPage submits → POST /auth/login
       ├─ 403: unverified → show resend verification link
       ├─ 401: wrong credentials
       └─ 200: setTokenCookieAction(token) → redirect /dashboard
```

### Logout

```tsx
// Logout button in Sidebar
import { logoutAction } from "@/app/actions/auth.actions";

<form action={logoutAction}>
  <button type="submit">Log out</button>
</form>
```

Using a `<form>` with `action={serverAction}` is the Next.js native pattern. No `onClick`, no API call, no client-side redirect.

---

## 13. Route Protection

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/verify-email"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token");
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!token && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

Middleware only verifies that the cookie **exists** — not that the JWT is valid. The API validates the signature. If the token is expired, the API returns 401, the Axios interceptor catches it, and redirects to `/login`.

---

## 14. Forms & Validation Wiring

The schemas are already defined in Section 11. This section shows how to wire them into React Hook Form.

```typescript
// lib/schemas/monitor.schema.ts
import { z } from "zod";

export const createMonitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  url: z.url("Invalid URL — must include https://"),
  telegram_chat_id: z.string().max(255).optional(),
});
```

```tsx
// components/monitors/AddMonitorDialog.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createMonitorSchema } from "@/lib/schemas/monitor.schema";
import { createMonitorAction } from "@/app/actions/monitor.actions";
import { useUIStore } from "@/lib/stores/ui.store";

export const AddMonitorDialog = () => {
  const { isAddMonitorOpen, setAddMonitorOpen } = useUIStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setError } =
    useForm({ resolver: zodResolver(createMonitorSchema) });

  const onSubmit = async (data: CreateMonitorInput) => {
    const result = await createMonitorAction(data);
    if (!result.success) {
      setError("url", { message: result.error });
      return;
    }
    reset();
    setAddMonitorOpen(false);
    // No manual refetch needed — revalidatePath inside the Server Action handles it
  };

  return (
    <Dialog open={isAddMonitorOpen} onOpenChange={setAddMonitorOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setAddMonitorOpen(true)}>+ Add Monitor</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label>Name</label>
            <Input {...register("name")} placeholder="Production API" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label>URL</label>
            <Input {...register("url")} placeholder="https://api.example.com/health" />
            {errors.url && <p className="text-red-500 text-xs mt-1">{errors.url.message}</p>}
          </div>
          <div>
            <label>Telegram Chat ID <span className="text-slate-500">(optional)</span></label>
            <Input {...register("telegram_chat_id")} placeholder="-1001234567890" />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Adding..." : "Add Monitor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 15. Project Setup Instructions

```bash
# 1. Create project
npx create-next-app@latest uptime-frontend \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd uptime-frontend

# 2. Install dependencies
npm install \
  @tanstack/react-query @tanstack/react-query-devtools \
  zustand axios \
  react-hook-form @hookform/resolvers zod \
  recharts next-themes lucide-react \
  clsx tailwind-merge

# 3. Set up shadcn/ui
npx shadcn-ui@latest init
# Style: Default | Base color: Slate | CSS variables: yes

# 4. Add components you will need
npx shadcn-ui@latest add \
  button card dialog dropdown-menu \
  tooltip badge input label form skeleton alert

# 5. Environment variables
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL=http://localhost:3001' > .env.local
```

**Important:** Two env vars for the API URL:
- `NEXT_PUBLIC_API_URL` — used by the Axios client in the browser (Client Components)
- `API_URL` — used by Server Components and Server Actions (never exposed to the browser)

### Update the backend CORS origin

In the Express backend `.env.local`, change:
```
CORS_ORIGIN="http://localhost:3000"
```
Next.js runs on port 3000 by default. Without this, credentialed cookie requests will be blocked.

### TanStack Query Provider

```tsx
// components/layout/Providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        {children}
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};
```

```tsx
// app/layout.tsx
import { Providers } from "@/components/layout/Providers";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## Quick Reference

### When to use what

| Need | Tool |
|---|---|
| Initial data display | Server Component + `fetch()` with forwarded cookie |
| Live status updates (no user action) | `<LiveRefresh />` + `router.refresh()` |
| Create / Delete / Update | Server Action + `revalidatePath` |
| Instant feedback on delete | `useOptimistic` before Server Action |
| Cursor pagination (user-driven) | TanStack Query `useInfiniteQuery` |
| Browser-only library (Recharts) | Client Component |
| Dialog / sidebar open state | Zustand |
| Form with validation | React Hook Form + Zod |

### Backend endpoints

| Method | Path | Auth | Used by |
|---|---|---|---|
| `POST` | `/auth/register` | No | RegisterPage (client) |
| `POST` | `/auth/login` | No | LoginPage (client) |
| `GET` | `/auth/verify-email?token=` | No | VerifyEmailPage (client) |
| `POST` | `/auth/resend-verification` | No | LoginPage / VerifyEmailPage (client) |
| `POST` | `/monitors` | Yes | createMonitorAction (server) |
| `GET` | `/monitors` | Yes | monitorsApi.getAll (server) |
| `DELETE` | `/monitors/:id` | Yes | deleteMonitorAction (server) |
| `GET` | `/monitors/:id/pings?cursor=` | Yes | pingsApi.getByMonitorId (client) |
