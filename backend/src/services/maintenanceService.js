const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateDueStatus } = require('./maintenanceDueService');
const alertService = require('./alertService');

const getSummary = async (companyId, driverVehicleId = null) => {
  const whereVehicle = { companyId };
  if (driverVehicleId) whereVehicle.id = driverVehicleId;

  const [schedules, inProgressCount, completedRecentlyCount, openAlertsCount] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: {
        companyId,
        isActive: true,
        vehicle: whereVehicle
      },
      include: {
        vehicle: true
      }
    }),
    prisma.maintenanceRecord.count({
      where: {
        companyId,
        status: 'IN_PROGRESS',
        ...(driverVehicleId ? { vehicleId: driverVehicleId } : {})
      }
    }),
    prisma.maintenanceRecord.count({
      where: {
        companyId,
        status: 'COMPLETED',
        completedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        ...(driverVehicleId ? { vehicleId: driverVehicleId } : {})
      }
    }),
    prisma.alert.count({
      where: {
        companyId,
        status: 'OPEN',
        ...(driverVehicleId ? { vehicleId: driverVehicleId } : {})
      }
    })
  ]);

  let overdueCount = 0;
  let dueSoonCount = 0;
  let scheduledCount = 0;
  const now = new Date();

  for (const schedule of schedules) {
    if (schedule.vehicle && schedule.vehicle.status !== 'RETIRED') {
      const dueInfo = calculateDueStatus(schedule, schedule.vehicle, now);
      if (dueInfo.status === 'OVERDUE') overdueCount++;
      else if (dueInfo.status === 'UPCOMING') dueSoonCount++;
      else scheduledCount++;
    }
  }

  return {
    overdueCount,
    dueSoonCount,
    scheduledCount,
    inProgressCount,
    completedRecentlyCount,
    openAlertsCount,
    totalActiveSchedules: schedules.length
  };
};

