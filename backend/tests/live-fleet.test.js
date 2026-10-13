const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../src/services/redisService', () => {
  const mClient = {
    status: 'ready',
    get: jest.fn(),
    set: jest.fn(),
    ping: jest.fn()
  };
  return {
    getClient: jest.fn(() => mClient),
    getVehicleState: jest.fn(),
    setVehicleState: jest.fn(),
    updateStateIfNewer: jest.fn(),
    checkHealth: jest.fn()
  };
});

jest.mock('../src/socket', () => ({
  initSocket: jest.fn(),
  getIo: jest.fn(),
  emitVehicleUpdate: jest.fn()
}));

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    vehicle: { findMany: jest.fn(), findFirst: jest.fn() },
    vehicleAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    telemetry: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const redisService = require('../src/services/redisService');
const socketService = require('../src/socket');

describe('Phase 6 - Live Fleet API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('Live Fleet Access', () => {
    it('Should fetch live fleet', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      prisma.vehicle.findMany.mockResolvedValueOnce([{ id: 'v1', registrationNumber: 'REG-1' }]);
      
      redisService.getVehicleState.mockResolvedValueOnce({
        vehicleId: 'v1',
        timestamp: new Date().toISOString(),
        speedKph: 50,
        status: 'ONLINE'
      });
      prisma.vehicleAssignment.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/fleet/live')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].speedKph).toBe(50);
      expect(res.body.data[0].status).toBe('ONLINE');
    });

    it('Should fallback to DB if Redis is empty', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });
      prisma.vehicle.findMany.mockResolvedValueOnce([{ id: 'v1', registrationNumber: 'REG-1' }]);
      
      redisService.getVehicleState.mockResolvedValueOnce(null); // Redis miss

      prisma.telemetry.findMany.mockResolvedValueOnce([{
        vehicleId: 'v1',
        timestamp: new Date(Date.now() - 4000000).toISOString(), // older than 1 hour
        speedKph: 0
      }]);
      prisma.vehicleAssignment.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/fleet/live')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data[0].status).toBe('OFFLINE'); // Older than 300s -> OFFLINE
    });
  });

  describe('Telemetry Pipeline', () => {
    // Tests processTelemetry integration indirectly via liveFleetService
    it('Should trigger Socket.IO emit when telemetry arrives', async () => {
      const liveFleetService = require('../src/services/liveFleetService');
      
      redisService.getVehicleState.mockResolvedValueOnce({ timestamp: '2020-01-01' }); // Old timestamp

      prisma.vehicle.findFirst.mockResolvedValueOnce({ registrationNumber: 'TEST-1' });
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce({ driver: { userId: 'd-1' } });

      const telemetryData = {
        vehicleId: 'v1',
        timestamp: new Date().toISOString(),
        speedKph: 100
      };

      redisService.updateStateIfNewer.mockResolvedValueOnce(true);
      await liveFleetService.processTelemetry('comp-a', telemetryData);
      
      expect(redisService.updateStateIfNewer).toHaveBeenCalled();
      expect(socketService.emitVehicleUpdate).toHaveBeenCalledWith('comp-a', 'd-1', 'v1', expect.objectContaining({
        status: 'ONLINE',
        speedKph: 100
      }));
    });
  });
});
