# FleetCore — Enterprise IoT Fleet Management & Autonomous Predictive Intelligence Cockpit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18-61dafb.svg)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-In--Memory%20Cache-DC382D.svg)](https://redis.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black.svg)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

---

## 📌 Project Abstract

Modern commercial transportation and logistics operations face significant challenges: fragmented telematics systems, delayed geospatial tracking, undetected geofence boundary intrusions, high asset depreciation from irregular servicing, and inefficient dispatching. **FleetCore** is an end-to-end, enterprise-grade **IoT Fleet Management & Real-Time Operational Intelligence Platform** engineered to solve these challenges.

Built on an event-driven microservices architecture, FleetCore ingests, enriches, and visualizes high-frequency vehicle telemetry packets (GPS coordinates, CAN bus ignition, compass bearing, instantaneous velocity, fuel levels, and odometer progression) with sub-second latency. The system features a built-in **Autonomous Live GPS Route Simulator** that models realistic vehicle movement across real Coimbatore metropolitan road corridors, a **Ray-Casting Polygon Geofence Engine** capable of detecting unauthorized intrusions and speed violations in real time, an **Automated Preventive Maintenance Lifecycle Scheduler**, and **Role-Based Access Control (RBAC)** across multi-tenant fleet operations.

---

## 📐 System Architecture

FleetCore is structured as a decoupled, multi-tier distributed platform designed for horizontal scalability, zero data loss, and real-time WebSocket streaming:

```mermaid
graph TB
    subgraph IoT & Simulation Layer
        SIM[Autonomous GPS Route Simulator<br/>Coimbatore Corridors]
        OBD[IoT Sensors / CAN Bus / OBD-II Diagnostics]
    end

    subgraph Ingestion & Gateway Layer
        API[Express.js REST Gateway<br/>JWT Auth & RBAC Middleware]
        WS[Socket.IO Event Server<br/>Tenant-Isolated Rooms]
    end

    subgraph Real-Time State & Caching
        REDIS[(Redis 7.0<br/>Atomic State Cache & Pub/Sub)]
        QUEUE[BullMQ Background Queue]
    end

    subgraph Data Persistence
        PRISMA[Prisma ORM Client]
        MYSQL[(MySQL 8.0 Database<br/>ACID Relational Storage)]
    end

    subgraph Presentation Layer
        REACT[React 18 Single Page App<br/>Obsidian Glassmorphic UI]
        LEAFLET[Leaflet Dark Radar Map<br/>Rotating Compass Vectors]
        DASH[Real-Time Telemetry HUD & Analytics]
    end

    SIM -->|Telemetry Packets| API
    OBD -->|Telemetry Packets| API
    API -->|updateStateIfNewer| REDIS
    API -->|Periodic Persistence| PRISMA
    PRISMA --> MYSQL
    REDIS -->|fleet:vehicle:update| WS
    API --> QUEUE
    QUEUE --> PRISMA
    WS -->|WebSocket Stream| REACT
    REACT --> LEAFLET
    REACT --> DASH
```

---

## 🔄 End-to-End Data Processing Workflow

Every telemetry packet moves through an optimized validation, enrichment, caching, and broadcasting pipeline:

```mermaid
sequenceDiagram
    autonumber
    participant Sim as Vehicle / GPS Simulator
    participant API as Express API Server
    participant Redis as Redis Cache
    participant GF as Geofence Engine
    participant DB as MySQL Database
    participant Socket as Socket.IO Hub
    participant Client as Dispatcher Dashboard

    Sim->>API: POST /api/telemetry (lat, lng, speed, heading, fuel)
    API->>API: Authenticate & Validate Packet (Zod Schema)
    API->>Redis: Atomic Update (updateStateIfNewer)
    
    par Real-Time Broadcast
        API->>Socket: Emit fleet:vehicle:update to company:{id}
        Socket->>Client: Instant UI Update (Marker rotates & moves)
    and Geofence Evaluation
        API->>GF: Ray-Casting Point-in-Polygon Check
        opt Perimeter Breach Detected
            GF->>DB: Save GeofenceBreach & Alert record
            GF->>Socket: Emit geofence:breach alert
            Socket->>Client: Display Emergency Audio-Visual Toast
        end
    and Periodic Persistence
        opt Every 5th Tick
            API->>DB: Insert Telemetry historical record
        end
    end
```

---

## 🛡️ Interactive Geofence Engine Workflow

The geofencing subsystem enforces physical boundaries using computational geometry (Jordan Curve Theorem / Ray-Casting algorithm):

