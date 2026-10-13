# FleetCore — Admin Operations & RBAC Architecture

## Overview
FleetCore's Administrative Subsystem provides tenant-scoped user management, role-based access controls (RBAC), operational overview statistics, and critical safety protections against lockout and unauthorized privilege escalation.

---

## 1. User Roles & Permissions Matrix

| Role | User Administration | Role Changes | View Reports | Export Reports | System Health | Fleet Operations | Driver Scoping |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | Full (CRUD, Status) | Yes (All roles) | Yes | Yes (Sync & Async) | Yes | Full | Company-wide |
| **FLEET_MANAGER** | None (403) | None (403) | Yes | Yes (Sync & Async) | Overview only | Full | Company-wide |
| **DRIVER** | None (403) | None (403) | Scoped | None (403) | None (403) | Assigned Vehicle | Self Only |
| **VIEWER** | None (403) | None (403) | Yes (Preview) | None (403) | None (403) | Read-only | Company-wide |

---

## 2. Safety Protections

### A. Last-Admin Protection
- **Problem**: Accidental removal or deactivation of the last active administrator for a company can cause permanent lockout.
- **Enforcement**:
  - When changing a user's role from `ADMIN` to any other role, or deactivating an `ADMIN`, the service counts active administrators in the company:
    ```sql
    SELECT count(id) FROM User WHERE companyId = ? AND role = 'ADMIN' AND status = 'ACTIVE';
    ```
  - If `activeAdminCount <= 1`, the mutation is blocked immediately with `409 Conflict`:
    ```json
    {
      "success": false,
      "message": "Cannot remove the last active administrator for this company"
    }
    ```

### B. Self-Protection
- **Enforcement**:
  - An administrator cannot demote their own `ADMIN` access.
  - An administrator cannot deactivate their own account.
  - Returns `409 Conflict`: `"Administrators cannot deactivate their own account"`.

---

## 3. Account Lifecycle & Inactive Status
- Users can have `status: 'ACTIVE'` or `status: 'INACTIVE'`.
- Deactivating a user immediately revokes all active refresh sessions (`RefreshSession.revokedAt = NOW()`).
- Inactive users are rejected at authentication middleware with `401 Unauthorized` (`"Account is inactive"`).
- User records are never hard-deleted to preserve historical audit logs, trip records, and maintenance audit trails.

---

## 4. API Endpoints

### Administrative Operations
- `GET /api/admin/overview`: Aggregated statistics on users, vehicles, drivers, trips, maintenance, open alerts, and queue health.
- `GET /api/admin/system`: System health and runtime telemetry (memory, uptime, database, redis, queues).
- `GET /api/admin/users`: List users with filtering (`role`, `status`, `search`), pagination, and sorting.
- `GET /api/admin/users/:id`: Get detailed profile for a specific user.
- `POST /api/admin/users`: Create a new user in the tenant company.
- `PATCH /api/admin/users/:id`: Update user profile information.
- `PATCH /api/admin/users/:id/role`: Change user role with Last-Admin and Self-protection checks.
- `POST /api/admin/users/:id/activate`: Reactivate account.
- `POST /api/admin/users/:id/deactivate`: Deactivate account and revoke active sessions.
