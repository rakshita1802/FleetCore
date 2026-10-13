const { z } = require('zod');

const createTripSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  originName: z.string().min(1).max(255),
  originLatitude: z.number().min(-90).max(90),
  originLongitude: z.number().min(-180).max(180),
  destinationName: z.string().min(1).max(255),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
  scheduledStartAt: z.string().datetime(),
  scheduledEndAt: z.string().datetime().optional(),
  odometerStart: z.number().min(0),
  notes: z.string().max(1000).optional()
}).refine(data => {
  if (data.scheduledEndAt) {
    return new Date(data.scheduledEndAt) > new Date(data.scheduledStartAt);
  }
  return true;
}, {
  message: "scheduledEndAt must be after scheduledStartAt",
  path: ["scheduledEndAt"]
});

const completeTripSchema = z.object({
  odometerEnd: z.number().min(0),
  notes: z.string().max(1000).optional()
});

module.exports = {
  createTripSchema,
  completeTripSchema
};
