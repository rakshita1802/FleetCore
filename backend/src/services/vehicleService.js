const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getVehicles = async (companyId, { page = 1, limit = 20, search, status, vehicleType, fuelType, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;
  const where = { companyId };

  if (status) where.status = status;
  if (vehicleType) where.vehicleType = vehicleType;
  if (fuelType) where.fuelType = fuelType;
  
  if (search) {
    where.OR = [
      { registrationNumber: { contains: search } },
      { vin: { contains: search } },
      { make: { contains: search } },
      { model: { contains: search } }
    ];
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'registrationNumber', 'status', 'odometer', 'year'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [safeSortBy]: safeSortOrder },
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

const getVehicleById = async (companyId, id) => {
  return prisma.vehicle.findFirst({
    where: { id, companyId },
    include: {
      assignments: {
        where: { isActive: true },
        include: { driver: true }
      }
    }
  });
};

const createVehicle = async (companyId, data) => {
  // Check unique constraints explicitly for better error messages
  const existing = await prisma.vehicle.findFirst({
    where: {
      companyId,
      OR: [
        { registrationNumber: data.registrationNumber },
        ...(data.vin ? [{ vin: data.vin }] : [])
      ]
    }
  });

  if (existing) {
    if (existing.registrationNumber === data.registrationNumber) throw new Error("Registration number already exists in company");
    if (existing.vin === data.vin) throw new Error("VIN already exists in company");
  }

  return prisma.vehicle.create({
    data: { ...data, companyId }
  });
};

const updateVehicle = async (companyId, id, data) => {
  const existingVehicle = await prisma.vehicle.findFirst({ where: { id, companyId } });
  if (!existingVehicle) throw new Error("Vehicle not found");

  if (data.registrationNumber || data.vin) {
    const conflict = await prisma.vehicle.findFirst({
      where: {
        companyId,
        id: { not: id },
        OR: [
          ...(data.registrationNumber ? [{ registrationNumber: data.registrationNumber }] : []),
          ...(data.vin ? [{ vin: data.vin }] : [])
        ]
      }
    });
    if (conflict) {
      if (data.registrationNumber && conflict.registrationNumber === data.registrationNumber) throw new Error("Registration number already exists");
      if (data.vin && conflict.vin === data.vin) throw new Error("VIN already exists");
    }
  }

  if (data.status === 'MAINTENANCE') {
    const activeTrip = await prisma.trip.findFirst({
      where: { vehicleId: id, companyId, status: 'IN_PROGRESS' }
    });
    if (activeTrip) {
      throw Object.assign(new Error("Cannot put vehicle into MAINTENANCE status while it is on an active trip"), { code: 409 });
    }
  }

  return prisma.vehicle.update({
    where: { id },
    data
  });
};

const archiveVehicle = async (companyId, id) => {
  const existingVehicle = await prisma.vehicle.findFirst({ where: { id, companyId } });
  if (!existingVehicle) throw new Error("Vehicle not found");

  // Deactivate active assignments
  await prisma.$transaction([
    prisma.vehicleAssignment.updateMany({
      where: { vehicleId: id, companyId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() }
    }),
    prisma.vehicle.update({
      where: { id },
      data: { status: 'RETIRED' }
    })
  ]);

  return { success: true, message: "Vehicle archived and unassigned successfully" };
};

module.exports = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  archiveVehicle
};
