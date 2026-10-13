const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const liveFleetService = require('./liveFleetService');

// Realistic Coimbatore Road Corridors
const COIMBATORE_ROUTES = [
  // Route 1: Avinashi Road Express (CIT Campus <-> Coimbatore Junction)
  [
    { lat: 11.0283, lng: 77.0275, speed: 45 },
    { lat: 11.0255, lng: 77.0210, speed: 52 },
    { lat: 11.0210, lng: 77.0090, speed: 48 },
    { lat: 11.0180, lng: 76.9980, speed: 38 },
    { lat: 11.0150, lng: 76.9850, speed: 42 },
    { lat: 11.0120, lng: 76.9740, speed: 32 },
    { lat: 11.0065, lng: 76.9680, speed: 28 },
    { lat: 10.9980, lng: 76.9630, speed: 18 }
  ],
  // Route 2: Saravanampatti IT Corridor (TIDEL Park <-> CHIL SEZ)
  [
    { lat: 11.0250, lng: 77.0150, speed: 50 },
    { lat: 11.0380, lng: 77.0110, speed: 55 },
    { lat: 11.0550, lng: 76.9980, speed: 60 },
    { lat: 11.0720, lng: 76.9920, speed: 45 },
    { lat: 11.0850, lng: 76.9880, speed: 35 }
  ],
  // Route 3: Airport & Cargo Transit (CIT Campus <-> Neelambur Bypass)
  [
    { lat: 11.0280, lng: 77.0275, speed: 40 },
    { lat: 11.0330, lng: 77.0380, speed: 50 },
    { lat: 11.0298, lng: 77.0434, speed: 25 },
    { lat: 11.0410, lng: 77.0580, speed: 62 },
    { lat: 11.0580, lng: 77.0850, speed: 70 }
  ],
  // Route 4: Trichy Road Corridor (Singanallur <-> Town Hall)
  [
    { lat: 11.0020, lng: 77.0200, speed: 44 },
    { lat: 10.9995, lng: 77.0080, speed: 48 },
    { lat: 10.9970, lng: 76.9950, speed: 42 },
    { lat: 10.9950, lng: 76.9820, speed: 36 },
    { lat: 10.9930, lng: 76.9680, speed: 30 },
    { lat: 10.9920, lng: 76.9550, speed: 22 }
  ],
  // Route 5: Mettupalayam Highway (Gandhipuram <-> Thudiyalur)
  [
    { lat: 11.0180, lng: 76.9650, speed: 32 },
    { lat: 11.0350, lng: 76.9520, speed: 48 },
    { lat: 11.0520, lng: 76.9420, speed: 58 },
    { lat: 11.0680, lng: 76.9380, speed: 64 },
    { lat: 11.0850, lng: 76.9320, speed: 42 }
  ],
  // Route 6: Pollachi Highway (Eachanari <-> Kinathukadavu)
  [
    { lat: 10.9550, lng: 76.9650, speed: 55 },
    { lat: 10.9320, lng: 76.9780, speed: 65 },
    { lat: 10.9100, lng: 76.9920, speed: 70 },
    { lat: 10.8750, lng: 77.0080, speed: 62 }
  ]
];

function calculateHeading(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
            Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}

class GpsSimulatorService {
  constructor() {
    this.intervalHandle = null;
    this.isRunning = false;
    this.intervalMs = 2500; // Base: 2.5 seconds per tick
    this.speedMultiplier = 1; // 1x, 2x, 5x
    this.tickCount = 0;
    this.vehicleSimStates = new Map();
    this.companyId = null;
  }

