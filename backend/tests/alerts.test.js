const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    vehicle: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    driver: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    vehicleAssignment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    maintenanceSchedule: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    maintenanceRecord: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    alert: {
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

describe('Phase 8 - Operational Alerts & Deduplication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('GET /api/alerts', () => {
    it('Should return paginated alerts for ADMIN/FLEET_MANAGER', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      prisma.alert.count.mockResolvedValueOnce(1);
      prisma.alert.findMany.mockResolvedValueOnce([
        {
          id: 'alt-1',
          companyId: 'comp-a',
          type: 'MAINTENANCE_OVERDUE',
          severity: 'CRITICAL',
          title: 'Maintenance Overdue: Brake Service',
          message: 'Vehicle REG-1 is overdue for BRAKE_SERVICE',
          status: 'OPEN',
          vehicle: { id: 'v-1', registrationNumber: 'REG-1', odometer: 20000 },
          maintenanceSchedule: { id: 's-1', name: 'Brake Check', serviceType: 'BRAKE_SERVICE' }
        }
      ]);

      const res = await request(app)
        .get('/api/alerts?status=OPEN')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].severity).toBe('CRITICAL');
    });
  });

  describe('POST /api/alerts/:id/acknowledge & resolve', () => {
    it('Should allow FLEET_MANAGER to acknowledge an OPEN alert', async () => {
      const token = getAuthToken('FLEET_MANAGER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'FLEET_MANAGER', companyId: 'comp-a' });

      prisma.alert.findFirst.mockResolvedValueOnce({
        id: 'alt-1',
        companyId: 'comp-a',
        status: 'OPEN'
      });

      prisma.alert.update.mockResolvedValueOnce({
        id: 'alt-1',
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: 'user-1'
      });

      const res = await request(app)
        .post('/api/alerts/alt-1/acknowledge')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Scheduled for workshop next Monday' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');
    });

    it('Should allow FLEET_MANAGER to resolve an alert', async () => {
      const token = getAuthToken('FLEET_MANAGER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'FLEET_MANAGER', companyId: 'comp-a' });

      prisma.alert.findFirst.mockResolvedValueOnce({
        id: 'alt-1',
        companyId: 'comp-a',
        status: 'ACKNOWLEDGED'
      });

      prisma.alert.update.mockResolvedValueOnce({
        id: 'alt-1',
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: 'user-1'
      });

      const res = await request(app)
        .post('/api/alerts/alt-1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Inspection completed manually' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.status).toBe('RESOLVED');
    });

    it('Should reject resolving an already resolved alert with 409', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      prisma.alert.findFirst.mockResolvedValueOnce({
        id: 'alt-1',
        companyId: 'comp-a',
        status: 'RESOLVED'
      });

      const res = await request(app)
        .post('/api/alerts/alt-1/resolve')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('already resolved');
    });
  });

  describe('Alert Evaluation & Deduplication Strategy', () => {
    it('Should create missing alerts and prevent duplicate active alerts during evaluation', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      const now = new Date();
      const pastDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      // Active schedule that is OVERDUE
      prisma.maintenanceSchedule.findMany.mockResolvedValueOnce([
        {
          id: 's-overdue',
          companyId: 'comp-a',
          name: 'Oil Change',
          serviceType: 'OIL_CHANGE',
          triggerType: 'TIME',
          nextDueAt: pastDate,
          nextDueOdometer: null,
          vehicle: { id: 'v-1', registrationNumber: 'TEST-1', status: 'ACTIVE', odometer: 10000 }
        }
      ]);

      prisma.alert.findMany.mockResolvedValueOnce([]);
      prisma.alert.create.mockResolvedValueOnce({ id: 'alt-created' });

      const alertService = require('../src/services/alertService');
      const result = await alertService.evaluateAndGenerateAlerts('comp-a');

      expect(result.alertsCreatedCount).toBe(1);
      expect(prisma.alert.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'MAINTENANCE_OVERDUE',
          severity: 'CRITICAL',
          companyId: 'comp-a'
        })
      }));
    });
  });
});
