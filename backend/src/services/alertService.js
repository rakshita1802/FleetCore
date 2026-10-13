const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateDueStatus } = require('./maintenanceDueService');

const getAlerts = async (companyId, {
  page = 1,
  limit = 20,
  status,
  severity,
  type,
  vehicleId,
  sortBy = 'createdAt',
  sortOrder = 'desc'
} = {}, driverVehicleId = null) => {
  const skip = (page - 1) * limit;
  const where = { companyId };

  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  } else if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (type) where.type = type;

  const allowedSortFields = ['createdAt', 'updatedAt', 'severity', 'status', 'type'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { [safeSortBy]: safeSortOrder },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            status: true,
            odometer: true
          }
        },
        maintenanceSchedule: {
          select: {
            id: true,
            name: true,
            serviceType: true,
            nextDueAt: true,
            nextDueOdometer: true
          }
        }
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

const getAlertById = async (companyId, id, driverVehicleId = null) => {
  const where = { id, companyId };
  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  }

  return prisma.alert.findFirst({
    where,
    include: {
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          status: true,
          odometer: true
        }
      },
      maintenanceSchedule: true
    }
  });
};

const notifySocket = (event, companyId, alert) => {
  try {
    const socket = require('../socket');
    if (event === 'created') socket.emitAlertCreated(companyId, alert);
    else if (event === 'acknowledged') socket.emitAlertAcknowledged(companyId, alert);
    else if (event === 'resolved') socket.emitAlertResolved(companyId, alert);
  } catch (err) {
    // Ignore if socket is uninitialized or in worker
  }
};

const acknowledgeAlert = async (companyId, id, userId, data = {}) => {
  const alert = await prisma.alert.findFirst({ where: { id, companyId } });
  if (!alert) throw Object.assign(new Error("Alert not found"), { code: 404 });
  if (alert.status === 'RESOLVED') throw Object.assign(new Error("Cannot acknowledge a resolved alert"), { code: 409 });

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
      ...(data.notes ? { metadata: { ...(typeof alert.metadata === 'object' && alert.metadata ? alert.metadata : {}), ackNotes: data.notes } } : {})
    },
    include: {
      vehicle: true,
      maintenanceSchedule: true
    }
  });

  notifySocket('acknowledged', companyId, updated);
  return updated;
};

const resolveAlert = async (companyId, id, userId, data = {}) => {
  const alert = await prisma.alert.findFirst({ where: { id, companyId } });
  if (!alert) throw Object.assign(new Error("Alert not found"), { code: 404 });
  if (alert.status === 'RESOLVED') throw Object.assign(new Error("Alert is already resolved"), { code: 409 });

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: userId,
      ...(data.notes ? { metadata: { ...(typeof alert.metadata === 'object' && alert.metadata ? alert.metadata : {}), resolutionNotes: data.notes } } : {})
    },
    include: {
      vehicle: true,
      maintenanceSchedule: true
    }
  });

  notifySocket('resolved', companyId, updated);
  return updated;
};

const resolveScheduleAlerts = async (companyId, scheduleId, userId, db = prisma) => {
  return db.alert.updateMany({
    where: {
      companyId,
      maintenanceScheduleId: scheduleId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: userId || 'SYSTEM_MAINTENANCE_COMPLETED'
    }
  });
};

const evaluateAndGenerateAlerts = async (companyId, db = prisma) => {
  // 1. Fetch all active schedules and non-retired vehicles in a single query
  const schedules = await db.maintenanceSchedule.findMany({
    where: {
      companyId,
      isActive: true,
      vehicle: {
        status: { not: 'RETIRED' }
      }
    },
    include: {
      vehicle: true
    }
  });

  // 2. Fetch all currently active alerts for this company to deduplicate
  const existingActiveAlerts = await db.alert.findMany({
    where: {
      companyId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    }
  });

  const activeAlertsMap = new Map();
  for (const alert of existingActiveAlerts) {
    if (alert.maintenanceScheduleId) {
      activeAlertsMap.set(alert.maintenanceScheduleId, alert);
    }
  }

  let alertsCreatedCount = 0;
  let alertsResolvedCount = 0;
  const now = new Date();

  for (const schedule of schedules) {
    const dueInfo = calculateDueStatus(schedule, schedule.vehicle, now);
    const existingAlert = activeAlertsMap.get(schedule.id);

    if (dueInfo.status === 'OVERDUE') {
      if (existingAlert) {
        if (existingAlert.type === 'MAINTENANCE_OVERDUE') {
          // Already have an active critical overdue alert, keep it
          continue;
        } else if (existingAlert.type === 'MAINTENANCE_DUE') {
          // Escalate: resolve the warning alert and create overdue critical alert
          await db.alert.update({
            where: { id: existingAlert.id },
            data: { status: 'RESOLVED', resolvedAt: now, resolvedBy: 'SYSTEM_ESCALATION' }
          });
          alertsResolvedCount++;
        }
      }

      await db.alert.create({
        data: {
          companyId,
          vehicleId: schedule.vehicleId,
          maintenanceScheduleId: schedule.id,
          type: 'MAINTENANCE_OVERDUE',
          severity: 'CRITICAL',
          title: `Maintenance Overdue: ${schedule.name}`,
          message: `Vehicle ${schedule.vehicle.registrationNumber} is overdue for ${schedule.serviceType}. ${dueInfo.reason}.`,
          status: 'OPEN',
          metadata: {
            serviceType: schedule.serviceType,
            daysOverdue: dueInfo.daysOverdue,
            kmOverdue: dueInfo.kmOverdue
          }
        }
      });
      alertsCreatedCount++;
    } else if (dueInfo.status === 'UPCOMING') {
      if (!existingAlert) {
        await db.alert.create({
          data: {
            companyId,
            vehicleId: schedule.vehicleId,
            maintenanceScheduleId: schedule.id,
            type: 'MAINTENANCE_DUE',
            severity: 'WARNING',
            title: `Maintenance Due Soon: ${schedule.name}`,
            message: `Vehicle ${schedule.vehicle.registrationNumber} is due soon for ${schedule.serviceType}. ${dueInfo.reason}.`,
            status: 'OPEN',
            metadata: {
              serviceType: schedule.serviceType,
              daysRemaining: dueInfo.daysRemaining,
              kmRemaining: dueInfo.kmRemaining
            }
          }
        });
        alertsCreatedCount++;
      }
    } else if (dueInfo.status === 'SCHEDULED' && existingAlert) {
      // If schedule is no longer upcoming or overdue (e.g. interval was changed), resolve active alert
      await db.alert.update({
        where: { id: existingAlert.id },
        data: { status: 'RESOLVED', resolvedAt: now, resolvedBy: 'SYSTEM_STATUS_NORMAL' }
      });
      alertsResolvedCount++;
    }
  }

  return {
    evaluatedSchedulesCount: schedules.length,
    alertsCreatedCount,
    alertsResolvedCount
  };
};

module.exports = {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  resolveScheduleAlerts,
  evaluateAndGenerateAlerts
};
