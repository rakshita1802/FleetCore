const { z } = require('zod');

const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.string().optional().transform(val => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform(val => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  sortBy: z.enum(['name', 'email', 'role', 'status', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional().default('desc')
});

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER']).default('VIEWER'),
  driverId: z.string().uuid().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional()
});

const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER'])
});

const setStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'])
});

module.exports = {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  setStatusSchema
};