const getDueItems = async (companyId, {
  page = 1,
  limit = 20,
  status,
  vehicleId,
  serviceType,
  sortBy = 'priority',
  sortOrder = 'desc'
} = {}, driverVehicleId = null) => {
  const where = {
    companyId,
    isActive: true,
    vehicle: {
      status: { not: 'RETIRED' }
    }
  };

  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  } else if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  if (serviceType) {
    where.serviceType = serviceType;
  }

  const schedules = await prisma.maintenanceSchedule.findMany({
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
      }
    }
  });

  const now = new Date();
  let evaluated = schedules.map(schedule => {
    const dueInfo = calculateDueStatus(schedule, schedule.vehicle, now);
    return {
      ...schedule,
      dueStatus: dueInfo.status,
      priority: dueInfo.priority,
      reason: dueInfo.reason,
      daysRemaining: dueInfo.daysRemaining,
      daysOverdue: dueInfo.daysOverdue,
      kmRemaining: dueInfo.kmRemaining,
      kmOverdue: dueInfo.kmOverdue,
      currentOdometer: dueInfo.currentOdometer
    };
  });

  if (status) {
    evaluated = evaluated.filter(item => item.dueStatus === status);
  }

  // Priority sort mapping
  const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  evaluated.sort((a, b) => {
    let comp = 0;
    if (sortBy === 'priority') {
      comp = (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
    } else if (sortBy === 'nextDueAt') {
      const aTime = a.nextDueAt ? new Date(a.nextDueAt).getTime() : Infinity;
      const bTime = b.nextDueAt ? new Date(b.nextDueAt).getTime() : Infinity;
      comp = aTime - bTime;
    } else if (sortBy === 'nextDueOdometer') {
      const aOdo = a.nextDueOdometer != null ? a.nextDueOdometer : Infinity;
      const bOdo = b.nextDueOdometer != null ? b.nextDueOdometer : Infinity;
      comp = aOdo - bOdo;
    } else if (sortBy === 'name') {
      comp = a.name.localeCompare(b.name);
    } else {
      comp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === 'asc' ? comp : -comp;
  });

  const total = evaluated.length;
  const numPage = Number(page);
  const numLimit = Number(limit);
  const skip = (numPage - 1) * numLimit;
  const paginatedData = evaluated.slice(skip, skip + numLimit);

  return {
    data: paginatedData,
    pagination: {
      page: numPage,
      limit: numLimit,
      total,
      totalPages: Math.ceil(total / numLimit)
    }
  };
};

const getSchedules = async (companyId, {
  page = 1,
  limit = 20,
  vehicleId,
  serviceType,
  isActive = 'true',
  sortBy = 'createdAt',
  sortOrder = 'desc'
} = {}, driverVehicleId = null) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { companyId };

  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  } else if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  if (serviceType) where.serviceType = serviceType;
  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'serviceType', 'nextDueAt', 'nextDueOdometer'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.maintenanceSchedule.count({ where }),
    prisma.maintenanceSchedule.findMany({
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
        }
      }
    })
  ]);

  const now = new Date();
  const enhancedData = data.map(schedule => {
    const dueInfo = calculateDueStatus(schedule, schedule.vehicle, now);
    return {
      ...schedule,
      dueStatus: dueInfo.status,
      priority: dueInfo.priority,
      reason: dueInfo.reason,
      daysRemaining: dueInfo.daysRemaining,
      kmRemaining: dueInfo.kmRemaining
    };
  });

  return {
    data: enhancedData,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const getScheduleById = async (companyId, id, driverVehicleId = null) => {
  const where = { id, companyId };
  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  }

  const schedule = await prisma.maintenanceSchedule.findFirst({
    where,
    include: {
      vehicle: true,
      records: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      alerts: {
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }
      }
    }
  });

  if (!schedule) return null;

  const dueInfo = calculateDueStatus(schedule, schedule.vehicle, new Date());
  return {
    ...schedule,
    dueStatus: dueInfo.status,
    priority: dueInfo.priority,
    reason: dueInfo.reason,
    daysRemaining: dueInfo.daysRemaining,
    kmRemaining: dueInfo.kmRemaining
  };
};

const createSchedule = async (companyId, data) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: data.vehicleId, companyId }
  });

  if (!vehicle) throw Object.assign(new Error("Vehicle not found or cross-tenant access"), { code: 404 });
  if (vehicle.status === 'RETIRED') throw Object.assign(new Error("Cannot create maintenance schedule for a retired vehicle"), { code: 409 });

  const now = new Date();
  let nextDueAt = null;
  if (data.intervalDays) {
    const baseDate = data.lastServiceAt ? new Date(data.lastServiceAt) : now;
    nextDueAt = new Date(baseDate.getTime() + data.intervalDays * 24 * 60 * 60 * 1000);
  }

  let nextDueOdometer = null;
  if (data.intervalKm) {
    const baseOdo = data.lastServiceOdometer != null ? data.lastServiceOdometer : (vehicle.odometer || 0);
    nextDueOdometer = baseOdo + data.intervalKm;
  }

  const schedule = await prisma.maintenanceSchedule.create({
    data: {
      companyId,
      vehicleId: data.vehicleId,
      name: data.name,
      description: data.description || null,
      serviceType: data.serviceType,
      triggerType: data.triggerType || 'TIME_OR_ODOMETER',
      intervalKm: data.intervalKm || null,
      intervalDays: data.intervalDays || null,
      lastServiceAt: data.lastServiceAt ? new Date(data.lastServiceAt) : null,
      lastServiceOdometer: data.lastServiceOdometer != null ? data.lastServiceOdometer : null,
      nextDueAt,
      nextDueOdometer,
      isActive: true
    },
    include: {
      vehicle: true
    }
  });

  // Check if newly created schedule generates an immediate alert
  await alertService.evaluateAndGenerateAlerts(companyId);

  return schedule;
};

