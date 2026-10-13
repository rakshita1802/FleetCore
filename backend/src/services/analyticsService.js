const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getOverview = async (companyId, startDate, endDate, driverFilter) => {
  const whereTrips = {
    companyId,
    createdAt: { gte: startDate, lte: endDate },
    ...driverFilter?.tripWhere
  };

  const trips = await prisma.trip.findMany({
    where: whereTrips,
    select: {
      status: true,
      distanceKm: true,
      actualStartAt: true,
      actualEndAt: true
    }
  });

  let totalTrips = trips.length;
  let completedTrips = 0;
  let cancelledTrips = 0;
  let inProgressTrips = 0;
  let plannedTrips = 0;
  let totalDistanceKm = 0;
  let totalDrivingTimeMinutes = 0;

  for (const t of trips) {
    if (t.status === 'COMPLETED') completedTrips++;
    if (t.status === 'CANCELLED') cancelledTrips++;
    if (t.status === 'IN_PROGRESS') inProgressTrips++;
    if (t.status === 'PLANNED') plannedTrips++;
    if (t.distanceKm) totalDistanceKm += t.distanceKm;
    
    if (t.status === 'COMPLETED' && t.actualStartAt && t.actualEndAt) {
      totalDrivingTimeMinutes += (t.actualEndAt.getTime() - t.actualStartAt.getTime()) / 60000;
    }
  }

  // Active vehicles in this period (vehicles that had a trip)
  const uniqueVehiclesWithTrips = new Set(
    await prisma.trip.findMany({
      where: whereTrips,
      select: { vehicleId: true },
      distinct: ['vehicleId']
    }).then(res => res.map(r => r.vehicleId))
  );

  // For vehicles overview, driver might only have access to 1 vehicle
  const whereVehicles = { companyId, ...driverFilter?.vehicleWhere };
  const totalVehicles = await prisma.vehicle.count({ where: whereVehicles });
  const activeVehicles = await prisma.vehicle.count({ where: { ...whereVehicles, status: 'ACTIVE' } });

  // Idle time estimation using observed telemetry duration
  const MAX_IDLE_INTERVAL_SECONDS = parseInt(process.env.MAX_IDLE_INTERVAL_SECONDS || '300', 10);
  
  const idleRaw = await prisma.$queryRaw`
    WITH TelemetryWindows AS (
      SELECT 
        engineStatus,
        timestamp as current_ts,
        LEAD(timestamp) OVER (PARTITION BY vehicleId ORDER BY timestamp ASC) as next_ts
      FROM Telemetry
      WHERE companyId = ${companyId}
        AND timestamp >= ${startDate}
        AND timestamp <= ${endDate}
        ${driverFilter?.rawVehicleWhere || prisma.empty}
    )
    SELECT SUM(TIMESTAMPDIFF(SECOND, current_ts, next_ts)) / 60 as totalIdleMinutes
    FROM TelemetryWindows
    WHERE engineStatus = 'IDLE'
      AND next_ts IS NOT NULL
      AND TIMESTAMPDIFF(SECOND, current_ts, next_ts) <= ${MAX_IDLE_INTERVAL_SECONDS}
  `;

  const totalIdleTime = idleRaw[0]?.totalIdleMinutes ? parseFloat(Number(idleRaw[0].totalIdleMinutes).toFixed(1)) : 0;
  
  const terminalTrips = completedTrips + cancelledTrips;

  return {
    totalVehicles,
    activeVehicles,
    vehiclesWithTrips: uniqueVehiclesWithTrips.size,
    totalTrips,
    completedTrips,
    cancelledTrips,
    inProgressTrips,
    plannedTrips,
    completionRate: terminalTrips > 0 ? (completedTrips / terminalTrips) : null,
    cancellationRate: terminalTrips > 0 ? (cancelledTrips / terminalTrips) : null,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    averageTripDistanceKm: completedTrips > 0 ? parseFloat((totalDistanceKm / completedTrips).toFixed(2)) : 0,
    totalDrivingTimeMinutes: Math.round(totalDrivingTimeMinutes),
    totalIdleTimeMinutes: totalIdleTime,
  };
};