```mermaid
flowchart TD
    A[Vehicle GPS Telemetry Received] --> B{Active Geofences Configured?}
    B -- No --> C[Skip Geofence Evaluation]
    B -- Yes --> D[Iterate Company Geofences]
    D --> E{Perimeter Type}
    
    E -- Polygon --> F[Ray-Casting Algorithm<br/>Crossings Counter]
    E -- Circle --> G[Haversine Distance Formula<br/>Distance <= Radius]
    
    F --> H{Rule Enforcement}
    G --> H
    
    H -- NO_ENTRY & Inside --> I[Trigger Intrusion Breach]
    H -- NO_EXIT & Outside --> J[Trigger Boundary Escape Breach]
    H -- SPEED_LIMIT & Inside & Speed > Limit --> K[Trigger Zone Speed Violation]
    H -- Normal Operation --> L[Mark In Compliance]
    
    I --> M[Check Cooldown Timer]
    J --> M
    K --> M
    
    M -- Cooldown Active --> N[Suppress Alert Spam]
    M -- Cooldown Expired --> O[Record Breach in DB + Dispatch Socket.IO Alert]
```

---

## 🗄️ Database Entity Relationship Diagram (ERD)

FleetCore utilizes a structured relational data model in MySQL managed via Prisma ORM:

```mermaid
erDiagram
    Company ||--o{ User : employs
    Company ||--o{ Vehicle : owns
    Company ||--o{ Driver : contracts
    Company ||--o{ VehicleAssignment : allocates
    Company ||--o{ Trip : operates
    Company ||--o{ Geofence : defines
    Company ||--o{ GeofenceBreach : tracks
    Company ||--o{ MaintenanceSchedule : configures
    Company ||--o{ Alert : monitors
    Company ||--o{ AuditLog : records

    Vehicle ||--o{ VehicleAssignment : assigned
    Vehicle ||--o{ Trip : fulfills
    Vehicle ||--o{ Telemetry : transmits
    Vehicle ||--o{ GeofenceBreach : triggers
    Vehicle ||--o{ MaintenanceSchedule : requires
    Vehicle ||--o{ MaintenanceRecord : undergoes
    Vehicle ||--o{ Alert : raises

    Driver ||--o{ VehicleAssignment : operates
    Driver ||--o{ Trip : drives

    Geofence ||--o{ GeofenceBreach : registers
    MaintenanceSchedule ||--o{ MaintenanceRecord : generates
    MaintenanceSchedule ||--o{ Alert : triggers

    User ||--o{ RefreshSession : owns
    User ||--o{ AuditLog : performs
```

---

## ⚡ Core Modules & Key Features

### 1. 🚗 Autonomous Live GPS Route Simulator
- **6 Coimbatore Road Corridors**: Avinashi Road Express, Saravanampatti IT Corridor (TIDEL Park $\leftrightarrow$ CHIL SEZ), Airport Cargo Transit, Trichy Road, Mettupalayam Highway, and Pollachi Highway.
- **Dynamic Physics Calculation**: Trigonometric bearing calculation (`calculateHeading`) orienting vehicle vectors in 360°, speed fluctuation ($25$–$70\text{ km/h}$), odometer accumulation, and fuel consumption.
- **Interactive HUD**: Dispatchers can toggle simulator state (`PAUSE`/`RUN`), switch speed multipliers (`1x`, `2x`, `5x`), or reset fleet positions to starting hubs with one click.

### 2. 🗺️ Interactive Geofence Builder & Real-Time Breach Engine
- **Visual Polygon Drawing**: Click-to-draw custom polygons directly on the dark OpenStreetMap canvas.
- **Ray-Casting Algorithm**: Real-time point-in-polygon computational geometry evaluating every vehicle tick.
- **Enforcement Rules**: `NO_ENTRY` (High security tarmac/depots), `NO_EXIT` (Territory boundaries), and `SPEED_LIMIT` (Congestion zones).
- **Intrusion LED Toast**: Instantaneous audio-visual broadcast alerting dispatchers when boundaries are violated.

### 3. 📡 Live Fleet Command Center
- **Dark Obsidian Aesthetics**: Glassmorphic panels, glowing radar rings, and dynamic SVG vehicle arrows.
- **CAN Bus / OBD-II Telemetry Gauges**: Real-time speedometer, fuel tank levels, engine ignition status (`ON`/`OFF`), and driver metadata.
- **Roster Filtering**: Instant search and filtering by vehicle status (`ONLINE`, `STALE`, `OFFLINE`).

