const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDrivers = async (companyId, { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;
  const where = { companyId };

  if (status) where.status = status;
  
  if (search) {
    where.OR = [
      { employeeCode: { contains: search } },
      { name: { contains: search } },
      { licenseNumber: { contains: search } },
      { phone: { contains: search } }
    ];
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'employeeCode', 'name', 'status', 'licenseExpiry'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, drivers] = await Promise.all([
    prisma.driver.count({ where }),
    prisma.driver.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [safeSortBy]: safeSortOrder },
    })
  ]);

  const data = drivers.map(d => {
    let licenseStatus = 'VALID';
    const now = new Date();
    const expiry = new Date(d.licenseExpiry);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    if (expiry < now) {
      licenseStatus = 'EXPIRED';
    } else if (expiry <= thirtyDaysFromNow) {
      licenseStatus = 'EXPIRING_SOON';
    }
    
    return { ...d, licenseStatus };
  });

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

const getDriverById = async (companyId, id) => {
  const driver = await prisma.driver.findFirst({
    where: { id, companyId },
    include: {
      assignments: {
        where: { isActive: true },
        include: { vehicle: true }
      }
    }
  });

  if (!driver) return null;

  let licenseStatus = 'VALID';
  const now = new Date();
  const expiry = new Date(driver.licenseExpiry);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  
  if (expiry < now) licenseStatus = 'EXPIRED';
  else if (expiry <= thirtyDaysFromNow) licenseStatus = 'EXPIRING_SOON';

  return { ...driver, licenseStatus };
};

const createDriver = async (companyId, data) => {
  const existing = await prisma.driver.findFirst({
    where: {
      companyId,
      OR: [
        { employeeCode: data.employeeCode },
        { licenseNumber: data.licenseNumber }
      ]
    }
  });

  if (existing) {
    if (existing.employeeCode === data.employeeCode) throw new Error("Employee code already exists");
    if (existing.licenseNumber === data.licenseNumber) throw new Error("License number already exists");
  }

  if (data.userId) {
    const user = await prisma.user.findFirst({ where: { id: data.userId, companyId } });
    if (!user) throw new Error("Invalid User ID or cross-tenant assignment attempted");
  }

  return prisma.driver.create({
    data: { ...data, companyId }
  });
};

const updateDriver = async (companyId, id, data) => {
  const existing = await prisma.driver.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Driver not found");

  if (data.employeeCode || data.licenseNumber) {
    const conflict = await prisma.driver.findFirst({
      where: {
        companyId,
        id: { not: id },
        OR: [
          ...(data.employeeCode ? [{ employeeCode: data.employeeCode }] : []),
          ...(data.licenseNumber ? [{ licenseNumber: data.licenseNumber }] : [])
        ]
      }
    });
    if (conflict) {
      if (data.employeeCode && conflict.employeeCode === data.employeeCode) throw new Error("Employee code already exists");
      if (data.licenseNumber && conflict.licenseNumber === data.licenseNumber) throw new Error("License number already exists");
    }
  }

  return prisma.driver.update({
    where: { id },
    data
  });
};

const archiveDriver = async (companyId, id) => {
  const existing = await prisma.driver.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Driver not found");

  await prisma.$transaction([
    prisma.vehicleAssignment.updateMany({
      where: { driverId: id, companyId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() }
    }),
    prisma.driver.update({
      where: { id },
      data: { status: 'INACTIVE' }
    })
  ]);

  return { success: true, message: "Driver archived and unassigned successfully" };
};

module.exports = {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  archiveDriver
};
