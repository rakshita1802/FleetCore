const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const redisService = require('./redisService');
const { getQueueHealth } = require('../jobs/queues');
const { getApiMetrics } = require('../middleware/requestMetrics');
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('./auditService');
const logger = require('../utils/logger');

/**
 * Lists users within a company with search, role/status filtering, pagination, and sorting.
 */
const listUsers = async (companyId, options = {}) => {
  const { search, role, status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
  const skip = (page - 1) * limit;

  const where = {
    companyId
  };

  if (role) {
    where.role = role;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } }
    ];
  }

  const allowedSortFields = ['name', 'email', 'role', 'status', 'createdAt', 'updatedAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [safeSortBy]: safeSortOrder },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Gets a user by ID within the company.
 */
const getUserById = async (companyId, userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: {
      id: true,
      companyId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

/**
 * Creates a new user in the company.
 */
const createUser = async (companyId, userData, requestingUser, reqMeta = {}) => {
  const { name, email, password, role = 'VIEWER', driverId } = userData;

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existing) {
    const error = new Error('Email is already registered');
    error.statusCode = 409;
    throw error;
  }

  if (driverId) {
    const driver = await prisma.driver.findFirst({
      where: { id: driverId, companyId }
    });
    if (!driver) {
      const error = new Error('Specified driver does not exist in this company');
      error.statusCode = 404;
      throw error;
    }
    if (driver.userId) {
      const error = new Error('Driver is already linked to another user account');
      error.statusCode = 409;
      throw error;
    }
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        companyId,
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    if (driverId) {
      await tx.driver.update({
        where: { id: driverId },
        data: { userId: user.id }
      });
    }

    return user;
  });

  await logAudit({
    companyId,
    userId: requestingUser?.id,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: newUser.id,
    metadata: {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      driverId: driverId || null
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return newUser;
};

/**
 * Updates a user's name or email.
 */
const updateUser = async (companyId, userId, updateData, requestingUser, reqMeta = {}) => {
  const targetUser = await prisma.user.findFirst({
    where: { id: userId, companyId }
  });

  if (!targetUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const dataToUpdate = {};
  if (updateData.name) {
    dataToUpdate.name = updateData.name;
  }
  if (updateData.email) {
    const emailLower = updateData.email.toLowerCase();
    if (emailLower !== targetUser.email) {
      const existing = await prisma.user.findUnique({
        where: { email: emailLower }
      });
      if (existing) {
        const error = new Error('Email is already in use');
        error.statusCode = 409;
        throw error;
      }
      dataToUpdate.email = emailLower;
    }
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return targetUser;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
    select: {
      id: true,
      companyId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true
    }
  });

  await logAudit({
    companyId,
    userId: requestingUser?.id,
    action: AUDIT_ACTIONS.USER_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: userId,
    metadata: {
      updatedFields: Object.keys(dataToUpdate),
      previousEmail: targetUser.email,
      newEmail: dataToUpdate.email || targetUser.email
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return updatedUser;
};

/**
 * Changes a user's role with Last Admin and Self Protection.
 */
const changeUserRole = async (companyId, userId, newRole, requestingUser, reqMeta = {}) => {
  const targetUser = await prisma.user.findFirst({
    where: { id: userId, companyId }
  });

  if (!targetUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetUser.role === newRole) {
    return targetUser;
  }

  // Self-Protection: Admin cannot remove their own ADMIN role
  if (targetUser.id === requestingUser.id && targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
    const error = new Error('Administrators cannot remove their own administrator access');
    error.statusCode = 409;
    throw error;
  }

  // Last-Admin Protection: Check count of other active administrators in the company
  if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
    const activeAdminCount = await prisma.user.count({
      where: {
        companyId,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    if (activeAdminCount <= 1) {
      const error = new Error('Cannot remove the last active administrator for this company');
      error.statusCode = 409;
      throw error;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: {
      id: true,
      companyId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true
    }
  });

  await logAudit({
    companyId,
    userId: requestingUser?.id,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: userId,
    metadata: {
      oldRole: targetUser.role,
      newRole
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return updatedUser;
};

/**
 * Activates or deactivates a user with Last Admin and Self Protection.
 */
const setUserStatus = async (companyId, userId, newStatus, requestingUser, reqMeta = {}) => {
  const targetUser = await prisma.user.findFirst({
    where: { id: userId, companyId }
  });

  if (!targetUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetUser.status === newStatus) {
    return targetUser;
  }

  if (newStatus === 'INACTIVE') {
    // Self-Protection: Admin cannot deactivate their own account
    if (targetUser.id === requestingUser.id) {
      const error = new Error('Administrators cannot deactivate their own account');
      error.statusCode = 409;
      throw error;
    }

    // Last-Admin Protection: If target is an active ADMIN, check if any other active ADMIN exists
    if (targetUser.role === 'ADMIN') {
      const activeAdminCount = await prisma.user.count({
        where: {
          companyId,
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      });

      if (activeAdminCount <= 1) {
        const error = new Error('Cannot deactivate the last active administrator for this company');
        error.statusCode = 409;
        throw error;
      }
    }
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: newStatus },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true
      }
    });

    // If deactivating, revoke all active refresh sessions immediately
    if (newStatus === 'INACTIVE') {
      await tx.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    return user;
  });

  const auditAction = newStatus === 'ACTIVE'
    ? AUDIT_ACTIONS.USER_ACTIVATED
    : AUDIT_ACTIONS.USER_DEACTIVATED;

  await logAudit({
    companyId,
    userId: requestingUser?.id,
    action: auditAction,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: userId,
    metadata: {
      oldStatus: targetUser.status,
      newStatus
    },
    ipAddress: reqMeta.ip,
    userAgent: reqMeta.userAgent
  });

  return updatedUser;
};

/**
 * Generates an aggregated administrative overview for the company.
 */
const getCompanyAdminOverview = async (companyId) => {
  const [
    userStats,
    vehicleStats,
    driverStats,
    activeTripsCount,
    maintenanceDueCount,
    maintenanceOverdueCount,
    openAlerts,
    queueHealth
  ] = await Promise.all([
    // User breakdown
    prisma.user.groupBy({
      by: ['role', 'status'],
      where: { companyId },
      _count: { id: true }
    }),
    // Vehicle breakdown
    prisma.vehicle.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true }
    }),
    // Driver breakdown
    prisma.driver.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true }
    }),
    // Active trips
    prisma.trip.count({
      where: {
        companyId,
        status: { in: ['PLANNED', 'IN_PROGRESS'] }
      }
    }),
    // Maintenance due
    prisma.maintenanceSchedule.count({
      where: {
        companyId,
        isActive: true,
        nextDueAt: { lte: new Date() }
      }
    }),
    // Overdue maintenance (alerts with type MAINTENANCE_OVERDUE)
    prisma.alert.count({
      where: {
        companyId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        type: 'MAINTENANCE_OVERDUE'
      }
    }),
    // Open Alerts by severity
    prisma.alert.groupBy({
      by: ['severity'],
      where: {
        companyId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] }
      },
      _count: { id: true }
    }),
    // Queue health
    getQueueHealth().catch(() => ({}))
  ]);

  // Aggregate user counts
  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveUsers = 0;
  const usersByRole = { ADMIN: 0, FLEET_MANAGER: 0, DRIVER: 0, VIEWER: 0 };

  for (const group of userStats) {
    const count = group._count.id;
    totalUsers += count;
    if (group.status === 'ACTIVE') activeUsers += count;
    else inactiveUsers += count;
    if (usersByRole[group.role] !== undefined) {
      usersByRole[group.role] += count;
    }
  }

  // Aggregate vehicle counts
  let totalVehicles = 0;
  const vehiclesByStatus = { ACTIVE: 0, INACTIVE: 0, MAINTENANCE: 0, RETIRED: 0 };
  for (const group of vehicleStats) {
    const count = group._count.id;
    totalVehicles += count;
    if (vehiclesByStatus[group.status] !== undefined) {
      vehiclesByStatus[group.status] = count;
    }
  }

  // Aggregate driver counts
  let totalDrivers = 0;
  const driversByStatus = { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0 };
  for (const group of driverStats) {
    const count = group._count.id;
    totalDrivers += count;
    if (driversByStatus[group.status] !== undefined) {
      driversByStatus[group.status] = count;
    }
  }

  // Alerts breakdown
  let totalOpenAlerts = 0;
  const alertsBySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  for (const group of openAlerts) {
    const count = group._count.id;
    totalOpenAlerts += count;
    if (alertsBySeverity[group.severity] !== undefined) {
      alertsBySeverity[group.severity] = count;
    }
  }

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      byRole: usersByRole
    },
    vehicles: {
      total: totalVehicles,
      byStatus: vehiclesByStatus
    },
    drivers: {
      total: totalDrivers,
      byStatus: driversByStatus
    },
    operations: {
      activeTrips: activeTripsCount,
      maintenanceDue: maintenanceDueCount,
      maintenanceOverdue: maintenanceOverdueCount,
      openAlerts: totalOpenAlerts,
      alertsBySeverity
    },
    queues: queueHealth
  };
};

/**
 * Collects production system observability and health metrics.
 */
const getSystemHealthOverview = async () => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const isRedisHealthy = await redisService.checkHealth().catch(() => false);
  const queueHealth = await getQueueHealth().catch(() => ({}));
  const apiMetrics = getApiMetrics();

  const mem = process.memoryUsage();

  return {
    environment: process.env.NODE_ENV || 'development',
    appVersion: process.env.APP_VERSION || '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    api: {
      status: 'healthy',
      ...apiMetrics
    },
    database: {
      dialect: 'mysql',
      status: dbStatus
    },
    redis: {
      status: isRedisHealthy ? 'connected' : 'disconnected'
    },
    queues: queueHealth,
    process: {
      nodeVersion: process.version,
      pid: process.pid,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
      }
    }
  };
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserRole,
  setUserStatus,
  getCompanyAdminOverview,
  getSystemHealthOverview
};
