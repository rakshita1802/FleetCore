const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    telemetry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    vehicle: {
      findFirst: jest.fn()
    },
    trip: {
      findFirst: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Phase 5 - Telemetry API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('Ingestion & Validation', () => {
    it('Should block telemetry ingestion for DRIVER', async () => {
      const token = getAuthToken('DRIVER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'DRIVER', companyId: 'comp-a' });
      
      const res = await request(app)
        .post('/api/telemetry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: new Date().toISOString(),
          latitude: 10, longitude: 10, speedKph: 40, heading: 90,
          fuelLevel: 50, engineStatus: 'ON', odometer: 1000
        });

      expect(res.statusCode).toEqual(403);
    });

    it('Should return 400 for invalid speed/heading values', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      const res = await request(app)
        .post('/api/telemetry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: new Date().toISOString(),
          latitude: 10, longitude: 10, speedKph: 400, // Invalid > 300
          heading: -5, // Invalid < 0
          fuelLevel: 50, engineStatus: 'ON', odometer: 1000
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('Should reject if vehicle belongs to another company (Tenant isolation)', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      // Simulate not found in company A
      prisma.vehicle.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/telemetry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: new Date().toISOString(),
          latitude: 10, longitude: 10, speedKph: 40, heading: 90,
          fuelLevel: 50, engineStatus: 'ON', odometer: 1000
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('Vehicle not found');
    });

    it('Should reject if trip belongs to different vehicle', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
      // Trip belongs to vehicle v2
      prisma.trip.findFirst.mockResolvedValueOnce({ id: 't1', vehicleId: 'v2' });

      const res = await request(app)
        .post('/api/telemetry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          tripId: '123e4567-e89b-12d3-a456-426614174001',
          timestamp: new Date().toISOString(),
          latitude: 10, longitude: 10, speedKph: 40, heading: 90,
          fuelLevel: 50, engineStatus: 'ON', odometer: 1000
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('Trip does not belong');
    });

    it('Should successfully ingest telemetry', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
      prisma.telemetry.create.mockResolvedValueOnce({ id: 'tel-1' });

      const res = await request(app)
        .post('/api/telemetry')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '123e4567-e89b-12d3-a456-426614174000',
          timestamp: new Date().toISOString(),
          latitude: 10, longitude: 10, speedKph: 40, heading: 90,
          fuelLevel: 50, engineStatus: 'ON', odometer: 1000
        });

      expect(res.statusCode).toEqual(201);
    });
  });

  describe('IDOR & Query API', () => {
    it('Should block cross-tenant read on telemetry details', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.telemetry.findFirst.mockResolvedValueOnce(null); // Simulated tenant mismatch

      const res = await request(app)
        .get('/api/telemetry/tel-99')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(404);
    });

    it('Should return telemetry list', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      
      prisma.telemetry.count.mockResolvedValueOnce(1);
      prisma.telemetry.findMany.mockResolvedValueOnce([{ id: 'tel-1' }]);

      const res = await request(app)
        .get('/api/telemetry?limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });
  });
});
