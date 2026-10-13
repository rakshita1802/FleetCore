const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const getTrips = async (companyId, { page = 1, limit = 20, status, vehicleId, driverId, search, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;
  const where = { companyId };

  if (status) where.status = status;
  if (vehicleId) where.vehicleId = vehicleId;
  if (driverId) where.driverId = driverId;

  if (search) {
    where.OR = [
      { tripNumber: { contains: search } },
      { originName: { contains: search } },
      { destinationName: { contains: search } }
    ];
  }

  // Filter by scheduledStartAt date range (Phase 4 requirement: operational filtering)
  if (startDate || endDate) {
    where.scheduledStartAt = {};
    if (startDate) where.scheduledStartAt.gte = new Date(startDate);
    if (endDate) where.scheduledStartAt.lte = new Date(endDate);
  }

  const allowedSortFields = ['tripNumber', 'scheduledStartAt', 'actualStartAt', 'status', 'createdAt', 'updatedAt', 'distanceKm'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [safeSortBy]: safeSortOrder },
      include: {
        vehicle: true,
        driver: true
      }
    })
  ]);

  return {
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const getTripById = async (companyId, id, driverRoleAccessId = null) => {
  const where = { id, companyId };
  if (driverRoleAccessId) {
    where.driverId = driverRoleAccessId; // restrict access for DRIVER role
  }
  return prisma.trip.findFirst({
    where,
    include: {
      vehicle: true,
      driver: true,
    }
  });
};

const createTrip = async (companyId, data) => {
  return prisma.$transaction(async (tx) => {
    // 1. Verify vehicle & driver exist for company and check statuses
    const vehicle = await tx.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
    if (!vehicle) throw Object.assign(new Error("Vehicle not found or cross-tenant access"), { code: 404 });
    if (vehicle.status !== 'ACTIVE') throw Object.assign(new Error("Vehicle is not ACTIVE"), { code: 409 });

    const driver = await tx.driver.findFirst({ where: { id: data.driverId, companyId } });
    if (!driver) throw Object.assign(new Error("Driver not found or cross-tenant access"), { code: 404 });
    if (driver.status !== 'ACTIVE') throw Object.assign(new Error("Driver is not ACTIVE"), { code: 409 });

    // 2. Active assignment validation
    const assignment = await tx.vehicleAssignment.findFirst({
      where: { vehicleId: data.vehicleId, driverId: data.driverId, companyId, isActive: true }
    });
    if (!assignment) {
      throw Object.assign(new Error("Driver does not have an active assignment to this vehicle"), { code: 409 });
    }

    // Generate deterministic trip number TRP-YYYY-XXXXXX
    const year = new Date().getFullYear();
    const count = await tx.trip.count({ where: { companyId } });
    const tripNumber = `TRP-${year}-${String(count + 1).padStart(6, '0')}`;

    return tx.trip.create({
      data: {
        ...data,
        companyId,
        tripNumber,
        status: 'PLANNED'
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const startTrip = async (companyId, id, driverRoleAccessId = null) => {
  return prisma.$transaction(async (tx) => {
    const where = { id, companyId };
    if (driverRoleAccessId) where.driverId = driverRoleAccessId;
    
    const trip = await tx.trip.findFirst({ where });
    if (!trip) throw Object.assign(new Error("Trip not found"), { code: 404 });
    if (trip.status !== 'PLANNED') throw Object.assign(new Error("Only PLANNED trips can be started"), { code: 409 });

    // Verify concurrency: no other IN_PROGRESS trip for this vehicle or driver
    const conflictingTrip = await tx.trip.findFirst({
      where: {
        companyId,
        status: 'IN_PROGRESS',
        OR: [
          { vehicleId: trip.vehicleId },
          { driverId: trip.driverId }
        ]
      }
    });
    if (conflictingTrip) {
      throw Object.assign(new Error("Vehicle or Driver already has an IN_PROGRESS trip"), { code: 409 });
    }

    // Verify vehicle & driver are still active
    const vehicle = await tx.vehicle.findFirst({ where: { id: trip.vehicleId, companyId } });
    if (!vehicle || vehicle.status !== 'ACTIVE') throw Object.assign(new Error("Vehicle is not ACTIVE"), { code: 409 });

    return tx.trip.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStartAt: new Date()
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const completeTrip = async (companyId, id, data, driverRoleAccessId = null) => {
  return prisma.$transaction(async (tx) => {
    const where = { id, companyId };
    if (driverRoleAccessId) where.driverId = driverRoleAccessId;

    const trip = await tx.trip.findFirst({ where });
    if (!trip) throw Object.assign(new Error("Trip not found"), { code: 404 });
    if (trip.status !== 'IN_PROGRESS') throw Object.assign(new Error("Only IN_PROGRESS trips can be completed"), { code: 409 });

    if (data.odometerEnd < trip.odometerStart) {
      throw Object.assign(new Error("odometerEnd cannot be less than odometerStart"), { code: 422 });
    }

    const distanceKm = data.odometerEnd - trip.odometerStart;

    return tx.trip.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualEndAt: new Date(),
        odometerEnd: data.odometerEnd,
        distanceKm,
        notes: data.notes ? `${trip.notes || ''}\n[Completion Note]: ${data.notes}` : trip.notes
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const cancelTrip = async (companyId, id) => {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({ where: { id, companyId } });
    if (!trip) throw Object.assign(new Error("Trip not found"), { code: 404 });
    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw Object.assign(new Error("Cannot cancel a trip that is already completed or cancelled"), { code: 409 });
    }

    return tx.trip.update({
      where: { id },
      data: {
        status: 'CANCELLED'
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

module.exports = {
  getTrips,
  getTripById,
  createTrip,
  startTrip,
  completeTrip,
  cancelTrip
};
