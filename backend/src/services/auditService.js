const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REFRESH: 'REFRESH',

  // User Admin
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',

  // Fleet
  VEHICLE_CREATED: 'VEHICLE_CREATED',
  VEHICLE_UPDATED: 'VEHICLE_UPDATED',
  VEHICLE_RETIRED: 'VEHICLE_RETIRED',
  DRIVER_CREATED: 'DRIVER_CREATED',
  DRIVER_UPDATED: 'DRIVER_UPDATED',

  // Maintenance
  MAINTENANCE_CREATED: 'MAINTENANCE_CREATED',
  MAINTENANCE_STARTED: 'MAINTENANCE_STARTED',
  MAINTENANCE_COMPLETED: 'MAINTENANCE_COMPLETED',
  MAINTENANCE_CANCELLED: 'MAINTENANCE_CANCELLED',

  // Alerts
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',

  // Reports
  REPORT_EXPORTED: 'REPORT_EXPORTED'
};

const AUDIT_ENTITY_TYPES = {
  USER: 'USER',
  COMPANY: 'COMPANY',
  VEHICLE: 'VEHICLE',
  DRIVER: 'DRIVER',
  TRIP: 'TRIP',
  MAINTENANCE_RECORD: 'MAINTENANCE_RECORD',
  MAINTENANCE_SCHEDULE: 'MAINTENANCE_SCHEDULE',
  ALERT: 'ALERT',
  REPORT: 'REPORT',
  SYSTEM: 'SYSTEM'
};

/**
 * Creates an append-only audit log entry with sensitive fields sanitized.
 */
const logAudit = async ({
  companyId,
  userId = null,
  action,
  entityType,
  entityId = null,
  metadata = null,
  ipAddress = null,
  userAgent = null
}, dbClient = null) => {
  try {
    if (!companyId || !action || !entityType) {
      logger.warn('[Audit] Missing required audit fields', { companyId, action, entityType });
      return null;
    }

    const client = dbClient || prisma;
    if (!client.auditLog || typeof client.auditLog.create !== 'function') {
      return null;
    }

    const sanitizedMetadata = metadata ? logger.sanitize(metadata) : null;

    const entry = await client.auditLog.create({
      data: {
        companyId,
        userId,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        metadata: sanitizedMetadata,
        ipAddress: ipAddress ? String(ipAddress).slice(0, 100) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null
      }
    });

    logger.debug(`[Audit] Logged action ${action} for company ${companyId}`, {
      action,
      entityType,
      entityId,
      userId
    });

    return entry;
  } catch (error) {
    logger.error('[Audit] Failed to create audit log entry', { error: error.message, action, companyId });
    return null;
  }
};

/**
 * Queries tenant-scoped audit logs with filters and pagination.
 */
const getAuditLogs = async (companyId, filters = {}) => {
  const page = Math.max(1, parseInt(filters.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const where = {
    companyId
  };

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  logAudit,
  getAuditLogs
};
