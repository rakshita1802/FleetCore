const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    vehicle: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    driver: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    vehicleAssignment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => {
      if (Array.isArray(cb)) {
        return Promise.all(cb);
      }
      return cb(mPrismaClient);
    }),
  };
  return { 
    PrismaClient: jest.fn(() => mPrismaClient),
    Prisma: {
      TransactionIsolationLevel: {
        Serializable: 'Serializable'
      }
    }
  };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Phase 3 - Fleet API & IDOR Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('IDOR & Isolation Tests', () => {
    it('Scenario A: Should block GET vehicle belonging to another company', async () => {
      const token = getAuthToken('ADMIN', 'comp-b'); // User from Company B
      
      // Mock auth middleware pulling user
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', role: 'ADMIN', companyId: 'comp-b'
      });

      // Prisma returns null when querying with req.user.companyId since vehicle belongs to comp-a
      prisma.vehicle.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/vehicles/veh-a')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(404);
      expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: 'veh-a', companyId: 'comp-b' },
        include: expect.any(Object)
      });
    });

    it('Scenario C: Should block assignment of cross-tenant driver and vehicle', async () => {
      const token = getAuthToken('ADMIN', 'comp-b');
      
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', role: 'ADMIN', companyId: 'comp-b'
      });

      // Simulating vehicle doesn't exist for comp-b
      prisma.vehicle.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: '123e4567-e89b-12d3-a456-426614174000', driverId: '123e4567-e89b-12d3-a456-426614174001' });

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('Vehicle not found or cross-tenant');
    });
  });

  describe('Vehicle API', () => {
    it('Should allow ADMIN to create vehicle', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      prisma.vehicle.findFirst.mockResolvedValueOnce(null); // No conflicts
      prisma.vehicle.create.mockResolvedValueOnce({ id: 'veh-new' });

      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          registrationNumber: 'AB123',
          make: 'Toyota',
          model: 'Hilux',
          year: 2023,
          vehicleType: 'TRUCK',
          fuelType: 'DIESEL'
        });

      expect(res.statusCode).toEqual(201);
    });

    it('Should block DRIVER from creating vehicle', async () => {
      const token = getAuthToken('DRIVER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', role: 'DRIVER', companyId: 'comp-a' });

      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('Assignment Integrity', () => {
    it('Should prevent double assignment of driver', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: '123e4567-e89b-12d3-a456-426614174000', status: 'ACTIVE' }); // Vehicle check
      prisma.driver.findFirst.mockResolvedValueOnce({ id: '123e4567-e89b-12d3-a456-426614174001', status: 'ACTIVE' }); // Driver check
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce(null); // Vehicle not assigned check
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce({ id: 'assn-active' }); // Driver already assigned check!

      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: '123e4567-e89b-12d3-a456-426614174000', driverId: '123e4567-e89b-12d3-a456-426614174001' });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('Driver is already assigned');
    });
  });
});
