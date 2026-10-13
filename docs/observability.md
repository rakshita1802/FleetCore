# FleetCore — Production Observability Architecture

## Overview
FleetCore implements production observability principles to ensure system visibility, error tracking, and dependency health across APIs, databases, message brokers, and background workers.

---

## 1. Lifecycle Probes

### A. Liveness Probe (`GET /api/health/live`)
- **Purpose**: Kubernetes/container orchestrator liveness check.
- **Behavior**: Returns `200 OK` with `{ status: "alive", uptime, pid }`. Does not query databases or external network services.

### B. Readiness Probe (`GET /api/health/ready`)
- **Purpose**: Traffic routing readiness check.
- **Behavior**: Verifies MySQL database connection (`SELECT 1`) and Redis availability. Returns `200 OK` with `{ status: "ready" }` if dependencies are healthy; returns `503 Service Unavailable` if critical dependencies fail.

### C. Queue Health (`GET /api/health/jobs`)
- **Purpose**: Background queue monitoring.
- **Behavior**: Returns real-time counts for `waiting`, `active`, `completed`, `failed`, `delayed` jobs across maintenance, alert, operational, and report queues.

---

## 2. Request Tracing & Correlation (Request IDs)
- Middleware `requestId` checks incoming `X-Request-ID` header (sanitized) or generates a UUID.
- Attached to `req.id` and returned in the `X-Request-ID` response header.
- Automatically included in structured logs and error responses for end-to-end incident correlation.

---

## 3. Request Metrics with Low Route Cardinality
- `requestMetrics` middleware tracks:
  - Total HTTP request count and average response latency.
  - Status code class distributions (`2xx`, `3xx`, `4xx`, `5xx`).
  - Route normalization: replaces dynamic UUIDs, integer IDs, and entity identifiers with `:id` (e.g. `/api/vehicles/:id`, `/api/trips/:id/start`) to prevent metric cardinality explosion.

---

## 4. Structured Logging & Secret Redaction
- Configurable log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`) via `LOG_LEVEL` environment variable.
- Redacts sensitive credentials (`password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization`, `database_url`, `redis_url`).
- Stack traces are omitted from production HTTP error responses.
