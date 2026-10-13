const { z } = require('zod');

const REPORT_TYPES = ['FLEET_UTILIZATION', 'TRIPS', 'MAINTENANCE', 'ALERTS'];

const reportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  status: z.string().optional(),
  serviceType: z.string().optional(),
  alertType: z.string().optional(),
  page: z.string().optional().transform(val => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform(val => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 25))
}).refine((data) => {
  const startStr = data.startDate || data.dateFrom;
  const endStr = data.endDate || data.dateTo;

  if (startStr && isNaN(Date.parse(startStr))) return false;
  if (endStr && isNaN(Date.parse(endStr))) return false;

  if (startStr && endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start > end) return false;

    // Bounded max date range: 365 days
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) return false;
  }

  return true;
}, {
  message: 'Invalid date range: startDate must be before endDate and span at most 365 days'
});

const reportExportBodySchema = z.object({
  reportType: z.enum(['FLEET_UTILIZATION', 'TRIPS', 'MAINTENANCE', 'ALERTS']),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    status: z.string().optional(),
    serviceType: z.string().optional(),
    alertType: z.string().optional()
  }).optional().default({})
});

module.exports = {
  REPORT_TYPES,
  reportQuerySchema,
  reportExportBodySchema
};
