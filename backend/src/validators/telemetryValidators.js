const { z } = require('zod');

const telemetryIngestionSchema = z.object({
  vehicleId: z.string().uuid("Invalid vehicleId format"),
  tripId: z.string().uuid("Invalid tripId format").optional().nullable(),
  timestamp: z.string().datetime("Invalid ISO timestamp"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKph: z.number().min(0).max(300),
  heading: z.number().min(0).max(359.99),
  fuelLevel: z.number().min(0).max(100),
  engineStatus: z.enum(['ON', 'OFF', 'IDLE', 'UNKNOWN']),
  odometer: z.number().min(0)
});

module.exports = {
  telemetryIngestionSchema
};
