const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const REPORTS_DIR = path.resolve(__dirname, '../../reports_temp');

// Ensure temp reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Escapes a cell value for CSV output and protects against CSV formula injection.
 */
const escapeCSVCell = (val) => {
  if (val === null || val === undefined) return '';

  let str = String(val);

  // CSV Formula Injection Prevention:
  // If string starts with dangerous spreadsheet formula characters (=, +, -, @, \t, \r), prefix with a single quote.
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (str.length > 0 && dangerousChars.includes(str.charAt(0))) {
    // If it's a numeric negative number (e.g. -12.5), we allow standard numbers without quote if strictly numeric
    if (!/^-?\d+(\.\d+)?$/.test(str)) {
      str = `'${str}`;
    }
  }

  // Quote cell if it contains comma, double quote, newline, or carriage return
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Parses and bounds date range filters (default: last 30 days; max: 365 days).
 */
const parseDateRange = (filters) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const start = (filters.startDate || filters.dateFrom)
    ? new Date(filters.startDate || filters.dateFrom)
    : thirtyDaysAgo;

  const end = (filters.endDate || filters.dateTo)
    ? new Date(filters.endDate || filters.dateTo)
    : now;

  return { start, end };
};

/**
 * 1. Fleet Utilization Report Query
 */
const queryFleetUtilization = async (companyId, filters, pagination = null) => {
  const { start, end } = parseDateRange(filters);

  const vehicleWhere = { companyId };
  if (filters.vehicleId) vehicleWhere.id = filters.vehicleId;
  if (filters.status) vehicleWhere.status = filters.status;

  const totalVehicles = await prisma.vehicle.count({ where: vehicleWhere });

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere,
    ...(pagination ? { skip: pagination.skip, take: pagination.limit } : {}),
    orderBy: { registrationNumber: 'asc' },
    select: {
      id: true,
      registrationNumber: true,
      make: true,
      model: true,
      year: true,
      vehicleType: true,
      fuelType: true,
      status: true,
      odometer: true,
      trips: {
        where: {
          scheduledStartAt: { gte: start, lte: end }
        },
        select: {
          id: true,
          status: true,
          distanceKm: true
        }
      }
    }
  });

  const rows = vehicles.map(v => {
    const totalTrips = v.trips.length;
    const completedTrips = v.trips.filter(t => t.status === 'COMPLETED').length;
    const totalDistanceKm = v.trips.reduce((acc, t) => acc + (t.distanceKm || 0), 0);
    const completionRate = totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0;
    const isUtilized = totalTrips > 0;

    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      vehicleType: v.vehicleType,
      fuelType: v.fuelType,
      status: v.status,
      odometerKm: Math.round(v.odometer * 10) / 10,
      tripCount: totalTrips,
      completedTrips,
      completionRatePercent: `${completionRate}%`,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      utilized: isUtilized ? 'Yes' : 'No'
    };
  });

  return { total: totalVehicles, rows };
};

/**
 * 2. Trip Report Query
 */
const queryTripReport = async (companyId, filters, pagination = null) => {
  const { start, end } = parseDateRange(filters);

  const where = {
    companyId,
    scheduledStartAt: { gte: start, lte: end }
  };

  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.driverId) where.driverId = filters.driverId;
  if (filters.status) where.status = filters.status;

  const total = await prisma.trip.count({ where });

  const trips = await prisma.trip.findMany({
    where,
    ...(pagination ? { skip: pagination.skip, take: pagination.limit } : {}),
    orderBy: { scheduledStartAt: 'desc' },
    select: {
      id: true,
      tripNumber: true,
      originName: true,
      destinationName: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      actualStartAt: true,
      actualEndAt: true,
      distanceKm: true,
      status: true,
      vehicle: {
        select: { registrationNumber: true, make: true, model: true }
      },
      driver: {
        select: { name: true, employeeCode: true }
      }
    }
  });

  const rows = trips.map(t => ({
    tripNumber: t.tripNumber,
    vehicleRegistration: t.vehicle?.registrationNumber || 'N/A',
    vehicleModel: `${t.vehicle?.make || ''} ${t.vehicle?.model || ''}`.trim(),
    driverName: t.driver?.name || 'N/A',
    driverEmployeeCode: t.driver?.employeeCode || 'N/A',
    origin: t.originName,
    destination: t.destinationName,
    scheduledStart: t.scheduledStartAt ? t.scheduledStartAt.toISOString() : '',
    actualStart: t.actualStartAt ? t.actualStartAt.toISOString() : '',
    actualEnd: t.actualEndAt ? t.actualEndAt.toISOString() : '',
    distanceKm: t.distanceKm !== null ? Math.round(t.distanceKm * 10) / 10 : 0,
    status: t.status
  }));

  return { total, rows };
};

