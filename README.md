# FleetCore

**From Fleet Data to Operational Intelligence**

## Overview
FleetCore is a full-stack fleet operations and analytics platform.

## Current Phase
**Phase 1 — Foundation**

## Planned Features
* Fleet management
* Driver management
* Trip management
* Real-time telemetry
* Fuel analytics
* Vehicle utilization
* Maintenance management
* Alerts
* Predictive maintenance
* Fleet analytics
* Reporting
* Role-based access control

## Tech Stack
* React
* JavaScript
* Vite
* Tailwind CSS
* Node.js
* Express.js
* Prisma
* MySQL

### Planned Infrastructure
* Redis
* Socket.IO
* BullMQ
* Docker
* GitHub Actions

## Project Structure
* `frontend/` - React frontend
* `backend/` - Express API backend
* `docs/` - Architecture documentation

## Local Setup

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Environment Variables
Copy `.env.example` to `.env` in both `frontend` and `backend` directories and configure appropriately without exposing secrets.

## API
* `GET /api/health` - API health check
* `GET /api/health/db` - Database connection check
