const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { formatReportToCSV, escapeCSVCell } = require('../src/services/reportService');

jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'usr-admin-1') {
          return Promise.resolve({
            id: 'usr-admin-1',
            companyId: 'comp-1',
            name: 'Admin',
            email: 'admin@comp1.com',
            role: 'ADMIN',
            status: 'ACTIVE',
            company: { id: 'comp-1', name: 'Company 1' }
          });
        }
        if (where.id === 'usr-manager-1') {
          return Promise.resolve({
            id: 'usr-manager-1',
            companyId: 'comp-1',
            name: 'Manager',
            email: 'manager@comp1.com',
            role: 'FLEET_MANAGER',
            status: 'ACTIVE',
            company: { id: 'comp-1', name: 'Company 1' }
          });
        }
        if (where.id === 'usr-viewer-1') {
          return Promise.resolve({
            id: 'usr-viewer-1',
            companyId: 'comp-1',
            name: 'Viewer',
            email: 'viewer@comp1.com',
            role: 'VIEWER',
            status: 'ACTIVE',
            company: { id: 'comp-1', name: 'Company 1' }
          });
        }
        return Promise.resolve(null);
      })
    },
    vehicle: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'veh-1',
          registrationNumber: 'KA-01-AB-1234',
          make: 'Volvo',
          model: 'XC90',
          year: 2023,
          vehicleType: 'TRUCK',
          fuelType: 'DIESEL',
          status: 'ACTIVE',
          odometer: 12500.5,
          trips: [
            { id: 'trip-1', status: 'COMPLETED', distanceKm: 150.2 },
            { id: 'trip-2', status: 'COMPLETED', distanceKm: 85.0 }
          ]
        },
        {
          id: 'veh-2',
          registrationNumber: 'KA-02-CD-5678',
          make: 'Toyota',
          model: 'Hilux',
          year: 2022,
          vehicleType: 'VAN',
          fuelType: 'DIESEL',
          status: 'ACTIVE',
          odometer: 45200.0,
          trips: []
        }
      ])
    },
    trip: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'trip-1',
          tripNumber: 'TRIP-1001',
          originName: 'Warehouse A',
          destinationName: 'Distribution Hub B',
          scheduledStartAt: new Date('2026-03-01T08:00:00Z'),
          scheduledEndAt: new Date('2026-03-01T12:00:00Z'),
          actualStartAt: new Date('2026-03-01T08:05:00Z'),
          actualEndAt: new Date('2026-03-01T11:50:00Z'),
          distanceKm: 150.2,
          status: 'COMPLETED',
          vehicle: { registrationNumber: 'KA-01-AB-1234', make: 'Volvo', model: 'XC90' },
          driver: { name: 'John Doe', employeeCode: 'EMP-01' }
        }
      ])
    },
    maintenanceRecord: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'rec-1',
          serviceType: 'OIL_CHANGE',
          description: 'Regular 10k synthetic oil replacement',
          status: 'COMPLETED',
          startedAt: new Date('2026-02-15T09:00:00Z'),
          completedAt: new Date('2026-02-15T11:30:00Z'),
          odometerAtService: 12000,
          cost: 150.00,
          vendor: 'FleetCare Services',
          notes: 'Standard service',
          createdAt: new Date('2026-02-15T09:00:00Z'),
          vehicle: { registrationNumber: 'KA-01-AB-1234', make: 'Volvo', model: 'XC90' },
          schedule: { name: '10K Engine Service' }
        }
      ])
    },
    alert: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'alt-1',
          type: 'MAINTENANCE_DUE',
          severity: 'WARNING',
          title: 'Oil Change Due',
          message: 'Vehicle KA-01-AB-1234 is due for oil change',
          status: 'OPEN',
          createdAt: new Date('2026-03-01T10:00:00Z'),
          acknowledgedAt: null,
          acknowledgedBy: null,
          resolvedAt: null,
          resolvedBy: null,
          vehicle: { registrationNumber: 'KA-01-AB-1234' }
        }
      ])
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' })
    }
  };

  return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../src/jobs/queues', () => {
  return {
    getReportQueue: jest.fn(() => ({
      getJob: jest.fn().mockImplementation((jobId) => {
        if (jobId === 'job-report-1') {
          return Promise.resolve({
            id: 'job-report-1',
            data: { companyId: 'comp-1', reportType: 'FLEET_UTILIZATION' },
            getState: jest.fn().mockResolvedValue('completed'),
            progress: 100,
            returnvalue: {
              fileId: 'file-abc-123',
              downloadUrl: '/api/reports/download/file-abc-123',
              rowCount: 2,
              reportType: 'FLEET_UTILIZATION'
            }
          });
        }
        return Promise.resolve(null);
      })
    })),
    enqueueReportGeneration: jest.fn().mockResolvedValue({
      jobId: 'job-report-1',
      queue: 'report',
      status: 'queued'
    }),
    getQueueHealth: jest.fn().mockResolvedValue({
      report: { status: 'online', counts: { waiting: 0, active: 0, completed: 1, failed: 0 } }
    })
  };
});

