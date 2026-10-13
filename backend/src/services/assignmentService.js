const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const getAssignments = async (companyId, { page = 1, limit = 20, vehicleId, driverId, isActive, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;
  const where = { companyId };

  if (vehicleId) where.vehicleId = vehicleId;
  if (driverId) where.driverId = driverId;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const allowedSortFields = ['createdAt', 'updatedAt', 'assignedAt', 'isActive'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.vehicleAssignment.count({ where }),
    prisma.vehicleAssignment.findMany({
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

const getAssignmentById = async (companyId, id) => {
  return prisma.vehicleAssignment.findFirst({
    where: { id, companyId },
    include: { vehicle: true, driver: true }
  });
};

const createAssignment = async (companyId, data) => {
  return prisma.$transaction(async (tx) => {
    // 1. Verify vehicle exists, belongs to company, and is not retired
    const vehicle = await tx.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
    if (!vehicle) throw new Error("Vehicle not found or cross-tenant access attempted");
    if (vehicle.status === 'RETIRED') throw new Error("Cannot assign a retired vehicle");

    // 2. Verify driver exists, belongs to company, and is active
    const driver = await tx.driver.findFirst({ where: { id: data.driverId, companyId } });
    if (!driver) throw new Error("Driver not found or cross-tenant access attempted");
    if (driver.status !== 'ACTIVE') throw new Error("Driver is not active");

    // 3. Verify vehicle is not already assigned
    const activeVehicleAssignment = await tx.vehicleAssignment.findFirst({
      where: { vehicleId: data.vehicleId, companyId, isActive: true }
    });
    if (activeVehicleAssignment) {
      // 409 Conflict logic
      const err = new Error("Vehicle is already assigned to an active driver");
      err.code = 409;
      throw err;
    }

    // 4. Verify driver is not already assigned
    const activeDriverAssignment = await tx.vehicleAssignment.findFirst({
      where: { driverId: data.driverId, companyId, isActive: true }
    });
    if (activeDriverAssignment) {
      const err = new Error("Driver is already assigned to an active vehicle");
      err.code = 409;
      throw err;
    }

    // Create assignment
    return tx.vehicleAssignment.create({
      data: {
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        companyId
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const unassign = async (companyId, id) => {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.vehicleAssignment.findFirst({ where: { id, companyId } });
    if (!assignment) throw new Error("Assignment not found");
    if (!assignment.isActive) throw new Error("Assignment is already inactive");

    return tx.vehicleAssignment.update({
      where: { id },
      data: {
        isActive: false,
        unassignedAt: new Date()
      }
    });
  });
};

module.exports = {
  getAssignments,
  getAssignmentById,
  createAssignment,
  unassign
};
