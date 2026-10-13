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
    },
    trip: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    maintenanceSchedule: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    maintenanceRecord: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
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
      Decimal: class {
        constructor(val) { this.val = val; }
        toString() { return String(this.val); }
        toJSON() { return this.val; }
      },
      TransactionIsolationLevel: {
        Serializable: 'Serializable'
      }
    }
  };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Phase 8 - Maintenance Intelligence & Due Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('POST /api/maintenance/schedules', () => {
    it('Should allow FLEET_MANAGER to create a maintenance schedule and compute nextDue targets', async () => {
      const token = getAuthToken('FLEET_MANAGER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'FLEET_MANAGER', companyId: 'comp-a' });
      
      prisma.vehicle.findFirst.mockResolvedValueOnce({
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        companyId: 'comp-a',
        status: 'ACTIVE',
        odometer: 25000
      });

      prisma.maintenanceSchedule.create.mockImplementationOnce(({ data }) => Promise.resolve({
        id: 'sched-1',
        ...data
      }));

      // Mock for evaluateAndGenerateAlerts
      prisma.maintenanceSchedule.findMany.mockResolvedValueOnce([]);
      prisma.alert.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          name: 'Regular 10k Oil Service',
          serviceType: 'OIL_CHANGE',
          triggerType: 'TIME_OR_ODOMETER',
          intervalKm: 10000,
          intervalDays: 180,
          lastServiceOdometer: 20000
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Regular 10k Oil Service');
      expect(res.body.data.nextDueOdometer).toBe(30000);
      expect(res.body.data.nextDueAt).toBeDefined();
    });

    it('Should reject schedule creation for a RETIRED vehicle with 409', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      prisma.vehicle.findFirst.mockResolvedValueOnce({
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        companyId: 'comp-a',
        status: 'RETIRED'
      });

      const res = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          name: 'Brake Inspection',
          serviceType: 'BRAKE_SERVICE',
          intervalDays: 90
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('retired');
    });

    it('Should reject schedule creation if neither intervalKm nor intervalDays is provided', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      const res = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          name: 'Invalid Schedule',
          serviceType: 'OTHER'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/maintenance/due', () => {
    it('Should accurately derive OVERDUE, UPCOMING, and SCHEDULED statuses and priorities', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      const now = new Date();
      const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const upcomingDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead
      const farFutureDate = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000); // 100 days ahead

      prisma.maintenanceSchedule.findMany.mockResolvedValueOnce([
        {
          id: 's-overdue',
          name: 'Overdue Service',
          serviceType: 'BRAKE_SERVICE',
          triggerType: 'TIME',
          nextDueAt: pastDate,
          nextDueOdometer: null,
          createdAt: now,
          vehicle: { id: 'v1', registrationNumber: 'REG-1', odometer: 10000, status: 'ACTIVE' }
        },
        {
          id: 's-upcoming',
          name: 'Upcoming Tire Rotation',
          serviceType: 'TIRE_SERVICE',
          triggerType: 'ODOMETER',
          nextDueAt: null,
          nextDueOdometer: 10300, // 300 km remaining (<= 500 threshold)
          createdAt: now,
          vehicle: { id: 'v2', registrationNumber: 'REG-2', odometer: 10000, status: 'ACTIVE' }
        },
        {
          id: 's-scheduled',
          name: 'Routine Inspection',
          serviceType: 'INSPECTION',
          triggerType: 'TIME',
          nextDueAt: farFutureDate,
          nextDueOdometer: null,
          createdAt: now,
          vehicle: { id: 'v3', registrationNumber: 'REG-3', odometer: 5000, status: 'ACTIVE' }
        }
      ]);

      const res = await request(app)
        .get('/api/maintenance/due')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBe(3);

      const overdueItem = res.body.data.find(d => d.id === 's-overdue');
      expect(overdueItem.dueStatus).toBe('OVERDUE');
      expect(overdueItem.priority).toBe('HIGH');

      const upcomingItem = res.body.data.find(d => d.id === 's-upcoming');
      expect(upcomingItem.dueStatus).toBe('UPCOMING');
      expect(upcomingItem.priority).toBe('MEDIUM');

      const scheduledItem = res.body.data.find(d => d.id === 's-scheduled');
      expect(scheduledItem.dueStatus).toBe('SCHEDULED');
      expect(scheduledItem.priority).toBe('LOW');
    });
  });

  describe('Maintenance Record Lifecycle & Transactional Completion', () => {
    it('Should transition SCHEDULED -> IN_PROGRESS -> COMPLETED and advance schedule targets', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // 1. Create Record
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v-1', companyId: 'comp-a', odometer: 50000 });
      prisma.maintenanceSchedule.findFirst.mockResolvedValueOnce({ id: 's-1', companyId: 'comp-a' });
      prisma.maintenanceRecord.create.mockResolvedValueOnce({
        id: 'rec-1',
        companyId: 'comp-a',
        vehicleId: 'v-1',
        scheduleId: 's-1',
        serviceType: 'OIL_CHANGE',
        status: 'SCHEDULED'
      });

      const createRes = await request(app)
        .post('/api/maintenance/records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          scheduleId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e',
          serviceType: 'OIL_CHANGE',
          description: '50,000 km Oil Service'
        });

      expect(createRes.statusCode).toEqual(201);
      expect(createRes.body.data.status).toBe('SCHEDULED');

      // 2. Start Record
      prisma.maintenanceRecord.findFirst.mockResolvedValueOnce({
        id: 'rec-1',
        companyId: 'comp-a',
        status: 'SCHEDULED',
        vehicle: { id: 'v-1' }
      });
      prisma.maintenanceRecord.update.mockResolvedValueOnce({
        id: 'rec-1',
        status: 'IN_PROGRESS',
        startedAt: new Date()
      });

      const startRes = await request(app)
        .post('/api/maintenance/records/rec-1/start')
        .set('Authorization', `Bearer ${token}`);

      expect(startRes.statusCode).toEqual(200);
      expect(startRes.body.data.status).toBe('IN_PROGRESS');

      // 3. Complete Record (transactional)
      prisma.maintenanceRecord.findFirst.mockResolvedValueOnce({
        id: 'rec-1',
        companyId: 'comp-a',
        status: 'IN_PROGRESS',
        scheduleId: 's-1',
        vehicle: { id: 'v-1', odometer: 50000 }
      });
      prisma.maintenanceRecord.update.mockResolvedValueOnce({
        id: 'rec-1',
        status: 'COMPLETED',
        completedAt: new Date(),
        odometerAtService: 50200,
        cost: 150.00
      });
      prisma.maintenanceSchedule.findFirst.mockResolvedValueOnce({
        id: 's-1',
        companyId: 'comp-a',
        isActive: true,
        intervalDays: 180,
        intervalKm: 10000
      });
      prisma.maintenanceSchedule.update.mockResolvedValueOnce({
        id: 's-1',
        lastServiceOdometer: 50200,
        nextDueOdometer: 60200
      });
      prisma.alert.updateMany.mockResolvedValueOnce({ count: 1 });

      const completeRes = await request(app)
        .post('/api/maintenance/records/rec-1/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          odometerAtService: 50200,
          cost: 150.00,
          vendor: 'FleetCare Workshop',
          notes: 'Replaced oil filter and engine oil'
        });

      expect(completeRes.statusCode).toEqual(200);
      expect(completeRes.body.data.status).toBe('COMPLETED');
      expect(prisma.maintenanceSchedule.update).toHaveBeenCalled();
    });

    it('Should reject double completion with 409 Conflict', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      prisma.maintenanceRecord.findFirst.mockResolvedValueOnce({
        id: 'rec-1',
        companyId: 'comp-a',
        status: 'COMPLETED',
        vehicle: { id: 'v-1' }
      });

      const res = await request(app)
        .post('/api/maintenance/records/rec-1/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          odometerAtService: 50200
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('already completed');
    });
  });

  describe('Active Trip Protection on Vehicle Status Update', () => {
    it('Should return 409 Conflict when attempting to set vehicle to MAINTENANCE while it has an active trip', async () => {
      const token = getAuthToken('FLEET_MANAGER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'FLEET_MANAGER', companyId: 'comp-a' });

      prisma.vehicle.findFirst.mockResolvedValueOnce({
        id: 'v-active',
        companyId: 'comp-a',
        status: 'ACTIVE'
      });

      // Mock existing active trip
      prisma.trip.findFirst.mockResolvedValueOnce({
        id: 'trip-running',
        companyId: 'comp-a',
        vehicleId: 'v-active',
        status: 'IN_PROGRESS'
      });

      const res = await request(app)
        .patch('/api/vehicles/v-active')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'MAINTENANCE'
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('Cannot put vehicle into MAINTENANCE status while it is on an active trip');
    });
  });

  describe('Tenant Isolation & RBAC Scoping', () => {
    it('Should enforce tenant isolation and return 404 for cross-tenant schedule access', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // Attempt to access schedule belonging to comp-b
      prisma.maintenanceSchedule.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/maintenance/schedules/sched-b')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });

    it('Should strip cost details when DRIVER queries maintenance records', async () => {
      const token = getAuthToken('DRIVER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'driver-user-1', role: 'DRIVER', companyId: 'comp-a' });

      // Mock driver and assignment resolution
      prisma.driver.findFirst.mockResolvedValueOnce({ id: 'drv-1', userId: 'driver-user-1', companyId: 'comp-a' });
      prisma.vehicleAssignment.findFirst.mockResolvedValueOnce({ id: 'asgn-1', driverId: 'drv-1', vehicleId: 'v-assigned', isActive: true });

      prisma.maintenanceRecord.count.mockResolvedValueOnce(1);
      prisma.maintenanceRecord.findMany.mockResolvedValueOnce([
        {
          id: 'rec-1',
          vehicleId: 'v-assigned',
          serviceType: 'TIRE_SERVICE',
          cost: 450.00,
          status: 'COMPLETED',
          vehicle: { id: 'v-assigned', registrationNumber: 'TEST-1' },
          schedule: null
        }
      ]);

      const res = await request(app)
        .get('/api/maintenance/records')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data[0].id).toBe('rec-1');
      expect(res.body.data[0].cost).toBeUndefined(); // Stripped for driver
    });

    it('Should forbid DRIVER from creating maintenance schedules (403)', async () => {
      const token = getAuthToken('DRIVER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'driver-user-1', role: 'DRIVER', companyId: 'comp-a' });

      const res = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          name: 'Forbidden Schedule',
          serviceType: 'OIL_CHANGE',
          intervalDays: 30
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toContain('Access denied');
    });
  });
});
