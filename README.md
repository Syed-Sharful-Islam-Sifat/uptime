# Uptime Monitor

A production-grade backend REST API that watches your websites 24/7, records their health over time, and fires instant Telegram alerts the moment something goes down — and again when it recovers.

---

## Table of Contents

1. [What This Application Does](#1-what-this-application-does)
2. [What a User Can Expect](#2-what-a-user-can-expect)
3. [Tech Stack & Why Each Piece Was Chosen](#3-tech-stack--why-each-piece-was-chosen)
4. [Database Schema](#4-database-schema)
5. [Project Structure](#5-project-structure)
6. [Architecture Overview](#6-architecture-overview)
7. [Request-to-Response: Every Feature Explained](#7-request-to-response-every-feature-explained)
   - [Register](#71-register)
   - [Login](#72-login)
   - [Create a Monitor](#73-create-a-monitor)
   - [List Monitors](#74-list-monitors)
   - [Delete a Monitor](#75-delete-a-monitor)
   - [Get Ping History](#76-get-ping-history)
   - [Background Ping Job (Cron)](#77-background-ping-job-cron)
   - [Telegram Alerts](#78-telegram-alerts)
8. [Security Design](#8-security-design)
9. [Error Handling Strategy](#9-error-handling-strategy)
10. [Performance Decisions](#10-performance-decisions)
11. [Environment Variables](#11-environment-variables)
12. [Running the Project](#12-running-the-project)
13. [API Reference](#13-api-reference)

---

## 1. What This Application Does

Most developers deploy a website and then find out it went down from a user complaint — hours after the fact. This application solves that.

You register an account, add URLs you want to watch (your API, your frontend, your payment page), and the system takes over. Every minute it fires an HTTP request at each of your URLs and records exactly what happened: was it reachable? How fast did it respond? What HTTP status code came back?

If a URL goes down, you get a Telegram message within 60 seconds. When it comes back up, you get another message so you know the incident is over. You can also query the full ping history for any monitor and see an uptime percentage calculated from the last 100 checks.

The system is multi-tenant — every user only sees and manages their own monitors. There is no way for one user to read or interfere with another user's data.

---

## 2. What a User Can Expect

### Registration & Login
- Create an account with email, first name, last name, and a password (minimum 8 characters, must contain at least one uppercase letter and one digit).
- Log in to receive a JWT token. Every subsequent request must carry this token in the `Authorization: Bearer <token>` header.
- The token lasts 7 days. No refresh token flow is required — just log in again when it expires.

### Managing Monitors
- Add any publicly reachable URL to be monitored. The system pings it every minute.
- Optionally attach a Telegram Chat ID to the monitor so alerts are sent directly to you (or your team's group chat).
- A newly created monitor starts in `pending` status. It transitions to `up` or `down` on its first successful cron evaluation (note: only monitors already in `up` status are pinged by the cron — the initial status change from `pending → up/down` requires the first explicit ping via the job scheduler's evaluation loop, which currently targets `up` monitors; this is a known area for future improvement).
- You can delete a monitor at any time. All associated ping records are deleted automatically via cascade.

### Viewing History & Uptime
- Query the ping history for any of your monitors.
- Pagination is cursor-based — you receive a `nextCursor` value with each response; pass it in the next request to get the next page. This is safe to use on millions of rows without performance degradation.
- Each response also includes the uptime percentage calculated over the last 100 pings.

### Alerts
- Down alert: fires once when a monitor transitions from `up → down`.
- Recovery alert: fires once when a monitor transitions from `down → up`.
- Alerts are state-transition-based, not repetitive — you will not be spammed if a site stays down for hours.

---

## 3. Tech Stack & Why Each Piece Was Chosen

| Technology | Role | Reason |
|---|---|---|
| **Node.js + TypeScript** | Runtime & language | Async I/O is ideal for concurrent HTTP pings; TypeScript catches entire classes of bugs at compile time |
| **Express v5** | HTTP framework | Mature, minimal, synchronous throws are now auto-caught (no need to wrap every handler in try/catch) |
| **PostgreSQL** | Primary database | ACID transactions, `ON DELETE CASCADE`, partial indexes, and `NULLIF`/`FILTER` aggregate syntax all used directly |
| **`pg` (node-postgres)** | DB driver | Connection pooling built in; raw SQL gives full control over query shape and index usage |
| **`node-cron`** | Job scheduler | Runs the ping loop on a standard cron expression inside the same process |
| **`jsonwebtoken`** | Auth tokens | Stateless JWT; no session store needed |
| **`bcryptjs`** | Password hashing | Pure-JS bcrypt with configurable work factor (12 rounds); no native compilation required |
| **`zod` v4** | Validation & parsing | Schema-first validation; transforms and sanitizes `req.body` before it reaches any business logic |
| **`express-rate-limit`** | Rate limiting | Protects auth endpoints from brute-force; global limiter defends all routes |
| **`@sentry/node`** | Error monitoring | Captures unexpected exceptions in production without exposing internals to the caller |
| **`helmet`** | HTTP security headers | Sets `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc. in one line |
| **`cors`** | CORS policy | Restricts which origins can call the API |
| **`pino` + `pino-http`** | Structured logging | JSON logs in production (machine-readable); pretty-printed in development; every request gets a UUID |

---

## 4. Database Schema

### Overview

```
users ──< monitors ──< pings
```

One user owns many monitors. Each monitor accumulates many pings over time. Deletion cascades downward — deleting a user removes their monitors; deleting a monitor removes its pings.

---

### Table: `users`

```sql
CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL UNIQUE,
  first_name        VARCHAR(255) NOT NULL,
  last_name         VARCHAR(255) NOT NULL,
  password_hash     TEXT NOT NULL,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` | Auto-incrementing primary key. Also used in the JWT payload. |
| `email` | `VARCHAR(255)` | `UNIQUE` constraint; implicit B-tree index created by Postgres. Login key. |
| `password_hash` | `TEXT` | bcrypt hash (60 chars). **Never returned in any API response.** |
| `is_email_verified` | `BOOLEAN` | Defaults `FALSE`. Email verification flow is a planned feature. |
| `created_at / updated_at` | `TIMESTAMP` | Server-set at insert time via `NOW()`. |

**Why no index on `email` explicitly?** The `UNIQUE` constraint causes Postgres to create a B-tree index automatically. Adding a second manual index would be redundant and waste write overhead.

---

### Table: `monitors`

```sql
CREATE TABLE IF NOT EXISTS monitors (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  url              VARCHAR(255) NOT NULL,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interval         INTEGER NOT NULL DEFAULT 5,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
  telegram_chat_id VARCHAR(255),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, url)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` | Primary key. Used as cursor in the batch ping job. |
| `name` | `VARCHAR(255)` | Human-readable label (e.g. "Production API"). |
| `url` | `VARCHAR(255)` | The URL that gets pinged every minute. |
| `user_id` | `INTEGER` | Foreign key → `users.id`. `ON DELETE CASCADE` means deleting a user removes all their monitors. |
| `interval` | `INTEGER` | Check interval in minutes. Currently hardcoded to `5` at insert time (cron runs every 1 min but this field is reserved for per-monitor frequency control). |
| `status` | `VARCHAR(50)` | `pending` (just created), `up` (last ping succeeded), `down` (last ping failed). |
| `telegram_chat_id` | `VARCHAR(255)` | Nullable. The Telegram chat or group ID to send alerts to. |

**`UNIQUE (user_id, url)`** — The same user cannot register the same URL twice. Two different users *can* watch the same URL independently. This constraint is enforced at the DB level, which is the only safe place — application-level checks have a TOCTOU race condition (two concurrent requests both pass the check, then both insert). When this constraint fires, Postgres returns error code `23505`, which the repository catches and converts to a clean `409 Conflict` response.

**Indexes on `monitors`:**

```sql
-- Fast lookup of all monitors belonging to a user (used by GET /monitors)
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);

-- Partial index: only indexes rows where status = 'up'
-- The cron job cursor scan (WHERE status = 'up' AND id > $lastId) hits this index only.
-- A full-column status index would be bad here — low cardinality (3 values) causes
-- Postgres to ignore it and do a seq scan. A partial index sidesteps that entirely.
CREATE INDEX IF NOT EXISTS idx_monitors_active_id ON monitors(id) WHERE status = 'up';
```

---

### Table: `pings`

```sql
CREATE TABLE IF NOT EXISTS pings (
  id            SERIAL PRIMARY KEY,
  monitor_id    INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status        VARCHAR(10) NOT NULL,
  latency       INTEGER,
  response_code INTEGER,
  checked_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` | Primary key. Also used as the pagination cursor — monotonically increasing, so `id < cursor ORDER BY id DESC` is a deterministic, index-friendly page boundary. |
| `monitor_id` | `INTEGER` | Foreign key → `monitors.id`. `ON DELETE CASCADE`. |
| `status` | `VARCHAR(10)` | `'up'` or `'down'`. |
| `latency` | `INTEGER` | Round-trip time in milliseconds. `NULL` if the host was unreachable or timed out. |
| `response_code` | `INTEGER` | HTTP status code (200, 404, 500, etc.). `NULL` if the request never completed. |
| `checked_at` | `TIMESTAMP` | When the ping was recorded. |

**Index on `pings`:**

```sql
-- Composite index: filter by monitor_id (equality), then page by id descending.
-- The order of columns matters: Postgres uses the leftmost column first.
-- Querying WHERE monitor_id = $1 AND id < $cursor hits this index perfectly.
CREATE INDEX IF NOT EXISTS idx_pings_monitor_id_id ON pings(monitor_id, id DESC);
```

**Why `id` as cursor and not `checked_at`?** `id` is guaranteed unique and strictly monotonically increasing. `checked_at` could have duplicate values if two pings land in the same millisecond, making cursor boundaries ambiguous. Using `id` is safer and the index on `(monitor_id, id DESC)` is already optimal for this access pattern.

---

## 5. Project Structure

```
src/
├── server.ts               # Entry point — init Sentry, start HTTP server, connect DB, start cron
├── app.ts                  # Express setup — middleware stack, routes, global error handler
│
├── config/
│   ├── env.ts              # Zod-validated environment variables (fails fast on bad config)
│   ├── database.ts         # pg connection pool
│   ├── sentry.ts           # Sentry init (no-ops gracefully if SENTRY_DSN is empty)
│   └── logger.ts           # (reserved)
│
├── db/
│   └── migrations/
│       ├── 001_create_users.sql
│       ├── 002_create_monitors.sql
│       ├── 003_add_chat_id.sql
│       ├── 004_create_pings.sql
│       ├── 005_add_indexes.sql
│       └── migrate.ts      # Migration runner (reads .sql files in order, safe to re-run)
│
├── middleware/
│   ├── auth.middleware.ts  # JWT verification → sets req.user
│   ├── validate.ts         # Zod schema middleware → sanitizes req.body
│   ├── rateLimiter.ts      # generalLimiter (all routes) + authLimiter (login/register)
│   ├── apiMiddleWare.ts    # Wraps async handlers; formats success/error responses
│   └── requestLogger.ts    # Pino HTTP logger + request ID injection
│
├── schemas/
│   ├── auth.schema.ts      # Zod schemas for register and login
│   └── monitor.schema.ts   # Zod schema for create monitor
│
├── models/
│   ├── user.ts             # TypeScript interface for User row
│   ├── monitor.ts          # TypeScript interface for Monitor row + CreateMonitorDTO
│   └── ping.ts             # TypeScript interface for Ping row
│
├── repositories/
│   ├── user.repository.ts    # SQL for users table
│   ├── monitor.repository.ts # SQL for monitors table
│   └── ping.repository.ts    # SQL for pings table
│
├── services/
│   ├── auth.service.ts     # Register + login business logic (hashing, token generation)
│   ├── monitor.service.ts  # Monitor CRUD + IDOR enforcement
│   └── ping.service.ts     # HTTP health check logic + alert logic + ping history API
│
├── controller/
│   ├── auth.controller.ts    # Calls auth service; returns result to apiMiddleWare
│   ├── monitor.controller.ts # Calls monitor service
│   └── ping.controller.ts    # Parses cursor/limit query params; calls ping service
│
├── routes/
│   ├── index.ts              # Mounts all sub-routers under /api/v1
│   ├── auth.routes.ts        # POST /auth/register, POST /auth/login
│   ├── monitor.routes.ts     # GET/POST /monitors, DELETE /monitors/:id
│   └── ping.routes.ts        # GET /monitors/:monitorId/pings
│
├── jobs/
│   └── ping.job.ts           # node-cron scheduler; cursor-batched ping execution
│
├── lib/
│   ├── helper/HttpError.ts   # Custom error class with statusCode
│   └── telegram/telegraam.ts # Telegram Bot API client
│
└── types/
    └── express.d.ts          # Augments Express Request to include req.user
```

---

## 6. Architecture Overview

### Layered Architecture

Every HTTP request travels through exactly the same sequence of layers:

```
HTTP Request
    │
    ▼
[ Rate Limiter ]           ← express-rate-limit (per-IP sliding window)
    │
    ▼
[ Request Logger ]         ← Pino attaches X-Request-Id UUID to every request
    │
    ▼
[ Route Match ]            ← Express router (Express v5)
    │
    ▼
[ Auth Middleware ]         ← Verifies JWT, populates req.user (on protected routes)
    │
    ▼
[ Validate Middleware ]     ← Zod parses + sanitizes req.body (on write routes)
    │
    ▼
[ apiMiddleWare wrapper ]   ← Calls the controller, catches errors, formats response
    │
    ▼
[ Controller ]             ← Extracts params from req, delegates to service
    │
    ▼
[ Service ]                ← Business rules, IDOR checks, orchestrates repositories
    │
    ▼
[ Repository ]             ← Parameterized SQL queries against the pg pool
    │
    ▼
[ PostgreSQL ]             ← Data storage
    │
    ▼
[ Controller returns data ]
    │
    ▼
[ apiMiddleWare serializes ]  → { type, message, result, error }
    │
    ▼
HTTP Response
```

### Background Architecture (Cron)

Running in parallel to the HTTP server is a `node-cron` job that fires every minute. It has no HTTP interface — it talks directly to the repository and ping service layers:

```
node-cron tick (every 60s)
    │
    ▼
[ ping.job.ts ]
    │  cursor-based batch loop (100 monitors at a time)
    ▼
[ MonitorRepository.findActiveBatch ]   ← WHERE status='up' AND id > lastId
    │
    ▼
[ Promise.allSettled(...) ]             ← all monitors in the batch pinged concurrently
    │
    ▼
[ PingService.pingMonitor (per monitor) ]
    │
    ├── fetch(monitor.url, { timeout: 10s })
    │
    ├── Promise.all([
    │     PingRepository.findLastByMonitorId,   ← last ping (for state comparison)
    │     PingRepository.create                 ← store new result
    │   ])
    │
    └── Telegram alert if state changed (up→down or down→up)
```

---

## 7. Request-to-Response: Every Feature Explained

### 7.1 Register

**Endpoint:** `POST /api/v1/auth/register`

**Request body:**
```json
{
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "password": "Secret123"
}
```

**Full flow:**

```
POST /api/v1/auth/register
    │
    ├─ authLimiter
    │     Max 10 requests per 15 min per IP.
    │     Protects against automated account creation spam.
    │
    ├─ validate(registerSchema)
    │     Zod checks:
    │       - email: valid format
    │       - first_name / last_name: non-empty, max 100 chars
    │       - password: ≥8 chars, at least one uppercase, at least one digit
    │     On failure → next(HttpError 400) → global error handler → 400 JSON response
    │     On success → req.body is replaced with the parsed, sanitized object
    │
    ├─ apiMiddleWare(AuthController.register)
    │     Catches any thrown HttpError or unexpected error
    │
    └─ AuthService.register(req.body)
          │
          ├─ UserRepository.findByEmailWithPassword(email)
          │     SELECT id, email, password_hash ... WHERE email = $1
          │     If a row is returned → throw HttpError 409 "Email already in use"
          │
          ├─ bcrypt.hash(password, 12)
          │     12 rounds ≈ 250ms on modern hardware.
          │     Deliberately slow to make offline dictionary attacks impractical.
          │
          ├─ UserRepository.create({ email, first_name, last_name, password_hash })
          │     INSERT INTO users ... RETURNING id, email, first_name, last_name, is_email_verified
          │     Note: password_hash is NOT in the RETURNING clause — never in the response.
          │
          └─ jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "7d" })
                Returns { user: { id, email, first_name, last_name, is_email_verified }, token }
```

**Response (201):**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "user": { "id": 1, "email": "user@example.com", "first_name": "Jane", "last_name": "Doe", "is_email_verified": false },
    "token": "eyJ..."
  },
  "error": null
}
```

---

### 7.2 Login

**Endpoint:** `POST /api/v1/auth/login`

**Request body:**
```json
{ "email": "user@example.com", "password": "Secret123" }
```

**Full flow:**

```
POST /api/v1/auth/login
    │
    ├─ authLimiter (10 req / 15 min per IP)
    │
    ├─ validate(loginSchema)
    │     Zod checks email format + password non-empty
    │
    └─ AuthService.login(req.body)
          │
          ├─ UserRepository.findByEmailWithPassword(email)
          │
          ├─ TIMING ATTACK PROTECTION:
          │     If user not found, we still call bcrypt.compare(password, DUMMY_HASH).
          │     Without this, an attacker timing responses could detect valid emails:
          │       - "user not found" path returns in ~0ms
          │       - "wrong password" path returns in ~250ms (bcrypt cost)
          │     By always running bcrypt, both paths take ~250ms — email existence is not detectable.
          │
          ├─ If user not found OR bcrypt.compare returns false:
          │     throw HttpError 401 "Invalid email or password"
          │     (same message for both cases — no hint about which was wrong)
          │
          └─ jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "7d" })
                Returns { user: { ...without password_hash }, token }
```

---

### 7.3 Create a Monitor

**Endpoint:** `POST /api/v1/monitors`

**Headers:** `Authorization: Bearer <token>`

**Request body:**
```json
{
  "name": "Production API",
  "url": "https://api.myapp.com/health",
  "telegram_chat_id": "-1001234567890"
}
```

**Full flow:**

```
POST /api/v1/monitors
    │
    ├─ generalLimiter (100 req / 15 min per IP)
    │
    ├─ authenticate
    │     Reads Authorization header.
    │     Strips "Bearer " prefix.
    │     jwt.verify(token, JWT_SECRET):
    │       - Invalid / expired → HttpError 401
    │       - Valid → req.user = { id: 1, email: "user@example.com" }
    │
    ├─ validate(createMonitorSchema)
    │     Zod checks:
    │       - name: non-empty string, max 255
    │       - url: valid URL format (e.g., must have protocol)
    │       - telegram_chat_id: optional string, max 255
    │
    └─ MonitorService.create(req.body, req.user.id)
          │
          └─ MonitorRepository.create(data, userId)
                INSERT INTO monitors
                  (name, url, user_id, interval, status, telegram_chat_id, created_at, updated_at)
                VALUES ($1, $2, $3, 5, 'pending', $4, NOW(), NOW())
                RETURNING id, user_id, name, url, interval, status, telegram_chat_id, created_at, updated_at
                │
                ├─ If PG error code 23505 (unique violation on user_id+url):
                │     catch → throw HttpError 409 "You are already monitoring this URL"
                │     This is race-condition safe — the DB constraint is the only reliable gate.
                │
                └─ Returns the new monitor row
```

**Response (200):**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "id": 7,
    "user_id": 1,
    "name": "Production API",
    "url": "https://api.myapp.com/health",
    "interval": 5,
    "status": "pending",
    "telegram_chat_id": "-1001234567890",
    "created_at": "2026-05-18T10:00:00.000Z",
    "updated_at": "2026-05-18T10:00:00.000Z"
  },
  "error": null
}
```

---

### 7.4 List Monitors

**Endpoint:** `GET /api/v1/monitors`

**Headers:** `Authorization: Bearer <token>`

**Full flow:**

```
GET /api/v1/monitors
    │
    ├─ generalLimiter
    │
    ├─ authenticate → req.user.id = 1
    │
    └─ MonitorService.getAll(req.user.id)
          │
          └─ MonitorRepository.findAllByUserId(userId)
                SELECT id, user_id, name, url, interval, status, telegram_chat_id, created_at, updated_at
                FROM monitors
                WHERE user_id = $1
                ORDER BY created_at DESC
                │
                Uses index: idx_monitors_user_id ON monitors(user_id)
                Only returns monitors belonging to this user.
                A user with id=2 cannot see monitors belonging to user id=1.
```

---

### 7.5 Delete a Monitor

**Endpoint:** `DELETE /api/v1/monitors/:id`

**Headers:** `Authorization: Bearer <token>`

**Full flow:**

```
DELETE /api/v1/monitors/7
    │
    ├─ generalLimiter
    │
    ├─ authenticate → req.user.id = 1
    │
    └─ MonitorService.delete("7", req.user.id)
          │
          ├─ MonitorRepository.findById("7")
          │     SELECT ... FROM monitors WHERE id = $1
          │     If no row → throw HttpError 404 "Monitor not found"
          │
          ├─ IDOR CHECK:
          │     if (monitor.user_id !== userId)
          │       throw HttpError 404 "Monitor not found"   ← intentionally 404, not 403
          │
          │     WHY 404 instead of 403?
          │     If we return 403, we're confirming the resource exists.
          │     An attacker iterating monitor IDs (1, 2, 3, ...) could map out
          │     every monitor in the system by watching for 403 vs 404.
          │     Returning 404 in both cases makes the resource opaque.
          │
          └─ MonitorRepository.delete("7")
                DELETE FROM monitors WHERE id = $1
                Postgres CASCADE deletes all pings for this monitor automatically.
                Returns { deleted: true }
```

---

### 7.6 Get Ping History

**Endpoint:** `GET /api/v1/monitors/:monitorId/pings`

**Headers:** `Authorization: Bearer <token>`

**Query params:**
- `limit` — how many pings per page (default 20, max 100)
- `cursor` — the `id` of the last ping from the previous page (omit for first page)

**Full flow:**

```
GET /api/v1/monitors/7/pings?limit=20&cursor=540
    │
    ├─ generalLimiter
    │
    ├─ authenticate → req.user.id = 1
    │     Note: :monitorId = 7 is available via mergeParams: true on the ping router.
    │     The route is mounted as: router.use("/monitors/:monitorId/pings", pingRoutes)
    │
    └─ PingService.getPingsByMonitorId("7", userId=1, limit=20, cursor=540)
          │
          ├─ MonitorRepository.findById("7")
          │
          ├─ IDOR CHECK:
          │     if (!monitor || monitor.user_id !== 1)
          │       throw HttpError 404
          │
          ├─ Promise.all([
          │     PingRepository.findByMonitorId(7, 20, cursor=540),
          │     PingRepository.getUptimePercentage(7)
          │   ])
          │     Both queries run in parallel — no reason to wait for one before the other.
          │
          │   findByMonitorId with cursor:
          │     SELECT id, monitor_id, status, latency, response_code, checked_at
          │     FROM pings
          │     WHERE monitor_id = $1 AND id < $2     ← cursor boundary
          │     ORDER BY id DESC LIMIT $3
          │     Uses index: idx_pings_monitor_id_id ON pings(monitor_id, id DESC)
          │
          │     WHY CURSOR INSTEAD OF OFFSET?
          │     OFFSET n tells Postgres to count n rows from the start of the result
          │     set and discard them. It cannot skip — it must scan and count.
          │     On page 100 with 20 rows per page (offset=2000), Postgres reads
          │     2020 rows and throws away 2000. This gets progressively worse.
          │     Cursor pagination uses a WHERE clause on an indexed column — Postgres
          │     jumps directly to the right position in the index, no counting needed.
          │
          │   getUptimePercentage:
          │     SELECT ROUND(
          │       COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2
          │     ) AS uptime
          │     FROM (
          │       SELECT status FROM pings
          │       WHERE monitor_id = $1
          │       ORDER BY id DESC LIMIT 100
          │     ) recent
          │
          └─ Compute nextCursor:
                If pings.length === limit → there might be more pages
                  nextCursor = pings[last].id   (pass this as ?cursor= on next request)
                Else
                  nextCursor = null             (you've reached the end)
```

**Response:**
```json
{
  "type": "RESULT",
  "message": "OK",
  "result": {
    "pings": [
      { "id": 540, "monitor_id": 7, "status": "up", "latency": 142, "response_code": 200, "checked_at": "..." },
      { "id": 539, "monitor_id": 7, "status": "up", "latency": 138, "response_code": 200, "checked_at": "..." }
    ],
    "uptime": 99.50,
    "nextCursor": 539
  },
  "error": null
}
```

Next page: `GET /api/v1/monitors/7/pings?limit=20&cursor=539`

---

### 7.7 Background Ping Job (Cron)

This runs every minute inside the same Node.js process. It has no HTTP interface.

```
node-cron fires "* * * * *"
    │
    └─ runPingJob()
          │
          ├─ lastId = 0
          │
          └─ BATCH LOOP (cursor-based):
                ┌─────────────────────────────────────────────────────┐
                │ MonitorRepository.findActiveBatch(lastId, 100)       │
                │   SELECT ... FROM monitors                           │
                │   WHERE status = 'up' AND id > $lastId              │
                │   ORDER BY id ASC LIMIT 100                         │
                │   Uses partial index: idx_monitors_active_id         │
                │                                                      │
                │ If batch is empty → exit loop                        │
                │                                                      │
                │ Promise.allSettled(batch.map(pingMonitor))           │
                │   All monitors in this batch are pinged concurrently │
                │   allSettled (not all) — one failure doesn't abort   │
                │   the rest of the batch                              │
                │                                                      │
                │ lastId = batch[last].id                              │
                │ If batch.length < 100 → exit loop (final batch)     │
                │ Else → loop again for next batch                     │
                └─────────────────────────────────────────────────────┘
```

**Why batching matters:** With 10 monitors this is trivial. With 100,000 monitors, `findAll()` would load ~100,000 rows into Node.js heap memory at once. Cursor batching loads 100 rows, processes them, loads the next 100 — constant memory regardless of table size.

**Per-monitor ping logic (PingService.pingMonitor):**

```
PingService.pingMonitor(monitorId)
    │
    ├─ MonitorRepository.findById(monitorId)
    │
    ├─ fetch(monitor.url, { signal: AbortSignal.timeout(10_000) })
    │     10-second hard timeout.
    │     If the host doesn't respond in 10s → error caught → status = "down", latency = null
    │     If response is 2xx/3xx → status = "up"
    │     If response is 4xx/5xx → status = "down" (server is up but returning errors)
    │
    ├─ Promise.all([
    │     PingRepository.findLastByMonitorId(monitorId),   ← for state comparison
    │     PingRepository.create({ monitor_id, status, latency, response_code })
    │   ])
    │     These two are independent — run them in parallel.
    │     findLast reads the previous ping to know the prior state.
    │     create writes the new ping result.
    │
    └─ Alert logic (if telegram_chat_id is set):
          current = "down" AND last was "up" (or no prior ping) → send DOWN alert
          current = "up"   AND last was "down"                  → send RECOVERY alert
          Otherwise → do nothing (avoid spam on sustained outages)
```

---

### 7.8 Telegram Alerts

**Down Alert (transition: up → down):**
```
🚨 Monitor Down Alert

Name: Production API
URL: https://api.myapp.com/health
Status: ❌ Down
Time: Mon, 18 May 2026 10:01:00 GMT
```

**Recovery Alert (transition: down → up):**
```
✅ Monitor Recovered

Name: Production API
URL: https://api.myapp.com/health
Latency: 142ms
Time: Mon, 18 May 2026 10:05:00 GMT
```

**How it works:**

```
sendTelegramAlert(chatId, message)
    │
    └─ POST https://api.telegram.org/bot{TOKEN}/sendMessage
          Body: { chat_id, text, parse_mode: "Markdown" }
          │
          ├─ If Telegram API returns non-OK → logs error, does not throw
          │     (a failed alert should not crash the cron job)
          │
          └─ Errors are captured by Sentry for monitoring
```

To use: create a Telegram bot via @BotFather, get the token, put it in `TELEGRAM_BOT_TOKEN`. Find your chat ID by messaging `@userinfobot`. Set `telegram_chat_id` when creating a monitor.

---

## 8. Security Design

### Authentication: JWT
- Token payload: `{ id, email }` — minimal, no sensitive data.
- Signed with `JWT_SECRET` (must be ≥32 characters, enforced by Zod at startup).
- Expiry: 7 days. No rotation or refresh flow (stateless simplicity).
- Extraction: `Authorization: Bearer <token>` header only — no cookie, no query param.

### IDOR (Insecure Direct Object Reference) Prevention
All resource access checks `resource.user_id === req.user.id`. When the check fails, the response is `404 Not Found` — not `403 Forbidden`. This is intentional: returning 403 would confirm the resource exists, letting an attacker map out other users' monitor IDs by iterating `DELETE /monitors/1`, `/monitors/2`, etc.

### Password Security
- bcrypt with 12 rounds (~250ms per hash on modern hardware).
- Timing attack protection on login: bcrypt always runs, even when the user doesn't exist, so response time is identical for "email not found" and "wrong password".
- `password_hash` is excluded from every SELECT in responses via explicit column lists (no `SELECT *` on users).

### Input Sanitization
All `req.body` values pass through a Zod schema before reaching any service layer. Unknown fields are stripped. Malformed input is rejected at the middleware boundary with a 400 response — the error message comes from the schema definition, not from any internal state.

### Rate Limiting
- All routes: 100 requests per 15 minutes per IP.
- Auth routes (login, register): 10 requests per 15 minutes per IP.
- For production, combine with AWS WAF or Cloudflare rate limiting at the network layer — application-level limiting alone can be bypassed via IP rotation.

### HTTP Security Headers (Helmet)
Sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy`, and others automatically.

---

## 9. Error Handling Strategy

The project distinguishes three categories of error:

### Expected Errors (HttpError)
Predictable domain errors: wrong password, duplicate URL, monitor not found.

```typescript
throw new HttpError({ statusCode: 409, message: "You are already monitoring this URL" });
```

These are caught by `apiMiddleWare` and returned to the client with the appropriate status code and a human-readable message. The stack trace is **never sent to the client**.

### Unexpected Errors (bugs, DB connection failures, etc.)
Any `Error` that is not an `HttpError`.

```
apiMiddleWare catches it
    ├─ Sentry.captureException(error)   ← full stack trace logged for the developer
    └─ Client receives: { message: "Something went wrong" }   ← zero internals exposed
```

This prevents leaking table names, column names, query structure, or file paths to an attacker.

### Middleware Errors (validation, auth failures)
Errors thrown by middleware that runs before `apiMiddleWare` (e.g. `validate`, `authenticate`) are forwarded via `next(err)` and caught by the global error handler in `app.ts`, which applies the same two-path logic.

### Response Envelope
Every response — success or error — follows the same shape:

```json
{
  "type": "RESULT" | "ERROR",
  "message": "OK" | "human-readable error",
  "result": { ... } | null,
  "error": null
}
```

The `error` field is always `null` in production responses. It exists in the shape as a placeholder for future structured error details (e.g. field-level validation errors).

---

## 10. Performance Decisions

| Decision | Why |
|---|---|
| Cursor pagination (not OFFSET) | OFFSET scans every row up to the offset position. Cursor pagination uses a `WHERE id < cursor` clause that goes directly to the index position. Page 1000 is just as fast as page 1. |
| Batch cron with cursor (not `findAll`) | Loading all monitors into memory on every cron tick is a ticking time bomb. With 100 monitors it's fine. With 100,000 monitors it crashes Node.js. Batching 100 at a time means constant memory regardless of table size. |
| `Promise.all` for independent DB calls | In `getPingsByMonitorId`, pings and uptime percentage are fetched in parallel. In `pingMonitor`, `findLast` and `create` run in parallel. This cuts wall-clock latency by ~half for those operations. |
| `Promise.allSettled` in cron | `Promise.all` fails fast — one failing monitor would abort the whole batch. `allSettled` runs all to completion and collects results. One unreachable host does not block the other 99. |
| Partial index on monitors(status='up') | A full index on a low-cardinality column (`status` has 3 values) is often ignored by Postgres's query planner. A partial index only indexes the rows that match — smaller, faster, and the planner is more likely to use it. |
| Composite index on pings(monitor_id, id DESC) | The leading column `monitor_id` is the equality filter. The trailing column `id DESC` matches the `ORDER BY id DESC` in cursor queries. Postgres can satisfy both the filter and the sort from the same index scan without an extra sort step. |
| Explicit column lists (no SELECT \*) | Returns only the fields the client needs. Avoids accidentally exposing new columns added later. Prevents `password_hash` from leaking if a query is copy-pasted carelessly. |

---

## 11. Environment Variables

Copy `.env.local` and fill in values. All variables are validated by Zod at startup — the server refuses to start with missing or invalid config.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `production` | `development` or `production`. Controls log format and Sentry sample rate. |
| `PORT` | No | `8080` | HTTP server port. |
| `HOST` | No | `localhost` | Server hostname (informational). |
| `CORS_ORIGIN` | No | `http://localhost:8080` | Allowed CORS origin. |
| `POSTGRES_USER` | Yes | — | Postgres username. |
| `POSTGRES_PASSWORD` | Yes | — | Postgres password. |
| `POSTGRES_DB` | No | `uptime-monitor` | Postgres database name. |
| `DB_PORT` | No | `5432` | Postgres port. |
| `TELEGRAM_BOT_TOKEN` | Yes | — | Bot token from @BotFather. |
| `JWT_SECRET` | Yes (≥32 chars) | — | Secret for signing JWTs. Use a random 64-char string in production. |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry. Format: `60`, `2h`, `7d`. |
| `SENTRY_DSN` | No | — | Sentry DSN URL. Leave empty to disable error monitoring. |

---

## 12. Running the Project

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)

### Steps

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.local .env.local   # already there — edit TELEGRAM_BOT_TOKEN, JWT_SECRET

# 4. Run database migrations
npx tsx src/db/migrations/migrate.ts

# 5. Start the development server (hot reload)
npm run dev
```

The server starts on `http://localhost:8080`. The cron job starts automatically and logs every minute.

### Re-running migrations
The migration runner is idempotent — it uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Safe to run multiple times.

---

## 13. API Reference

Base URL: `http://localhost:8080/api/v1`

All protected routes require: `Authorization: Bearer <token>`

All responses follow the envelope: `{ type, message, result, error }`

### Auth

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | No | `{ email, first_name, last_name, password }` | Create account, returns JWT |
| `POST` | `/auth/login` | No | `{ email, password }` | Returns JWT |

### Monitors

| Method | Path | Auth | Body / Params | Description |
|---|---|---|---|---|
| `POST` | `/monitors` | Yes | `{ name, url, telegram_chat_id? }` | Add a URL to monitor |
| `GET` | `/monitors` | Yes | — | List your monitors (newest first) |
| `DELETE` | `/monitors/:id` | Yes | `:id` in path | Delete a monitor (cascades pings) |

### Pings

| Method | Path | Auth | Query | Description |
|---|---|---|---|---|
| `GET` | `/monitors/:monitorId/pings` | Yes | `limit` (default 20, max 100), `cursor` (last ping id) | Get ping history + uptime % |

### Rate Limits

| Route group | Limit |
|---|---|
| `/auth/register`, `/auth/login` | 10 requests / 15 min / IP |
| All other routes | 100 requests / 15 min / IP |
