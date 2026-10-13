const { z } = require('zod');

const alertTypeEnum = z.enum([
  'MAINTENANCE_DUE',
  'MAINTENANCE_OVERDUE',
  'OTHER'
]);

const alertSeverityEnum = z.enum([
  'INFO',
  'WARNING',
  'CRITICAL'
]);

const alertStatusEnum = z.enum([
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED'
]);

const acknowledgeAlertSchema = z.object({
  notes: z.string().max(500).optional().nullable()
});

const resolveAlertSchema = z.object({
  notes: z.string().max(500).optional().nullable()
});

module.exports = {
  alertTypeEnum,
  alertSeverityEnum,
  alertStatusEnum,
  acknowledgeAlertSchema,
  resolveAlertSchema
};
