# FleetCore — Reporting Subsystem

## Overview
The Reporting Subsystem provides deterministic, audited exports of fleet operations, trips, maintenance history, and operational alerts in tabular CSV format, with support for both instantaneous small exports and background processing for large datasets via BullMQ.

---

## 1. Supported Report Types

| Report Type | Key Columns | Source Services |
| :--- | :--- | :--- |
| **`FLEET_UTILIZATION`** | Registration, Make/Model, Status, Odometer, Total Trips, Completed Trips, Completion Rate %, Distance (km), Utilized | `vehicleService`, `tripService` |
| **`TRIPS`** | Trip #, Vehicle, Driver (Name & Code), Route (Origin/Dest), Scheduled Start, Actual Start/End, Distance (km), Status | `tripService` |
| **`MAINTENANCE`** | Vehicle, Service Type, Schedule Name, Description, Status, Started/Completed At, Odometer, Cost, Vendor | `maintenanceService` |
| **`ALERTS`** | Vehicle, Alert Type, Severity, Title, Message, Status, Created At, Acknowledged At, Resolved At | `alertService` |

---

## 2. Security & CSV Formula Injection Protection

Spreadsheet applications (Excel, Google Sheets, LibreOffice) can execute macros if cell values begin with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`).

FleetCore implements strict CSV sanitization:
1. **Formula Character Prefixing**: Any text cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` (unless strictly numeric) is prefixed with a single quote `'` to enforce plain text interpretation.
2. **Quote & Delimiter Escaping**: Values containing commas, quotes, or newlines are wrapped in double quotes, and internal quotes are escaped (`" -> ""`).
3. **UTF-8 Byte Order Mark (BOM)**: Exported files include `\uFEFF` BOM to ensure proper character encoding rendering across all versions of Excel.

---

## 3. Synchronous vs Asynchronous Export Architecture

```text
Interactive Request (Small)
  GET /api/reports/:type/export
      ↓
  MySQL Aggregation Query
      ↓
  formatReportToCSV()
      ↓
  Direct HTTP Stream (text/csv)

Large Dataset Export (Background)
  POST /api/reports/:type/export
      ↓
  Enqueue BullMQ Job (report:generate)
      ↓
  202 Accepted { jobId }
      ↓
  Worker Process (generateAllReportRows -> CSV -> Secure Temp File)
      ↓
  GET /api/reports/jobs/:jobId (Poll Status)
      ↓
  GET /api/reports/download/:fileId (Secure Download)
```

---

## 4. File Security & Expiration
- Temporary export files are stored in `reports_temp/` using randomized UUID filenames prefixed by `companyId`.
- Path traversal protection is strictly enforced during file download.
- Operational cleanup job (`JOB_TYPES.OPERATIONAL_CLEANUP_REPORTS`) automatically deletes export files older than 24 hours.