const updateSchedule = async (companyId, id, data) => {
  const existing = await prisma.maintenanceSchedule.findFirst({
    where: { id, companyId },
    include: { vehicle: true }
  });

  if (!existing) throw Object.assign(new Error("Maintenance schedule not found"), { code: 404 });

  const updatePayload = { ...data };
  if (data.lastServiceAt !== undefined) {
    updatePayload.lastServiceAt = data.lastServiceAt ? new Date(data.lastServiceAt) : null;
  }

  // Recalculate next due targets if intervals or base markers were adjusted
  const intervalDays = data.intervalDays !== undefined ? data.intervalDays : existing.intervalDays;
  const intervalKm = data.intervalKm !== undefined ? data.intervalKm : existing.intervalKm;
  const lastServiceAt = data.lastServiceAt !== undefined ? updatePayload.lastServiceAt : existing.lastServiceAt;
  const lastServiceOdometer = data.lastServiceOdometer !== undefined ? data.lastServiceOdometer : existing.lastServiceOdometer;

  if (intervalDays) {
    const baseDate = lastServiceAt ? new Date(lastServiceAt) : new Date();
    updatePayload.nextDueAt = new Date(baseDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  } else if (intervalDays === null) {
    updatePayload.nextDueAt = null;
  }

  if (intervalKm) {
    const baseOdo = lastServiceOdometer != null ? lastServiceOdometer : (existing.vehicle.odometer || 0);
    updatePayload.nextDueOdometer = baseOdo + intervalKm;
  } else if (intervalKm === null) {
    updatePayload.nextDueOdometer = null;
  }

  const updated = await prisma.maintenanceSchedule.update({
    where: { id },
    data: updatePayload,
    include: { vehicle: true }
  });

  await alertService.evaluateAndGenerateAlerts(companyId);

  return updated;
};

const deleteSchedule = async (companyId, id) => {
  const existing = await prisma.maintenanceSchedule.findFirst({ where: { id, companyId } });
  if (!existing) throw Object.assign(new Error("Maintenance schedule not found"), { code: 404 });

  // Soft deactivation
  await prisma.$transaction([
    prisma.maintenanceSchedule.update({
      where: { id },
      data: { isActive: false }
    }),
    prisma.alert.updateMany({
      where: {
        companyId,
        maintenanceScheduleId: id,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] }
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: 'SCHEDULE_DEACTIVATED'
      }
    })
  ]);

  return { success: true, message: "Maintenance schedule deactivated successfully" };
};

const getRecords = async (companyId, {
  page = 1,
  limit = 20,
  vehicleId,
  scheduleId,
  status,
  serviceType,
  startDate,
  endDate,
  sortBy = 'createdAt',
  sortOrder = 'desc'
} = {}, driverVehicleId = null, isDriver = false) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { companyId };

  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  } else if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  if (scheduleId) where.scheduleId = scheduleId;
  if (status) where.status = status;
  if (serviceType) where.serviceType = serviceType;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'completedAt', 'startedAt', 'status', 'cost', 'odometerAtService'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, rawData] = await Promise.all([
    prisma.maintenanceRecord.count({ where }),
    prisma.maintenanceRecord.findMany({
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
        schedule: {
          select: {
            id: true,
            name: true,
            serviceType: true
          }
        }
      }
    })
  ]);

  const data = rawData.map(record => {
    if (isDriver) {
      const { cost, ...safeRecord } = record;
      return safeRecord;
    }
    return record;
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

const getRecordById = async (companyId, id, driverVehicleId = null, isDriver = false) => {
  const where = { id, companyId };
  if (driverVehicleId) {
    where.vehicleId = driverVehicleId;
  }

  const record = await prisma.maintenanceRecord.findFirst({
    where,
    include: {
      vehicle: true,
      schedule: true
    }
  });

  if (!record) return null;

  if (isDriver) {
    const { cost, ...safeRecord } = record;
    return safeRecord;
  }

  return record;
};

const createRecord = async (companyId, data, userId) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: data.vehicleId, companyId }
  });
  if (!vehicle) throw Object.assign(new Error("Vehicle not found or cross-tenant access"), { code: 404 });

  if (data.scheduleId) {
    const schedule = await prisma.maintenanceSchedule.findFirst({
      where: { id: data.scheduleId, companyId }
    });
    if (!schedule) throw Object.assign(new Error("Maintenance schedule not found"), { code: 404 });
  }

  return prisma.maintenanceRecord.create({
    data: {
      companyId,
      vehicleId: data.vehicleId,
      scheduleId: data.scheduleId || null,
      serviceType: data.serviceType,
      description: data.description || null,
      status: data.status || 'SCHEDULED',
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      odometerAtService: data.odometerAtService != null ? data.odometerAtService : null,
      cost: data.cost != null ? new Prisma.Decimal(data.cost) : null,
      vendor: data.vendor || null,
      notes: data.notes || null,
      createdBy: userId || null
    },
    include: {
      vehicle: true,
      schedule: true
    }
  });
};