### 4. 🔧 Preventive Maintenance Engine
- **Multi-Metric Triggers**: Mileage-based intervals (e.g., Oil Change every $10,000\text{ km}$) and calendar intervals (e.g., Brake Check every $90\text{ days}$).
- **Automated Overdue Escalation**: Flags vehicles approaching service thresholds and generates critical maintenance alerts.

### 5. 🔐 Multi-Tenant Security & RBAC
- **Four Granular Roles**: `ADMIN`, `FLEET_MANAGER`, `DRIVER`, and `VIEWER`.
- **JWT Architecture**: 15-minute access tokens + HTTP-only rotation refresh cookies (7-day validity).
- **Tenant Isolation**: Every database query is strictly scoped to `companyId`.

---

## 💻 Tech Stack Summary

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React-Leaflet, TailwindCSS, Lucide Icons, Socket.IO Client |
| **Backend API** | Node.js, Express.js, Socket.IO, Prisma ORM, Zod, JWT |
| **Database** | MySQL 8.0 (Relational Storage & Telemetry Logs) |
| **Caching & Messaging** | Redis 7.0 (In-Memory Live States & Event Pub/Sub) |
| **Asynchronous Jobs** | BullMQ (Background queues, maintenance schedulers, report generators) |
| **Containerization** | Docker, Docker Compose, Nginx Alpine |

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js** v20.x or higher
- **MySQL Server** 8.0 (Local instance or Docker)
- **Redis Server** 7.0 (Local instance or Docker)
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/rakshita1802/FleetCore.git
cd FleetCore
```

---

### Step 2: Configure Environment Variables

**Backend (`backend/.env`):**
```env
PORT=5000
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/fleetcore"
REDIS_URL="redis://localhost:6379"
CLIENT_URL="http://localhost:5173,http://localhost:5174,http://localhost:5175"
ACCESS_TOKEN_SECRET="dev_access_secret_key_fleetcore_12345"
REFRESH_TOKEN_SECRET="dev_refresh_secret_key_fleetcore_67890"
TELEMETRY_ONLINE_THRESHOLD_SECONDS=60
TELEMETRY_STALE_THRESHOLD_SECONDS=300
```

**Frontend (`frontend/.env`):**
```env
VITE_API_BASE_URL="http://localhost:5000/api"
VITE_SOCKET_URL="http://localhost:5000"
```

---

### Step 3: Initialize MySQL Database & Prisma Schema

```bash
cd backend
npm install

# Push database schema to MySQL
npx prisma db push

# Seed default demo users, vehicles, drivers & Coimbatore routes
node prisma/seed.js
```

---

### Step 4: Run the Application Locally

**Terminal 1 — Backend API:**
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

**Terminal 2 — Frontend App:**
```bash
cd frontend
npm install
npm run dev -- --port 5175
# App running at http://localhost:5175
```

---

### 🐳 Optional: Run with Docker Compose
If you prefer running the entire stack via Docker:

```bash
docker compose up -d --build
```
- Frontend Web App: `http://localhost:5174`
- Backend API: `http://localhost:5000`
- MySQL Database: `localhost:3307`
- Redis: `localhost:6380`

---

## 🔑 Default Seeded Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Executive Admin** | `admin@cit.edu` | `Admin@12345` |
| **Fleet Manager** | `manager@cit.edu` | `Admin@12345` |
| **Fleet Driver** | `murugan.driver@cit.edu.in` | `Password123!` |

---

## 🌐 API Reference Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & issue tokens | Public |
| `GET` | `/api/fleet/live` | Retrieve live telemetry state for all active vehicles | Yes |
| `GET` | `/api/simulator/status`| Get GPS Route Simulator active status | Yes |
| `POST` | `/api/simulator/speed` | Set simulation speed multiplier (`1x`, `2x`, `5x`)| Yes |
| `GET` | `/api/geofences` | List all defined company geofences | Yes |
| `POST` | `/api/geofences` | Create new polygon/circular geofence boundary | Admin / Manager |
| `GET` | `/api/geofences/breaches`| View live and historical boundary breach events | Yes |
| `POST` | `/api/geofences/breaches/:id/resolve`| Mark breach event resolved | Admin / Manager |
| `GET` | `/api/vehicles` | List fleet vehicles & current status | Yes |
| `GET` | `/api/maintenance/schedules`| View preventive maintenance service schedules | Yes |

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