/**
 * 3. Maintenance Report Query
 */
const queryMaintenanceReport = async (companyId, filters, pagination = null) => {
  const { start, end } = parseDateRange(filters);

  const where = {
    companyId,
    createdAt: { gte: start, lte: end }
  };

  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.serviceType) where.serviceType = filters.serviceType;
  if (filters.status) where.status = filters.status;

  const total = await prisma.maintenanceRecord.count({ where });

  const records = await prisma.maintenanceRecord.findMany({
    where,
    ...(pagination ? { skip: pagination.skip, take: pagination.limit } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      serviceType: true,
      description: true,
      status: true,
      startedAt: true,
      completedAt: true,
      odometerAtService: true,
      cost: true,
      vendor: true,
      notes: true,
      createdAt: true,
      vehicle: {
        select: { registrationNumber: true, make: true, model: true }
      },
      schedule: {
        select: { name: true }
      }
    }
  });

  const rows = records.map(r => ({
    id: r.id,
    vehicleRegistration: r.vehicle?.registrationNumber || 'N/A',
    scheduleName: r.schedule?.name || 'Unscheduled / Ad-hoc',
    serviceType: r.serviceType,
    description: r.description || '',
    status: r.status,
    startedAt: r.startedAt ? r.startedAt.toISOString() : '',
    completedAt: r.completedAt ? r.completedAt.toISOString() : '',
    odometerKm: r.odometerAtService || '',
    cost: r.cost ? Number(r.cost) : 0,
    vendor: r.vendor || '',
    createdAt: r.createdAt.toISOString()
  }));

  return { total, rows };
};

/**
 * 4. Alert Report Query
 */
const queryAlertReport = async (companyId, filters, pagination = null) => {
  const { start, end } = parseDateRange(filters);

  const where = {
    companyId,
    createdAt: { gte: start, lte: end }
  };

  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.alertType) where.type = filters.alertType;
  if (filters.status) where.status = filters.status;

  const total = await prisma.alert.count({ where });

  const alerts = await prisma.alert.findMany({
    where,
    ...(pagination ? { skip: pagination.skip, take: pagination.limit } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      severity: true,
      title: true,
      message: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      acknowledgedBy: true,
      resolvedAt: true,
      resolvedBy: true,
      vehicle: {
        select: { registrationNumber: true }
      }
    }
  });

  const rows = alerts.map(a => ({
    id: a.id,
    vehicleRegistration: a.vehicle?.registrationNumber || 'N/A',
    type: a.type,
    severity: a.severity,
    title: a.title,
    message: a.message,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : '',
    resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : ''
  }));

  return { total, rows };
};

/**
 * Router to query preview data for a given report type.
 */
const generateReportPreview = async (companyId, reportType, filters = {}, pagination = { page: 1, limit: 25 }) => {
  const normType = String(reportType).toUpperCase();
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(100, Math.max(1, pagination.limit || 25));
  const skip = (page - 1) * limit;

  let queryResult;
  switch (normType) {
    case 'FLEET_UTILIZATION':
      queryResult = await queryFleetUtilization(companyId, filters, { skip, limit });
      break;
    case 'TRIPS':
      queryResult = await queryTripReport(companyId, filters, { skip, limit });
      break;
    case 'MAINTENANCE':
      queryResult = await queryMaintenanceReport(companyId, filters, { skip, limit });
      break;
    case 'ALERTS':
      queryResult = await queryAlertReport(companyId, filters, { skip, limit });
      break;
    default: {
      const error = new Error(`Unsupported report type: ${reportType}`);
      error.statusCode = 400;
      throw error;
    }
  }

  return {
    reportType: normType,
    data: queryResult.rows,
    pagination: {
      total: queryResult.total,
      page,
      limit,
      totalPages: Math.ceil(queryResult.total / limit)
    }
  };
};

