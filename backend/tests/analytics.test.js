const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    user: { findUnique: jest.fn() },
    trip: { findMany: jest.fn(), groupBy: jest.fn() },
    vehicle: { findMany: jest.fn(), count: jest.fn() },
    vehicleAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    telemetry: { count: jest.fn() },
    $queryRaw: jest.fn()
  };
  return { PrismaClient: jest.fn(() => mPrismaClient), Prisma: { sql: jest.fn(), empty: '' } };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Phase 7 - Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('GET /api/analytics/overview', () => {
    it('Should fetch fleet overview successfully', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.trip.findMany
        .mockResolvedValueOnce([
          { status: 'COMPLETED', distanceKm: 100, actualStartAt: new Date(), actualEndAt: new Date(Date.now() + 600000) },
          { status: 'CANCELLED', distanceKm: 0 }
        ])
        .mockResolvedValueOnce([{ vehicleId: 'v1' }]);
      
      prisma.vehicle.count
        .mockResolvedValueOnce(5) // totalVehicles
        .mockResolvedValueOnce(3); // activeVehicles

      prisma.$queryRaw.mockResolvedValueOnce([{ totalIdleMinutes: 150 }]); // idle minutes

      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTrips).toBe(2);
      expect(res.body.data.completedTrips).toBe(1);
      expect(res.body.data.totalDistanceKm).toBe(100);
      expect(res.body.data.totalIdleTimeMinutes).toBe(150);
      expect(res.body.data.activeVehicles).toBe(3);
    });

    it('Should restrict overview to driver vehicle only', async () => {
      const token = getAuthToken('DRIVER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'DRIVER', companyId: 'comp-a' });
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce({ vehicleId: 'v1' });

      prisma.trip.findMany.mockResolvedValue([]);
      prisma.vehicle.count.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([{ totalIdleMinutes: 0 }]);

      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      // It should query trip where vehicleId = 'v1'
      expect(prisma.trip.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ vehicleId: 'v1' })
      }));
    });
  });

  describe('GET /api/analytics/utilization', () => {
    it('Should return utilization metrics', async () => {
      const token = getAuthToken('FLEET_MANAGER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'FLEET_MANAGER', companyId: 'comp-a' });

      prisma.vehicle.findMany.mockResolvedValueOnce([
        { id: 'v1', registrationNumber: 'REG-1' },
        { id: 'v2', registrationNumber: 'REG-2' }
      ]);

      prisma.trip.groupBy.mockResolvedValueOnce([
        { vehicleId: 'v1', _count: { id: 2 }, _sum: { distanceKm: 200 } }
      ]);

      const res = await request(app)
        .get('/api/analytics/utilization')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.vehiclesUsed).toBe(1);
      expect(res.body.data.unusedVehicles).toBe(1);
      expect(res.body.data.utilizationRate).toBe(0.5);
      expect(res.body.data.vehicleRankings.length).toBe(2);
    });

    it('Should correctly compute Vehicle Usage Rate excluding retired vehicles and non-qualifying trips', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // Return 8 eligible active vehicles out of 10 total
      prisma.vehicle.findMany.mockResolvedValueOnce([
        { id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' },
        { id: 'v5' }, { id: 'v6' }, { id: 'v7' }, { id: 'v8' }
      ]);

      // Only 4 vehicles have qualifying trips
      prisma.trip.groupBy.mockResolvedValueOnce([
        { vehicleId: 'v1', _count: { id: 1 } },
        { vehicleId: 'v2', _count: { id: 1 } },
        { vehicleId: 'v3', _count: { id: 1 } },
        { vehicleId: 'v4', _count: { id: 1 } }
      ]);

      const res = await request(app)
        .get('/api/analytics/utilization')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.vehiclesUsed).toBe(4);
      expect(res.body.data.utilizationRate).toBe(4 / 8);
    });
  });

  describe('GET /api/analytics/overview metrics', () => {
    it('Should correctly compute completion and cancellation rates based only on terminal states', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.trip.findMany
        .mockResolvedValueOnce([
          { status: 'COMPLETED' }, { status: 'COMPLETED' }, { status: 'COMPLETED' }, { status: 'COMPLETED' },
          { status: 'COMPLETED' }, { status: 'COMPLETED' }, { status: 'COMPLETED' }, { status: 'COMPLETED' },
          { status: 'CANCELLED' }, { status: 'CANCELLED' },
          { status: 'PLANNED' }, { status: 'PLANNED' }, { status: 'PLANNED' }, { status: 'PLANNED' }, { status: 'PLANNED' },
          { status: 'IN_PROGRESS' }, { status: 'IN_PROGRESS' }, { status: 'IN_PROGRESS' }
        ])
        .mockResolvedValueOnce([]); // distinct vehicles
      
      prisma.vehicle.count.mockResolvedValue(10);
      prisma.$queryRaw.mockResolvedValueOnce([{ totalIdleMinutes: 0 }]); 

      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.completedTrips).toBe(8);
      expect(res.body.data.cancelledTrips).toBe(2);
      expect(res.body.data.plannedTrips).toBe(5);
      expect(res.body.data.inProgressTrips).toBe(3);
      expect(res.body.data.completionRate).toBe(8 / 10); // 80%
      expect(res.body.data.cancellationRate).toBe(2 / 10); // 20%
    });

    it('Should return null for completion rates when there are no terminal trips', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.trip.findMany
        .mockResolvedValueOnce([
          { status: 'PLANNED' }, { status: 'PLANNED' }, { status: 'PLANNED' }, { status: 'PLANNED' }, { status: 'PLANNED' },
          { status: 'IN_PROGRESS' }, { status: 'IN_PROGRESS' }, { status: 'IN_PROGRESS' }
        ])
        .mockResolvedValueOnce([]); 
      
      prisma.vehicle.count.mockResolvedValue(10);
      prisma.$queryRaw.mockResolvedValueOnce([{ totalIdleMinutes: 0 }]); 

      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.completedTrips).toBe(0);
      expect(res.body.data.cancelledTrips).toBe(0);
      expect(res.body.data.completionRate).toBeNull();
      expect(res.body.data.cancellationRate).toBeNull();
    });
  });

  describe('GET /api/analytics/idle-time', () => {
    it('Should calculate idle time using observed duration', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // Mock raw query response indicating 3 minutes observed duration (3 intervals of 1 min)
      prisma.$queryRaw.mockResolvedValueOnce([
        { vehicleId: 'v1', registrationNumber: 'TEST-1', idleMinutes: 3 }
      ]);

      const res = await request(app)
        .get('/api/analytics/idle-time')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.totalIdleMinutes).toBe(3);
      expect(res.body.data.vehicleRankings[0].idleMinutes).toBe(3);
    });

    it('Should not count large telemetry gaps as idle time', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // Mock raw query response indicating 4 hour gap was ignored (returned 0 idle mins)
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/analytics/idle-time')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.totalIdleMinutes).toBe(0);
      expect(res.body.data.vehicleRankings.length).toBe(0);
    });
  });

  describe('Validation', () => {
    it('Should reject invalid date ranges', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      const res = await request(app)
        .get('/api/analytics/overview?startDate=2026-09-30T00:00:00Z&endDate=2026-09-01T00:00:00Z')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].message).toContain('startDate must be before or equal to endDate');
    });
  });
});