const updateRecord = async (companyId, id, data) => {
  const record = await prisma.maintenanceRecord.findFirst({ where: { id, companyId } });
  if (!record) throw Object.assign(new Error("Maintenance record not found"), { code: 404 });

  if (record.status === 'COMPLETED' || record.status === 'CANCELLED') {
    // Only allow notes/vendor adjustment on terminal records
    const allowedKeys = ['notes', 'vendor'];
    const attemptedKeys = Object.keys(data);
    const hasForbidden = attemptedKeys.some(k => !allowedKeys.includes(k));
    if (hasForbidden) {
      throw Object.assign(new Error(`Cannot modify core fields of a ${record.status} maintenance record`), { code: 409 });
    }
  }

  const updateData = { ...data };
  if (data.cost != null) updateData.cost = new Prisma.Decimal(data.cost);

  return prisma.maintenanceRecord.update({
    where: { id },
    data: updateData,
    include: { vehicle: true, schedule: true }
  });
};

const startRecord = async (companyId, id, userId, data = {}) => {
  const record = await prisma.maintenanceRecord.findFirst({
    where: { id, companyId },
    include: { vehicle: true }
  });

  if (!record) throw Object.assign(new Error("Maintenance record not found"), { code: 404 });
  if (record.status === 'IN_PROGRESS') throw Object.assign(new Error("Maintenance is already in progress"), { code: 409 });
  if (record.status === 'COMPLETED') throw Object.assign(new Error("Cannot start a completed maintenance record"), { code: 409 });
  if (record.status === 'CANCELLED') throw Object.assign(new Error("Cannot start a cancelled maintenance record"), { code: 409 });

  return prisma.maintenanceRecord.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
      ...(data.notes ? { notes: data.notes } : {})
    },
    include: { vehicle: true, schedule: true }
  });
};

