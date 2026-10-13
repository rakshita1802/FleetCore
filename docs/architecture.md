# FleetCore Architecture

## System Architecture
```text
                     FleetCore Platform
                              │
     ┌────────────────────────┼────────────────────────┐
     │                        │                        │
 Operations               Analytics               Maintenance
     │                        │                        │
     └────────────────────────┼────────────────────────┘
                              │
                      Admin / Reporting
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Admin Ops         Reports       Observability
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                         Production
```

## Frontend Architecture
* Built with React and Vite.
* Tailwind CSS for styling.
* Axios for API requests (centralized client with JWT refresh interceptors).
* React Router for navigation.
* Structure cleanly divides into pages, components, layouts, contexts, hooks, and services.

## Backend Architecture
* Node.js + Express API + Dedicated BullMQ Worker.
* Prisma as the ORM with MySQL database.
* Request ID tracing (`X-Request-ID`), structured logging, and route-normalized API metrics.
* Role-based access control (`ADMIN`, `FLEET_MANAGER`, `DRIVER`, `VIEWER`).
* Centralized error handling without leaking internal stack traces.

## Database Architecture
* Relational modeling via MySQL.
* Strict primary keys, foreign keys, and indexes via Prisma.
* Tenant isolation enforced on all domain models (`companyId`).
* Entities: Company, User, RefreshSession, Vehicle, Driver, VehicleAssignment, Trip, Telemetry, MaintenanceSchedule, MaintenanceRecord, Alert, AuditLog.

## Background Jobs & Operational Event Processing Architecture
```text
Client / Scheduler / API
           ↓
    Express REST API (Fast HTTP Responses / 202 Accepted)
           ↓ (Enqueue Jobs)
    BullMQ Queues (maintenance, alert, operational, report)
           ↓
     Redis (Queue Broker)
           ↓
    Dedicated Worker Process (worker.js)
           ↓
    Existing Deterministic Domain Services
           ↓
      MySQL (Authoritative Source of Truth)
           ↓
    Socket.IO Broadcast (`alert:created`, `alert:resolved`)
           ↓
    React Operations Dashboard
```

## Admin Operations & Audit Architecture
```text
Admin UI
   ↓
Admin API (/api/admin/*)
   ↓
Admin Service (Last-Admin & Self-Protection Guards)
   ↓
MySQL (User, RefreshSession)
   ↓
AuditLog (Append-Only Immutable Event Trail)
```

## Reporting Architecture
```text
Interactive Preview / Export
   ↓
Reports API (/api/reports/*)
   ↓
┌──────────────────────┴──────────────────────┐
▼ (Small / Sync)                              ▼ (Large / Async)
Direct Stream (text/csv)               BullMQ Report Queue
                                              ↓
                                       Worker CSV Generation
                                              ↓
                                       Secure Temp Storage (reports_temp/)
                                              ↓
                                       Download via File URL
```
