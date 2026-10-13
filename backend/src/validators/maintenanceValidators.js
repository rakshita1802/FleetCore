const { z } = require('zod');

const serviceTypeEnum = z.enum([
  'OIL_CHANGE',
  'BRAKE_SERVICE',
  'TIRE_SERVICE',
  'BATTERY',
  'ENGINE_SERVICE',
  'GENERAL_SERVICE',
  'INSPECTION',
  'OTHER'
]);

const triggerTypeEnum = z.enum([
  'TIME',
  'ODOMETER',
  'TIME_OR_ODOMETER'
]);

const maintenanceStatusEnum = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]);

const createScheduleSchema = z.object({
  vehicleId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  serviceType: serviceTypeEnum,
  triggerType: triggerTypeEnum.optional().default('TIME_OR_ODOMETER'),
  intervalKm: z.number().positive("intervalKm must be positive").optional().nullable(),
  intervalDays: z.number().int().positive("intervalDays must be a positive integer").optional().nullable(),
  lastServiceAt: z.string().datetime().optional().nullable(),
  lastServiceOdometer: z.number().min(0, "lastServiceOdometer cannot be negative").optional().nullable()
}).refine(data => {
  return data.intervalKm != null || data.intervalDays != null;
}, {
  message: "At least one of intervalKm or intervalDays must be provided",
  path: ["intervalKm"]
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  serviceType: serviceTypeEnum.optional(),
  triggerType: triggerTypeEnum.optional(),
  intervalKm: z.number().positive("intervalKm must be positive").optional().nullable(),
  intervalDays: z.number().int().positive("intervalDays must be a positive integer").optional().nullable(),
  lastServiceAt: z.string().datetime().optional().nullable(),
  lastServiceOdometer: z.number().min(0, "lastServiceOdometer cannot be negative").optional().nullable(),
  isActive: z.boolean().optional()
});

const createRecordSchema = z.object({
  vehicleId: z.string().uuid(),
  scheduleId: z.string().uuid().optional().nullable(),
  serviceType: serviceTypeEnum,
  description: z.string().max(1000).optional().nullable(),
  status: maintenanceStatusEnum.optional().default('SCHEDULED'),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  odometerAtService: z.number().min(0, "odometerAtService cannot be negative").optional().nullable(),
  cost: z.number().min(0, "cost cannot be negative").optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

const updateRecordSchema = z.object({
  serviceType: serviceTypeEnum.optional(),
  description: z.string().max(1000).optional().nullable(),
  odometerAtService: z.number().min(0, "odometerAtService cannot be negative").optional().nullable(),
  cost: z.number().min(0, "cost cannot be negative").optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

const startRecordSchema = z.object({
  startedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional()
});

const completeRecordSchema = z.object({
  completedAt: z.string().datetime().optional(),
  odometerAtService: z.number().min(0, "odometerAtService cannot be negative").optional().nullable(),
  cost: z.number().min(0, "cost cannot be negative").optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

const cancelRecordSchema = z.object({
  notes: z.string().max(2000).optional().nullable()
});

module.exports = {
  serviceTypeEnum,
  triggerTypeEnum,
  maintenanceStatusEnum,
  createScheduleSchema,
  updateScheduleSchema,
  createRecordSchema,
  updateRecordSchema,
  startRecordSchema,
  completeRecordSchema,
  cancelRecordSchema
};
