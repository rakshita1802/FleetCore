# Fleet Analytics KPIs

This document explicitly defines the logic and calculations behind FleetCore Analytics metrics to ensure consistency and correctness.

## Total Distance
- **Data Source:** `Trip.distanceKm` where status = COMPLETED.
- **Formula:** `SUM(Trip.distanceKm)` within the selected period.
- **Limitations:** Only measures distance from finalized trips. Telemetry-based distance is excluded here to avoid double-counting.
- **Missing Data Behavior:** Ignored.

## Trip Completion Rate
- **Data Source:** `Trip.status`
- **Formula:** `COMPLETED trips / (COMPLETED + CANCELLED trips)` within the selected period. 
- **Denominator:** Only uses trips that have reached a terminal state (Completed or Cancelled). PLANNED and IN_PROGRESS trips are excluded from this calculation.
- **Missing Data Behavior:** If there are no terminal trips in the window, it returns `null`.

## Cancellation Rate
- **Formula:** `CANCELLED trips / (COMPLETED + CANCELLED trips)` within the selected period.
- **Missing Data Behavior:** If there are no terminal trips in the window, it returns `null`.

## Vehicle Usage Rate (formerly Utilization)
- **Data Source:** `Vehicle` and `Trip`
- **Definition:** A vehicle is strictly considered "Used" if it has executed at least one IN_PROGRESS or COMPLETED trip within the evaluated time frame.
- **Formula:** `Number of Used Vehicles / Total Eligible Active Vehicles`.
- **Limitations:** This is a binary operational metric (Yes/No per vehicle). It excludes RETIRED vehicles from the eligible denominator. It does not map fractional engine availability hours.

## Idle Time
- **Data Source:** `Telemetry.engineStatus` and `Telemetry.timestamp`
- **Formula:** `Sum of valid consecutive telemetry intervals where previous state is IDLE`.
- **Methodology:** Calculated using observed telemetry duration via consecutive timestamps (`next.timestamp - current.timestamp`).
- **Limitations:** Subject to a `MAX_IDLE_INTERVAL_SECONDS` (default 300s). Huge telemetry gaps are ignored to prevent artificially inflating idle time when vehicle state is unknown. Missing telemetry implies unknown state.

## Fuel Level Change
- **Data Source:** `Telemetry.fuelLevel`
- **Formula:** `First observation fuelLevel - Last observation fuelLevel` within the query period.
- **Limitations:** This reflects a percentage change `(%)` in the tank level. It does NOT translate strictly to Liters consumed because the system does not natively track absolute fuel tank capacities. It handles refueling spikes natively by measuring net diffs, though it is not a substitution for absolute fuel consumption.
- **Missing Data Behavior:** If fuel levels are absent from telemetry, it is returned as `null` rather than `0` to prevent skewing averages artificially.