/**
 * Fetches all dataset rows for export.
 */
const generateAllReportRows = async (companyId, reportType, filters = {}) => {
  const normType = String(reportType).toUpperCase();

  switch (normType) {
    case 'FLEET_UTILIZATION': {
      const { rows } = await queryFleetUtilization(companyId, filters, null);
      return rows;
    }
    case 'TRIPS': {
      const { rows } = await queryTripReport(companyId, filters, null);
      return rows;
    }
    case 'MAINTENANCE': {
      const { rows } = await queryMaintenanceReport(companyId, filters, null);
      return rows;
    }
    case 'ALERTS': {
      const { rows } = await queryAlertReport(companyId, filters, null);
      return rows;
    }
    default: {
      const error = new Error(`Unsupported report type: ${reportType}`);
      error.statusCode = 400;
      throw error;
    }
  }
};

/**
 * Formats report rows to CSV string with header, row escaping, and formula injection protection.
 */
const formatReportToCSV = (reportType, rows) => {
  if (!rows || rows.length === 0) {
    return 'No data available for the selected criteria\n';
  }

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(h => escapeCSVCell(h)).join(',');

  const lines = rows.map(row => {
    return headers.map(field => escapeCSVCell(row[field])).join(',');
  });

  return [headerLine, ...lines].join('\n');
};

/**
 * Writes report CSV to a secure temporary file and returns metadata.
 */
const writeReportFile = async (companyId, reportType, csvContent) => {
  const fileId = crypto.randomBytes(16).toString('hex');
  const fileName = `report_${String(reportType).toLowerCase()}_${Date.now()}.csv`;
  const secureFileName = `${companyId}_${fileId}_${fileName}`;
  const filePath = path.join(REPORTS_DIR, secureFileName);

  await fs.promises.writeFile(filePath, '\uFEFF' + csvContent, 'utf8'); // Add UTF-8 BOM for Excel compatibility

  return {
    fileId,
    fileName,
    filePath,
    secureFileName,
    createdAt: new Date().toISOString()
  };
};

/**
 * Resolves a downloadable file path after validating company ownership and preventing traversal.
 */
const getSecureReportFilePath = (companyId, fileId) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return null;
  }

  const files = fs.readdirSync(REPORTS_DIR);
  const targetFile = files.find(f => f.startsWith(`${companyId}_${fileId}_`));
  if (!targetFile) return null;

  const resolved = path.join(REPORTS_DIR, targetFile);
  // Ensure path is within REPORTS_DIR
  if (!resolved.startsWith(REPORTS_DIR)) {
    return null;
  }

  return {
    filePath: resolved,
    fileName: targetFile.split('_').slice(2).join('_') || 'report.csv'
  };
};

/**
 * Cleans up temp report files older than maxAgeHours (default 24h).
 */
const cleanupExpiredReports = async (maxAgeHours = 24) => {
  if (!fs.existsSync(REPORTS_DIR)) return { deletedCount: 0 };

  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const files = await fs.promises.readdir(REPORTS_DIR);
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(REPORTS_DIR, file);
    try {
      const stat = await fs.promises.stat(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    } catch (e) {
      logger.warn('[Report] Failed to remove expired file', { file, error: e.message });
    }
  }

  return { deletedCount };
};

module.exports = {
  REPORTS_DIR,
  escapeCSVCell,
  parseDateRange,
  generateReportPreview,
  generateAllReportRows,
  formatReportToCSV,
  writeReportFile,
  getSecureReportFilePath,
  cleanupExpiredReports
};