const completeRecord = async (companyId, id, userId, data = {}) => {
  return prisma.$transaction(async (tx) => {
    const record = await tx.maintenanceRecord.findFirst({
      where: { id, companyId },
      include: { vehicle: true, schedule: true }
    });

    if (!record) throw Object.assign(new Error("Maintenance record not found"), { code: 404 });
    if (record.status === 'COMPLETED') throw Object.assign(new Error("Maintenance record is already completed"), { code: 409 });
    if (record.status === 'CANCELLED') throw Object.assign(new Error("Cannot complete a cancelled maintenance record"), { code: 409 });

    const completedAt = data.completedAt ? new Date(data.completedAt) : new Date();
    const serviceOdometer = data.odometerAtService != null
      ? data.odometerAtService
      : (record.odometerAtService != null ? record.odometerAtService : (record.vehicle.odometer || 0));

    const updatedRecord = await tx.maintenanceRecord.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt,
        odometerAtService: serviceOdometer,
        ...(data.cost != null ? { cost: new Prisma.Decimal(data.cost) } : {}),
        ...(data.vendor ? { vendor: data.vendor } : {}),
        ...(data.notes ? { notes: data.notes } : {})
      },
      include: { vehicle: true, schedule: true }
    });

    // If associated with a schedule, advance the schedule's nextDue markers transactionally
    if (record.scheduleId) {
      const schedule = await tx.maintenanceSchedule.findFirst({
        where: { id: record.scheduleId, companyId }
      });

      if (schedule && schedule.isActive) {
        let nextDueAt = null;
        if (schedule.intervalDays) {
          nextDueAt = new Date(completedAt.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000);
        }

        let nextDueOdometer = null;
        if (schedule.intervalKm) {
          nextDueOdometer = serviceOdometer + schedule.intervalKm;
        }

        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: {
            lastServiceAt: completedAt,
            lastServiceOdometer: serviceOdometer,
            nextDueAt,
            nextDueOdometer
          }
        });

        // Resolve active alerts for this schedule in the same transaction
        await tx.alert.updateMany({
          where: {
            companyId,
            maintenanceScheduleId: schedule.id,
            status: { in: ['OPEN', 'ACKNOWLEDGED'] }
          },
          data: {
            status: 'RESOLVED',
            resolvedAt: completedAt,
            resolvedBy: userId || 'SYSTEM_MAINTENANCE_COMPLETED'
          }
        });
      }
    }

    return updatedRecord;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const cancelRecord = async (companyId, id, userId, data = {}) => {
  const record = await prisma.maintenanceRecord.findFirst({ where: { id, companyId } });
  if (!record) throw Object.assign(new Error("Maintenance record not found"), { code: 404 });
  if (record.status === 'COMPLETED') throw Object.assign(new Error("Cannot cancel a completed maintenance record"), { code: 409 });
  if (record.status === 'CANCELLED') throw Object.assign(new Error("Record is already cancelled"), { code: 409 });

  return prisma.maintenanceRecord.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      ...(data.notes ? { notes: data.notes } : {})
    },
    include: { vehicle: true, schedule: true }
  });
};

const getVehicleMaintenanceDetails = async (companyId, vehicleId, driverVehicleId = null, isDriver = false) => {
  if (driverVehicleId && driverVehicleId !== vehicleId) {
    throw Object.assign(new Error("Access denied: You can only view maintenance for your assigned vehicle"), { code: 403 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId }
  });
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { code: 404 });

  const [schedules, rawRecords, activeAlerts] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: { vehicleId, companyId, isActive: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.maintenanceRecord.findMany({
      where: { vehicleId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        schedule: { select: { id: true, name: true } }
      }
    }),
    prisma.alert.findMany({
      where: { vehicleId, companyId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const now = new Date();
  const enhancedSchedules = schedules.map(schedule => {
    const dueInfo = calculateDueStatus(schedule, vehicle, now);
    return {
      ...schedule,
      dueStatus: dueInfo.status,
      priority: dueInfo.priority,
      reason: dueInfo.reason,
      daysRemaining: dueInfo.daysRemaining,
      daysOverdue: dueInfo.daysOverdue,
      kmRemaining: dueInfo.kmRemaining,
      kmOverdue: dueInfo.kmOverdue
    };
  });

  const records = rawRecords.map(record => {
    if (isDriver) {
      const { cost, ...safeRecord } = record;
      return safeRecord;
    }
    return record;
  });

  return {
    vehicle: {
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      status: vehicle.status,
      odometer: vehicle.odometer
    },
    schedules: enhancedSchedules,
    dueItems: enhancedSchedules.filter(s => s.dueStatus === 'OVERDUE' || s.dueStatus === 'UPCOMING'),
    history: records,
    activeAlerts
  };
};

module.exports = {
  getSummary,
  getDueItems,
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  startRecord,
  completeRecord,
  cancelRecord,
  getVehicleMaintenanceDetails
};
