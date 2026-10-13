const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ingest = async (companyId, data) => {
  // Validate vehicle belongs to company
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: data.vehicleId, companyId }
  });
  if (!vehicle) {
    throw Object.assign(new Error("Vehicle not found or cross-tenant access"), { code: 404 });
  }

  // Validate trip if provided
  if (data.tripId) {
    const trip = await prisma.trip.findFirst({
      where: { id: data.tripId, companyId }
    });
    if (!trip) {
      throw Object.assign(new Error("Trip not found or cross-tenant access"), { code: 404 });
    }
    if (trip.vehicleId !== data.vehicleId) {
      throw Object.assign(new Error("Trip does not belong to the specified vehicle"), { code: 409 });
    }
  }

  const telemetry = await prisma.telemetry.create({
    data: {
      ...data,
      companyId
    }
  });

  // Trigger real-time Redis + Socket flow async
  const liveFleetService = require('./liveFleetService');
  liveFleetService.processTelemetry(companyId, telemetry).catch(err => {
    console.error("Live Fleet Update Error:", err);
  });

  return telemetry;
};

const buildQueryOptions = (companyId, { page = 1, limit = 20, vehicleId, tripId, startTime, endTime, sortBy = 'timestamp', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;
  const where = { companyId };

  if (vehicleId) where.vehicleId = vehicleId;
  if (tripId) where.tripId = tripId;

  if (startTime || endTime) {
    where.timestamp = {};
    if (startTime) where.timestamp.gte = new Date(startTime);
    if (endTime) where.timestamp.lte = new Date(endTime);
  }

  const allowedSortFields = ['timestamp', 'speedKph', 'fuelLevel', 'odometer', 'createdAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  // Enforce max limit of 100
  const safeLimit = Math.min(Number(limit), 100);

  return {
    where,
    skip,
    take: safeLimit,
    orderBy: { [safeSortBy]: safeSortOrder }
  };
};

const getTelemetry = async (companyId, params) => {
  const options = buildQueryOptions(companyId, params);

  const [total, data] = await Promise.all([
    prisma.telemetry.count({ where: options.where }),
    prisma.telemetry.findMany(options)
  ]);

  return {
    data,
    pagination: {
      page: Number(params.page || 1),
      limit: options.take,
      total,
      totalPages: Math.ceil(total / options.take)
    }
  };
};

const getTelemetryById = async (companyId, id) => {
  return prisma.telemetry.findFirst({
    where: { id, companyId },
    include: {
      vehicle: true,
      trip: true
    }
  });
};

const getVehicleTelemetry = async (companyId, vehicleId, params) => {
  // Validate vehicle exists in tenant
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { code: 404 });

  return getTelemetry(companyId, { ...params, vehicleId });
};

const getTripTelemetry = async (companyId, tripId, params) => {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, companyId } });
  if (!trip) throw Object.assign(new Error("Trip not found"), { code: 404 });

  return getTelemetry(companyId, { ...params, tripId });
};

module.exports = {
  ingest,
  getTelemetry,
  getTelemetryById,
  getVehicleTelemetry,
  getTripTelemetry
};