  async initialize() {
    try {
      // Find company
      const company = await prisma.company.findFirst();
      if (!company) return;
      this.companyId = company.id;

      // Find active vehicles
      const vehicles = await prisma.vehicle.findMany({
        where: { companyId: this.companyId, status: 'ACTIVE' },
        include: {
          assignments: {
            where: { isActive: true },
            include: { driver: true }
          },
          trips: {
            where: { status: 'IN_PROGRESS' },
            take: 1
          }
        }
      });

      if (vehicles.length === 0) return;

      // Assign realistic corridors to each vehicle
      vehicles.forEach((veh, index) => {
        const route = COIMBATORE_ROUTES[index % COIMBATORE_ROUTES.length];
        const initialPoint = route[0];
        
        this.vehicleSimStates.set(veh.id, {
          vehicleId: veh.id,
          registrationNumber: veh.registrationNumber,
          routeIndex: index % COIMBATORE_ROUTES.length,
          currentWaypointIndex: 0,
          targetWaypointIndex: 1,
          progress: 0, // 0 to 1 between current and target
          direction: 1, // 1 forward, -1 reverse
          latitude: initialPoint.lat,
          longitude: initialPoint.lng,
          speedKph: initialPoint.speed,
          heading: 90,
          fuelLevel: veh.vehicleType === 'ELECTRIC' ? 88.0 : 76.5,
          odometer: Number(veh.odometer || 45000),
          engineStatus: 'ON',
          tripId: veh.trips[0]?.id || null,
          driverName: veh.assignments[0]?.driver?.name || null
        });
      });

      console.log(`📡 Autonomous GPS Simulator initialized with ${this.vehicleSimStates.size} vehicles in Coimbatore.`);
      
      // Auto-start simulation by default
      this.start();
    } catch (err) {
      console.error('Failed to initialize GPS simulator:', err);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const tickInterval = Math.max(500, Math.round(this.intervalMs / this.speedMultiplier));
    this.intervalHandle = setInterval(() => this.step(), tickInterval);
    console.log(`🚀 Autonomous GPS Simulator STARTED (interval: ${tickInterval}ms, ${this.speedMultiplier}x)`);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    console.log('⏸️ Autonomous GPS Simulator PAUSED.');
  }

  setSpeed(multiplier = 1) {
    this.speedMultiplier = Math.max(1, Math.min(10, multiplier));
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    return this.getStatus();
  }

  reset() {
    this.tickCount = 0;
    for (const [vehId, state] of this.vehicleSimStates.entries()) {
      const route = COIMBATORE_ROUTES[state.routeIndex];
      const startPoint = route[0];
      state.currentWaypointIndex = 0;
      state.targetWaypointIndex = 1;
      state.progress = 0;
      state.direction = 1;
      state.latitude = startPoint.lat;
      state.longitude = startPoint.lng;
      state.speedKph = startPoint.speed;
      state.fuelLevel = 90.0;
    }
    console.log('🔄 Autonomous GPS Simulator reset to origin points.');
    return this.getStatus();
  }

  getStatus() {
    return {
      running: this.isRunning,
      activeVehicles: this.vehicleSimStates.size,
      speedMultiplier: this.speedMultiplier,
      tickCount: this.tickCount,
      intervalMs: this.intervalMs,
      city: 'Coimbatore, Tamil Nadu'
    };
  }

  async step() {
    if (!this.isRunning || !this.companyId || this.vehicleSimStates.size === 0) return;

    this.tickCount++;
    const now = new Date();
    const shouldPersistDb = this.tickCount % 5 === 0; // Persist every 5th tick to keep DB clean

    for (const [vehId, sim] of this.vehicleSimStates.entries()) {
      const route = COIMBATORE_ROUTES[sim.routeIndex];
      const fromPoint = route[sim.currentWaypointIndex];
      const toPoint = route[sim.targetWaypointIndex];

      // Advance progress along polyline
      const stepDelta = 0.08 * this.speedMultiplier;
      sim.progress += stepDelta;

      if (sim.progress >= 1) {
        sim.progress = 0;
        sim.currentWaypointIndex = sim.targetWaypointIndex;

        // Check if route ended, shuttle reverse
        if (sim.direction === 1) {
          if (sim.targetWaypointIndex >= route.length - 1) {
            sim.direction = -1;
            sim.targetWaypointIndex = route.length - 2;
          } else {
            sim.targetWaypointIndex += 1;
          }
        } else {
          if (sim.targetWaypointIndex <= 0) {
            sim.direction = 1;
            sim.targetWaypointIndex = 1;
          } else {
            sim.targetWaypointIndex -= 1;
          }
        }
      }

      // Linear interpolation between waypoints
      const curFrom = route[sim.currentWaypointIndex];
      const curTo = route[sim.targetWaypointIndex];
      
      const prevLat = sim.latitude;
      const prevLng = sim.longitude;

      sim.latitude = curFrom.lat + (curTo.lat - curFrom.lat) * sim.progress;
      sim.longitude = curFrom.lng + (curTo.lng - curFrom.lng) * sim.progress;

      // Realistic speed fluctuation (±5 km/h around waypoint target speed)
      const baseSpeed = curTo.speed || 40;
      const jitter = (Math.sin(this.tickCount + sim.routeIndex) * 4);
      sim.speedKph = Math.max(15, Math.min(80, baseSpeed + jitter));

      // Calculate smooth bearing heading
      sim.heading = Math.round(calculateHeading(prevLat, prevLng, curTo.lat, curTo.lng));

      // Fuel consumption and odometer
      const distTraversedKm = (sim.speedKph * (2.5 / 3600)) * this.speedMultiplier;
      sim.odometer += distTraversedKm;
      sim.fuelLevel = Math.max(10.0, sim.fuelLevel - (distTraversedKm * 0.04));

      // Assemble enriched telemetry packet
      const telemetryPacket = {
        vehicleId: sim.vehicleId,
        timestamp: now.toISOString(),
        latitude: parseFloat(sim.latitude.toFixed(6)),
        longitude: parseFloat(sim.longitude.toFixed(6)),
        speedKph: parseFloat(sim.speedKph.toFixed(1)),
        heading: sim.heading,
        fuelLevel: parseFloat(sim.fuelLevel.toFixed(1)),
        engineStatus: 'ON',
        odometer: parseFloat(sim.odometer.toFixed(1)),
        tripId: sim.tripId
      };

      // 1. Process live state through Redis and emit Socket.IO to connected clients
      try {
        await liveFleetService.processTelemetry(this.companyId, telemetryPacket);
      } catch (err) {
        // Continue silently on transient emission
      }

      // 2. Persist to MySQL database periodically
      if (shouldPersistDb) {
        prisma.telemetry.create({
          data: {
            vehicleId: telemetryPacket.vehicleId,
            companyId: this.companyId,
            timestamp: now,
            latitude: telemetryPacket.latitude,
            longitude: telemetryPacket.longitude,
            speedKph: telemetryPacket.speedKph,
            heading: telemetryPacket.heading,
            fuelLevel: telemetryPacket.fuelLevel,
            engineStatus: telemetryPacket.engineStatus,
            odometer: telemetryPacket.odometer,
            tripId: telemetryPacket.tripId
          }
        }).catch(() => {});
      }
    }
  }
}

const simulatorInstance = new GpsSimulatorService();

module.exports = simulatorInstance;
