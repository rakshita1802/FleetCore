const redisService = require('./redisService');
const socketService = require('../socket');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getFreshnessStatus = (eventTimestamp) => {
  const ONLINE_THRESHOLD = parseInt(process.env.TELEMETRY_ONLINE_THRESHOLD_SECONDS || '60', 10);
  const STALE_THRESHOLD = parseInt(process.env.TELEMETRY_STALE_THRESHOLD_SECONDS || '300', 10);
  
  const now = new Date().getTime();
  const eventTime = new Date(eventTimestamp).getTime();
  const diffSeconds = (now - eventTime) / 1000;

  if (diffSeconds <= ONLINE_THRESHOLD) return 'ONLINE';
  if (diffSeconds <= STALE_THRESHOLD) return 'STALE';
  return 'OFFLINE';
};

const processTelemetry = async (companyId, telemetryData) => {
  // 1. Determine live status
  const status = getFreshnessStatus(telemetryData.timestamp);

  // 2. Enrich state with vehicle & active assignment info for the dashboard
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: telemetryData.vehicleId, companyId },
    select: { registrationNumber: true, make: true, model: true, vehicleType: true }
  });

  const assignment = await prisma.vehicleAssignment.findFirst({
    where: { vehicleId: telemetryData.vehicleId, companyId, isActive: true },
    include: {
      driver: { select: { userId: true, name: true, employeeCode: true } }
    }
  });

  const newState = {
    vehicleId: telemetryData.vehicleId,
    companyId: companyId,
    timestamp: telemetryData.timestamp,
    latitude: telemetryData.latitude,
    longitude: telemetryData.longitude,
    speedKph: telemetryData.speedKph,
    heading: telemetryData.heading,
    fuelLevel: telemetryData.fuelLevel,
    engineStatus: telemetryData.engineStatus,
    odometer: telemetryData.odometer,
    tripId: telemetryData.tripId || null,
    status: status,
    // Enriched Info
    registrationNumber: vehicle?.registrationNumber,
    make: vehicle?.make,
    model: vehicle?.model,
    vehicleType: vehicle?.vehicleType,
    driverName: assignment?.driver?.name,
    driverEmployeeCode: assignment?.driver?.employeeCode,
    driverUserId: assignment?.driver?.userId
  };

  // 3. Save to Redis (Atomically check if incoming is newer)
  const updated = await redisService.updateStateIfNewer(companyId, telemetryData.vehicleId, newState);

  // 4. Emit Socket Event only if updated
  if (updated) {
    try {
      socketService.emitVehicleUpdate(companyId, newState.driverUserId, telemetryData.vehicleId, newState);
    } catch (err) {
      console.error("Socket emission failed, but state updated safely.");
    }
  }

  // 5. Evaluate Real-Time Geofence Boundaries & Breach Conditions
  try {
    const geofenceService = require('./geofenceService');
    geofenceService.evaluateTelemetry(companyId, newState).catch(() => {});
  } catch (err) {
    // Continue silently
  }
};

const getLiveFleet = async (companyId, driverRoleAccessId = null, driverUserId = null) => {
  // Get all vehicles for the company
  const where = { companyId };
  if (driverRoleAccessId) {
    // If DRIVER, only get assigned vehicle
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { driverId: driverRoleAccessId, isActive: true, companyId }
    });
    if (!assignment) return []; // Driver has no vehicle
    where.id = assignment.vehicleId;
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: { id: true, registrationNumber: true, make: true, model: true, vehicleType: true }
  });

  const activeAssignments = await prisma.vehicleAssignment.findMany({
    where: { companyId, isActive: true },
    include: { driver: { select: { userId: true, name: true, employeeCode: true } } }
  });
  const assignmentMap = new Map(activeAssignments.map(a => [a.vehicleId, a]));

  const vehicleIdsMissingRedis = [];
  const liveStates = [];

  // Check Redis for each vehicle
  await Promise.all(vehicles.map(async (v) => {
    let state = await redisService.getVehicleState(companyId, v.id);
    if (state) {
      state.status = getFreshnessStatus(state.timestamp);
      liveStates.push(state);
    } else {
      vehicleIdsMissingRedis.push(v);
    }
  }));

  if (vehicleIdsMissingRedis.length > 0) {
    // Fallback: Fetch latest telemetry for all missing vehicles efficiently using distinct
    const latestTelemetries = await prisma.telemetry.findMany({
      where: { 
        companyId, 
        vehicleId: { in: vehicleIdsMissingRedis.map(v => v.id) } 
      },
      orderBy: { timestamp: 'desc' },
      distinct: ['vehicleId']
    });
    
    const telMap = new Map(latestTelemetries.map(t => [t.vehicleId, t]));

    // Construct states and write back to Redis in parallel
    const missingStates = await Promise.all(vehicleIdsMissingRedis.map(async (v) => {
      const latestTel = telMap.get(v.id);
      const assignment = assignmentMap.get(v.id);

      if (latestTel) {
        const state = {
          vehicleId: v.id,
          companyId: companyId,
          timestamp: latestTel.timestamp,
          latitude: latestTel.latitude,
          longitude: latestTel.longitude,
          speedKph: latestTel.speedKph,
          heading: latestTel.heading,
          fuelLevel: latestTel.fuelLevel,
          engineStatus: latestTel.engineStatus,
          odometer: latestTel.odometer,
          tripId: latestTel.tripId || null,
          status: getFreshnessStatus(latestTel.timestamp),
          registrationNumber: v.registrationNumber,
          make: v.make,
          model: v.model,
          vehicleType: v.vehicleType,
          driverName: assignment?.driver?.name,
          driverEmployeeCode: assignment?.driver?.employeeCode,
          driverUserId: assignment?.driver?.userId
        };
        // Populate cache async
        redisService.setVehicleState(companyId, v.id, state);
        return state;
      }

      return {
        vehicleId: v.id,
        companyId: companyId,
        status: 'OFFLINE',
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        vehicleType: v.vehicleType
      };
    }));
    
    liveStates.push(...missingStates);
  }

  return liveStates;
};

const getVehicleLiveState = async (companyId, vehicleId) => {
  const states = await getLiveFleet(companyId);
  const state = states.find(s => s.vehicleId === vehicleId);
  return state || null;
};

module.exports = {
  processTelemetry,
  getLiveFleet,
  getVehicleLiveState
};
