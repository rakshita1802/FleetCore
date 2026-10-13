# FleetCore — Audit Trail Architecture

## Overview
The Audit Subsystem captures an immutable, tenant-isolated record of all security-sensitive administrative operations, authentication lifecycle events, and critical operational state mutations.

---

## 1. Schema & Data Model

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  companyId  String
  company    Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     String
  entityType String
  entityId   String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?  @db.Text
  createdAt  DateTime @default(now())

  @@index([companyId])
  @@index([userId])
  @@index([action])
  @@index([entityType])
  @@index([createdAt])
}
```

---

## 2. Event Taxonomy

| Category | Actions |
| :--- | :--- |
| **Authentication** | `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `REFRESH` |
| **User Administration** | `USER_CREATED`, `USER_UPDATED`, `USER_ROLE_CHANGED`, `USER_ACTIVATED`, `USER_DEACTIVATED` |
| **Fleet Management** | `VEHICLE_CREATED`, `VEHICLE_UPDATED`, `VEHICLE_RETIRED`, `DRIVER_CREATED`, `DRIVER_UPDATED` |
| **Maintenance** | `MAINTENANCE_CREATED`, `MAINTENANCE_STARTED`, `MAINTENANCE_COMPLETED`, `MAINTENANCE_CANCELLED` |
| **Operational Alerts** | `ALERT_ACKNOWLEDGED`, `ALERT_RESOLVED` |
| **Reporting Engine** | `REPORT_EXPORTED` |

---

## 3. Immutability & Sensitive Field Sanitization
- **Append-Only**: The audit log table does not expose `UPDATE` or `DELETE` endpoints.
- **Sanitization**: Before persisting metadata, all nested keys matching passwords, tokens, JWTs, and secrets are redacted to `[REDACTED]`.
- **Tenant Isolation**: Audit queries (`GET /api/audit`) strictly filter by the authenticated user's `companyId`.