describe('Phase 10: Reporting Subsystem', () => {
  const adminToken = generateAccessToken({
    id: 'usr-admin-1',
    companyId: 'comp-1',
    email: 'admin@comp1.com',
    role: 'ADMIN'
  });

  const viewerToken = generateAccessToken({
    id: 'usr-viewer-1',
    companyId: 'comp-1',
    email: 'viewer@comp1.com',
    role: 'VIEWER'
  });

  describe('CSV Injection Protection & Formatting', () => {
    it('escapes dangerous formula trigger characters (=, +, -, @, tab, cr)', () => {
      expect(escapeCSVCell('=1+1')).toBe("'=1+1");
      expect(escapeCSVCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(escapeCSVCell('+cmd|')).toBe("'+cmd|");
      expect(escapeCSVCell('-25.4')).toBe('-25.4'); // Standard numbers remain unescaped
      expect(escapeCSVCell('Hello, World')).toBe('"Hello, World"');
      expect(escapeCSVCell('He said "Hello"')).toBe('"He said ""Hello"""');
    });

    it('formats tabular rows into standard CSV with header line', () => {
      const rows = [
        { vehicle: 'KA-01', trips: 10, distance: 500 },
        { vehicle: 'KA-02', trips: 5, distance: 250 }
      ];
      const csv = formatReportToCSV('FLEET_UTILIZATION', rows);
      expect(csv).toContain('vehicle,trips,distance');
      expect(csv).toContain('KA-01,10,500');
      expect(csv).toContain('KA-02,5,250');
    });
  });

  describe('Report Preview Queries & Date Range Limits', () => {
    it('previews Fleet Utilization report', async () => {
      const res = await request(app)
        .get('/api/reports/FLEET_UTILIZATION')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].registrationNumber).toBe('KA-01-AB-1234');
      expect(res.body.data[0].tripCount).toBe(2);
    });

    it('previews Trips report', async () => {
      const res = await request(app)
        .get('/api/reports/TRIPS')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].tripNumber).toBe('TRIP-1001');
    });

    it('rejects date range where start date is after end date', async () => {
      const res = await request(app)
        .get('/api/reports/TRIPS?startDate=2026-10-01T00:00:00Z&endDate=2026-01-01T00:00:00Z')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects date range exceeding 365 days', async () => {
      const res = await request(app)
        .get('/api/reports/TRIPS?startDate=2024-01-01T00:00:00Z&endDate=2026-01-01T00:00:00Z')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Synchronous CSV Export', () => {
    it('returns CSV file attachment for direct export', async () => {
      const res = await request(app)
        .get('/api/reports/FLEET_UTILIZATION/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="fleetcore_fleet_utilization_/);
      expect(res.text).toContain('registrationNumber');
      expect(res.text).toContain('KA-01-AB-1234');
    });

    it('denies VIEWER role from exporting reports directly', async () => {
      const res = await request(app)
        .get('/api/reports/FLEET_UTILIZATION/export')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Asynchronous Large Report Export via BullMQ', () => {
    it('enqueues background report generation job and returns 202 Accepted', async () => {
      const res = await request(app)
        .post('/api/reports/FLEET_UTILIZATION/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filters: {
            startDate: '2026-01-01T00:00:00Z',
            endDate: '2026-03-01T00:00:00Z'
          }
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('job-report-1');
      expect(res.body.data.status).toBe('queued');
    });

    it('queries background report job status and download URL', async () => {
      const res = await request(app)
        .get('/api/reports/jobs/job-report-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.state).toBe('completed');
      expect(res.body.data.downloadUrl).toBe('/api/reports/download/file-abc-123');
    });
  });
});
