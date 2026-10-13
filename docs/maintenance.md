# FleetCore — Maintenance Intelligence & Operational Alerts

## 1. Overview & Architecture

FleetCore Phase 8 introduces a deterministic, rule-based maintenance scheduling and operational alert engine.

```text
                     Vehicle State & Telemetry Odometer
                                     ↓
                        MaintenanceSchedule Model
                                     ↓
                          Due Evaluation Service
           (Derived Status: OVERDUE / UPCOMING / SCHEDULED)
                                     ↓
                              Alert Service
             (Deduplication, Escalation & Notifications)
                                     ↓
                        Maintenance Record Lifecycle
                   (SCHEDULED → IN_PROGRESS → COMPLETED)
                                     ↓
              Transactional Recalculation & Alert Resolution
```

---

## 2. Core Concepts & Models

### 2.1. Maintenance Schedule (`MaintenanceSchedule`)
Defines recurring or interval-based maintenance rules for specific fleet vehicles.
* **Fields:** `id`, `companyId`, `vehicleId`, `name`, `description`, `serviceType`, `triggerType`, `intervalKm`, `intervalDays`, `lastServiceAt`, `lastServiceOdometer`, `nextDueAt`, `nextDueOdometer`, `isActive`.
* **Service Types:** `OIL_CHANGE`, `BRAKE_SERVICE`, `TIRE_SERVICE`, `BATTERY`, `ENGINE_SERVICE`, `GENERAL_SERVICE`, `INSPECTION`, `OTHER`.
* **Trigger Types:**
  * `TIME`: Driven by calendar interval (`intervalDays`).
  * `ODOMETER`: Driven by vehicle travel distance (`intervalKm`).
  * `TIME_OR_ODOMETER`: Driven by whichever threshold is reached first.

### 2.2. Maintenance Record (`MaintenanceRecord`)
Captures an individual servicing event (planned, undergoing, completed, or cancelled).
* **Fields:** `id`, `companyId`, `vehicleId`, `scheduleId`, `serviceType`, `description`, `status`, `startedAt`, `completedAt`, `odometerAtService`, `cost`, `vendor`, `notes`, `createdBy`.
* **Statuses:** `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

### 2.3. Operational Alert (`Alert`)
Operational notifications generated when maintenance items approach due thresholds or become overdue.
* **Fields:** `id`, `companyId`, `vehicleId`, `maintenanceScheduleId`, `type`, `severity`, `title`, `message`, `status`, `metadata`, `acknowledgedAt`, `acknowledgedBy`, `resolvedAt`, `resolvedBy`.
* **Types:** `MAINTENANCE_DUE`, `MAINTENANCE_OVERDUE`, `OTHER`.
* **Severities:** `INFO`, `WARNING`, `CRITICAL`.
* **Statuses:** `OPEN`, `ACKNOWLEDGED`, `RESOLVED`.

---

## 3. Maintenance Due Logic & Derived State

Rather than persisting volatile boolean flags (`isOverdue`), due statuses are computed deterministically at query and evaluation time:

* **Configurable Thresholds:**
  * Upcoming Time Window: `UPCOMING_DAYS_THRESHOLD = 30` days
  * Upcoming Odometer Window: `UPCOMING_KM_THRESHOLD = 500` km

* **Evaluation Rules:**
  1. **OVERDUE (Priority: `HIGH`):**
     * `currentDate > nextDueAt` OR `currentOdometer >= nextDueOdometer`
  2. **UPCOMING (Priority: `MEDIUM`):**
     * Not overdue AND (`nextDueAt - currentDate <= 30 days` OR `nextDueOdometer - currentOdometer <= 500 km`)
  3. **SCHEDULED (Priority: `LOW`):**
     * Normal operational state ahead of the warning thresholds.

---

## 4. Odometer Handling & Rollback Protection

* When calculating due status, the system reads the vehicle's latest verified odometer.
* Rollback protection: If out-of-order or stale telemetry reports an odometer reading lower than the vehicle's known recorded odometer, the vehicle odometer is preserved and not degraded.
* Service completion records the odometer reading at the exact time of service.

---

## 5. Maintenance Lifecycle & Transactional Safety

* **Lifecycle State Machine:**
  * `SCHEDULED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`
  * `SCHEDULED` $\rightarrow$ `CANCELLED`
  * `IN_PROGRESS` $\rightarrow$ `CANCELLED`
  * Direct transitions from `COMPLETED` or `CANCELLED` back to `IN_PROGRESS` are strictly prohibited (409 Conflict).

* **Transactional Completion (`POST /api/maintenance/records/:id/complete`):**
  Executing inside a serializable Prisma `$transaction`:
  1. Updates `MaintenanceRecord` status to `COMPLETED`, records `completedAt`, `odometerAtService`, `cost`, and `vendor`.
  2. Recalculates the parent `MaintenanceSchedule`'s `nextDueAt` ($T_{\text{completed}} + \text{intervalDays}$) and `nextDueOdometer` ($\text{odometerAtService} + \text{intervalKm}$).
  3. Updates `lastServiceAt` and `lastServiceOdometer` on the schedule.
  4. Resolves any associated active `OPEN` or `ACKNOWLEDGED` maintenance alerts for that schedule cycle.

---

## 6. Alert Deduplication & Escalation Strategy

* The `evaluateMaintenanceDue` engine scans active schedules and cross-references existing active alerts:
  * If a schedule is `OVERDUE` and an existing `MAINTENANCE_DUE` alert exists, the warning alert is resolved and escalated to `MAINTENANCE_OVERDUE` (`CRITICAL`).
  * If an alert of the same type and severity already exists, duplicate alert generation is prevented.
  * Inactive schedules and retired vehicles are excluded from alert generation.

---

## 7. Operational Safety Rules

1. **Active Trip Protection:**
   * Setting a vehicle's status to `MAINTENANCE` is rejected (409 Conflict) if the vehicle currently has an active trip (`status: 'IN_PROGRESS'`).
2. **Operational Warning vs. Vehicle Unusable:**
   * A vehicle becoming due or overdue creates operational alerts, but does not silently take the vehicle offline or cancel live trips. Fleet managers retain operational control.

---

## 8. Security & RBAC

* **Tenant Isolation:** Every query enforces `companyId = req.user.companyId`. Cross-company access returns 404.
* **ADMIN & FLEET_MANAGER:** Full access to create, update, delete schedules, manage record lifecycles, acknowledge and resolve alerts.
* **VIEWER:** Read-only access to summaries, due items, schedules, records, and alerts.
* **DRIVER:** Scoped strictly to their assigned vehicle. Financial details (`cost`) are stripped from responses for the `DRIVER` role.

---

## 9. Explicit Production Limitations

> **Rule-Based Maintenance Intelligence:**
> FleetCore Phase 8 uses explicit, deterministic interval and threshold rules configured by fleet operators. It does **NOT** perform machine learning failure prediction, remaining useful life (RUL) estimation, or sensor anomaly ML. Overdue status indicates that a scheduled interval has elapsed, not proof of component failure.
