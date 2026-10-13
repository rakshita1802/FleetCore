# FleetCore — Background Jobs, Alert Automation & Operational Event Processing

## 1. Overview & Architecture

FleetCore Phase 9 establishes an asynchronous, resilient, multi-tenant background processing subsystem powered by **BullMQ** and **Redis**.

Expensive, scheduled, and retryable operational tasks are cleanly moved out of synchronous HTTP request paths into isolated background queues processed by dedicated worker instances.

```text
Browser / HTTP Client
         ↓
  Express API (server.js)
         ↓  (Returns 202 Accepted)
  BullMQ Queues (Prefix: fleetcore:queue)
         ↓
  Redis Broker
         ↓
  Dedicated Worker Process (worker.js)
         ↓
  Existing Services (maintenanceDueService, alertService)
         ↓
  MySQL (Authoritative State)
         ↓
  Socket.IO Tenant-Scoped Broadcasts
         ↓
  React Maintenance & Live Dashboard
```

---

## 2. Queue Inventory

| Queue Name | BullMQ Key | Purpose | Supported Job Types |
| :--- | :--- | :--- | :--- |
| `maintenance` | `fleetcore:queue:maintenance` | Evaluation of recurring maintenance rules and alert generation | `maintenance:evaluate:company`<br>`maintenance:evaluate:all` |
| `alert` | `fleetcore:queue:alert` | Asynchronous processing, escalation, and real-time dispatch of alerts | `alert:process`<br>`alert:escalate`<br>`alert:notify` |
| `operational` | `fleetcore:queue:operational` | Scheduled background maintenance, queue cleanup, and health metrics | `operational:cleanup` |

---

## 3. Worker Architecture

* **Worker Entry Point:** [`backend/src/worker.js`](file:///d:/FleetCore/backend/src/worker.js)
* **Separation of Concerns:**
  * **API Process (`src/server.js`):** Handles authentication, RBAC, input validation, fast synchronous responses, and job enqueueing (`202 Accepted`).
  * **Worker Process (`src/worker.js`):** Consumes queue jobs, coordinates deterministic business logic services, logs structured output, and executes retries.
* **Concurrency:** Defaults to 5 workers (`WORKER_CONCURRENCY=5`), configurable via environment variables without modifying application code.

---

## 4. Scheduled Jobs & Multi-Tenant Fan-Out

1. **Scheduled Maintenance Evaluation:**
   * **Schedule:** Configurable cron expression (`MAINTENANCE_EVALUATION_CRON="*/15 * * * *"` by default, every 15 minutes).
   * **Fan-Out Pattern:** The scheduler enqueues a system fan-out job (`maintenance:evaluate:all`). The processor discovers all active companies in MySQL and spawns independent `maintenance:evaluate:company` jobs per tenant.
   * **Isolation & Granularity:** Failures in Company A do not affect Company B. Each company job retries independently.

2. **Scheduled Operational Cleanup:**
   * **Schedule:** Daily at 2:00 AM (`CLEANUP_CRON="0 2 * * *"`).
   * **Action:** Cleans completed BullMQ jobs older than 24 hours and failed jobs older than 7 days.

---

## 5. Retry Policy, Idempotency & Backoff

* **Retry Configuration:**
  * Maximum Attempts: `3` (configurable via `JOB_ATTEMPTS`).
  * Backoff Strategy: Exponential backoff with initial 5000ms delay (`JOB_BACKOFF_MS`).
* **Deterministic Job IDs:**
  * Company evaluation jobs use deterministic IDs: `maint-eval:{companyId}:{15min_window}`.
  * Prevents duplicate execution if multiple evaluation requests are triggered within the same cycle.
* **Database Idempotency:**
  * The MySQL database remains authoritative.
  * Re-executing an evaluation job multiple times safely produces zero duplicate alerts due to Phase 8 active alert deduplication rules.

---

## 6. Real-Time Socket.IO Integration

* When alerts are created, acknowledged, or resolved by background workers, events are emitted to the respective tenant room:
  * `alert:created` $\rightarrow$ `company:{companyId}`
  * `alert:acknowledged` $\rightarrow$ `company:{companyId}`
  * `alert:resolved` $\rightarrow$ `company:{companyId}`
* Drivers receive only notifications for their assigned vehicle.
* The React dashboard captures real-time events and refreshes state upon socket reconnect.

---

## 7. Operational Endpoints

* `POST /api/maintenance/evaluate` — Enqueues evaluation into `maintenanceQueue` and immediately returns `202 Accepted` with `{ jobId, queue: "maintenance", status: "queued" }`.
* `GET /api/jobs/:queue/:jobId` — Queries the current status of a queued or processed job (`waiting`, `active`, `completed`, `failed`, `delayed`), protected by tenant scoping.
* `GET /api/health/jobs` — Health check returning job counts across all registered queues.

---

## 8. Graceful Shutdown

On receiving `SIGTERM` or `SIGINT`:
1. Worker stops polling for new jobs.
2. Waits for currently in-flight database transactions to settle.
3. Closes BullMQ workers.
4. Closes BullMQ queue instances.
5. Disconnects Prisma client and exits with code 0.
