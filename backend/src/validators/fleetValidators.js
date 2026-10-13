const { z } = require('zod');

const vehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  vin: z.string().optional(),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  vehicleType: z.enum(['CAR', 'VAN', 'TRUCK', 'BUS', 'MOTORCYCLE', 'OTHER']),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'OTHER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
  odometer: z.number().min(0).optional(),
});

const driverSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required'),
  name: z.string().min(1, 'Name is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseExpiry: z.string().datetime({ message: "Invalid datetime string" }),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  userId: z.string().uuid().optional(),
});

const assignmentSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
});

module.exports = {
  vehicleSchema,
  driverSchema,
  assignmentSchema
};