const getTrends = async (companyId, startDate, endDate, groupBy, driverFilter) => {
  // Use raw SQL to group by day/week/month efficiently
  let dateFormat = '%Y-%m-%d';
  if (groupBy === 'week') dateFormat = '%x-%v';
  if (groupBy === 'month') dateFormat = '%Y-%m';

  // We group trips by their createdAt date
  const tripsRaw = await prisma.$queryRaw`
    SELECT 
      DATE_FORMAT(createdAt, ${dateFormat}) as period,
      COUNT(*) as tripCount,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedTrips,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelledTrips,
      SUM(distanceKm) as distanceKm
    FROM Trip
    WHERE companyId = ${companyId}
      AND createdAt >= ${startDate}
      AND createdAt <= ${endDate}
      ${driverFilter?.rawTripWhere || prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;

  const MAX_IDLE_INTERVAL_SECONDS = parseInt(process.env.MAX_IDLE_INTERVAL_SECONDS || '300', 10);

  const idleRaw = await prisma.$queryRaw`
    WITH TelemetryWindows AS (
      SELECT 
        timestamp as current_ts,
        engineStatus,
        LEAD(timestamp) OVER (PARTITION BY vehicleId ORDER BY timestamp ASC) as next_ts
      FROM Telemetry
      WHERE companyId = ${companyId}
        AND timestamp >= ${startDate}
        AND timestamp <= ${endDate}
        ${driverFilter?.rawVehicleWhere || prisma.empty}
    )
    SELECT 
      DATE_FORMAT(current_ts, ${dateFormat}) as period,
      SUM(TIMESTAMPDIFF(SECOND, current_ts, next_ts)) / 60 as idleMinutes
    FROM TelemetryWindows
    WHERE engineStatus = 'IDLE'
      AND next_ts IS NOT NULL
      AND TIMESTAMPDIFF(SECOND, current_ts, next_ts) <= ${MAX_IDLE_INTERVAL_SECONDS}
    GROUP BY period
    ORDER BY period ASC
  `;

  // Merge results
  const map = new Map();
  
  for (const t of tripsRaw) {
    map.set(t.period, {
      period: t.period,
      tripCount: Number(t.tripCount),
      completedTrips: Number(t.completedTrips),
      cancelledTrips: Number(t.cancelledTrips),
      distanceKm: t.distanceKm ? parseFloat(Number(t.distanceKm).toFixed(2)) : 0,
      idleMinutes: 0
    });
  }

  for (const i of idleRaw) {
    if (!map.has(i.period)) {
      map.set(i.period, { period: i.period, tripCount: 0, completedTrips: 0, cancelledTrips: 0, distanceKm: 0, idleMinutes: 0 });
    }
    map.get(i.period).idleMinutes = Number(i.idleMinutes);
  }

  const result = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  return result;
};

const getUtilization = async (companyId, startDate, endDate, driverFilter) => {
  // We only care about ACTIVE eligible vehicles for the denominator
  const whereVehicles = { companyId, status: 'ACTIVE', ...driverFilter?.vehicleWhere };
  
  const allVehicles = await prisma.vehicle.findMany({
    where: whereVehicles,
    select: { id: true, registrationNumber: true }
  });

  const tripStats = await prisma.trip.groupBy({
    by: ['vehicleId'],
    where: {
      companyId,
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ['COMPLETED', 'IN_PROGRESS'] },
      ...driverFilter?.tripWhere
    },
    _count: { id: true },
    _sum: { distanceKm: true }
  });

  const tripMap = new Map(tripStats.map(s => [s.vehicleId, s]));

  const vehicleStats = allVehicles.map(v => {
    const stats = tripMap.get(v.id);
    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      tripCount: stats?._count?.id || 0,
      distanceKm: stats?._sum?.distanceKm || 0,
      utilizationRate: stats?._count?.id > 0 ? 1 : 0 // 100% utilized if it had a trip, 0% if not (Phase 7 definition)
    };
  });

  const vehiclesUsed = vehicleStats.filter(v => v.tripCount > 0).length;
  const total = vehicleStats.length;

  return {
    vehiclesUsed,
    unusedVehicles: total - vehiclesUsed,
    utilizationRate: total > 0 ? (vehiclesUsed / total) : 0,
    vehicleRankings: vehicleStats.sort((a, b) => b.tripCount - a.tripCount) // Sort by trips
  };
};

const getFuel = async (companyId, startDate, endDate, driverFilter) => {
  // Fuel is estimated as (start_fuel - end_fuel) percent. 
  // We cannot derive liters, so we just return fuel level change.
  // Using raw SQL to get min and max timestamp per vehicle and compare fuelLevel
  
  const fuelRaw = await prisma.$queryRaw`
    SELECT 
      v.id as vehicleId, 
      v.registrationNumber,
      v.fuelType,
      (SELECT fuelLevel FROM Telemetry t1 WHERE t1.vehicleId = v.id AND t1.timestamp >= ${startDate} AND t1.timestamp <= ${endDate} ORDER BY t1.timestamp ASC LIMIT 1) as fuelStart,
      (SELECT fuelLevel FROM Telemetry t2 WHERE t2.vehicleId = v.id AND t2.timestamp >= ${startDate} AND t2.timestamp <= ${endDate} ORDER BY t2.timestamp DESC LIMIT 1) as fuelEnd,
      (SELECT SUM(distanceKm) FROM Trip tr WHERE tr.vehicleId = v.id AND tr.createdAt >= ${startDate} AND tr.createdAt <= ${endDate}) as distanceKm
    FROM Vehicle v
    WHERE v.companyId = ${companyId}
    ${driverFilter?.rawVehicleIdWhere || prisma.empty}
  `;

  return fuelRaw.map(v => {
    const start = v.fuelStart !== null ? Number(v.fuelStart) : null;
    const end = v.fuelEnd !== null ? Number(v.fuelEnd) : null;
    const change = (start !== null && end !== null) ? parseFloat((start - end).toFixed(2)) : null;

    return {
      vehicleId: v.vehicleId,
      registrationNumber: v.registrationNumber,
      fuelType: v.fuelType,
      distanceKm: v.distanceKm ? Number(v.distanceKm) : 0,
      fuelLevelStart: start,
      fuelLevelEnd: end,
      fuelLevelChange: change
    };
  }).filter(v => v.fuelLevelStart !== null || v.distanceKm > 0);
};

const getIdleTime = async (companyId, startDate, endDate, driverFilter) => {
  const MAX_IDLE_INTERVAL_SECONDS = parseInt(process.env.MAX_IDLE_INTERVAL_SECONDS || '300', 10);

  const raw = await prisma.$queryRaw`
    WITH TelemetryWindows AS (
      SELECT 
        vehicleId,
        engineStatus,
        timestamp as current_ts,
        LEAD(timestamp) OVER (PARTITION BY vehicleId ORDER BY timestamp ASC) as next_ts
      FROM Telemetry
      WHERE companyId = ${companyId}
        AND timestamp >= ${startDate}
        AND timestamp <= ${endDate}
    )
    SELECT 
      v.id as vehicleId,
      v.registrationNumber,
      SUM(TIMESTAMPDIFF(SECOND, w.current_ts, w.next_ts)) / 60 as idleMinutes
    FROM Vehicle v
    JOIN TelemetryWindows w ON w.vehicleId = v.id
    WHERE v.companyId = ${companyId}
      AND w.engineStatus = 'IDLE'
      AND w.next_ts IS NOT NULL
      AND TIMESTAMPDIFF(SECOND, w.current_ts, w.next_ts) <= ${MAX_IDLE_INTERVAL_SECONDS}
      ${driverFilter?.rawVehicleIdWhere || prisma.empty}
    GROUP BY v.id
    HAVING idleMinutes > 0
    ORDER BY idleMinutes DESC
  `;

  let totalIdleMinutes = 0;
  const list = raw.map(r => {
    const mins = Number(r.idleMinutes);
    totalIdleMinutes += mins;
    return {
      vehicleId: r.vehicleId,
      registrationNumber: r.registrationNumber,
      idleMinutes: mins
    };
  });

  return {
    totalIdleMinutes,
    averageIdleMinutesPerVehicle: list.length > 0 ? parseFloat((totalIdleMinutes / list.length).toFixed(1)) : 0,
    vehicleRankings: list
  };
};

module.exports = {
  getOverview,
  getTrends,
  getUtilization,
  getFuel,
  getIdleTime
};
