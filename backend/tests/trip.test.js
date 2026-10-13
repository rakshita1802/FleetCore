const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    trip: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    vehicle: {
      findFirst: jest.fn(),
    },
    driver: {
      findFirst: jest.fn(),
    },
    vehicleAssignment: {
      findFirst: jest.fn(),
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
    Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } }
  };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Phase 4 - Trip API & IDOR Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('IDOR & Security', () => {
    it('Should block GET trip details for cross-tenant trip', async () => {
      const token = getAuthToken('ADMIN', 'comp-b');
      
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-b' });
      // Simulate trip not found because companyId constraint
      prisma.trip.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/trips/trip-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(404);
    });

    it('Should block DRIVER from accessing trips not assigned to them', async () => {
      const token = getAuthToken('DRIVER', 'comp-a');
      
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', role: 'DRIVER', companyId: 'comp-a' });
      prisma.driver.findFirst.mockResolvedValueOnce({ id: 'drv-2', userId: 'user-2', companyId: 'comp-a' });
      
      // Simulate that the service searched with driverRoleAccessId='drv-2' and didn't find the trip
      prisma.trip.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/trips/trip-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('Trip Creation & Validation', () => {
    it('Should block trip creation if no active assignment exists', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1', status: 'ACTIVE' });
      prisma.driver.findFirst.mockResolvedValueOnce({ id: 'd1', status: 'ACTIVE' });
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce(null); // No active assignment

      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          driverId: '123e4567-e89b-12d3-a456-426614174001',
          originName: 'A', originLatitude: 10, originLongitude: 10,
          destinationName: 'B', destinationLatitude: 20, destinationLongitude: 20,
          scheduledStartAt: new Date().toISOString(),
          odometerStart: 1000
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('active assignment');
    });

    it('Should allow trip creation if assignment exists', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1', status: 'ACTIVE' });
      prisma.driver.findFirst.mockResolvedValueOnce({ id: 'd1', status: 'ACTIVE' });
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce({ id: 'a1' });
      prisma.trip.count.mockResolvedValueOnce(5); // So tripNumber is TRP-XXXX-000006
      prisma.trip.create.mockResolvedValueOnce({ id: 'trip-1', status: 'PLANNED' });

      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          driverId: '123e4567-e89b-12d3-a456-426614174001',
          originName: 'A', originLatitude: 10, originLongitude: 10,
          destinationName: 'B', destinationLatitude: 20, destinationLongitude: 20,
          scheduledStartAt: new Date().toISOString(),
          odometerStart: 1000
        });

      expect(res.statusCode).toEqual(201);
    });
  });

  describe('Lifecycle State Machine', () => {
    it('Should only allow starting a PLANNED trip', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      // Simulate trip already IN_PROGRESS
      prisma.trip.findFirst.mockResolvedValueOnce({ id: 'trip-1', status: 'IN_PROGRESS' });

      const res = await request(app)
        .post('/api/trips/trip-1/start')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('Only PLANNED trips');
    });
  });
});
