const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');

jest.mock('../src/services/redisService', () => ({
  checkHealth: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/jobs/queues', () => ({
  getQueueHealth: jest.fn().mockResolvedValue({
    maintenance: { status: 'online', counts: { waiting: 0, active: 0, completed: 5, failed: 0 } },
    alert: { status: 'online', counts: { waiting: 0, active: 0, completed: 2, failed: 0 } },
    operational: { status: 'online', counts: { waiting: 0, active: 0, completed: 1, failed: 0 } },
    report: { status: 'online', counts: { waiting: 0, active: 0, completed: 0, failed: 0 } }
  })
}));

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockUsers = [
    {
      id: 'usr-admin-1',
      companyId: 'comp-1',
      name: 'Primary Admin',
      email: 'admin1@comp1.com',
      passwordHash: '$2a$10$hashedpw',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      company: { id: 'comp-1', name: 'Company 1' }
    },
    {
      id: 'usr-admin-2',
      companyId: 'comp-1',
      name: 'Secondary Admin',
      email: 'admin2@comp1.com',
      passwordHash: '$2a$10$hashedpw',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      company: { id: 'comp-1', name: 'Company 1' }
    },
    {
      id: 'usr-manager-1',
      companyId: 'comp-1',
      name: 'Fleet Manager',
      email: 'manager@comp1.com',
      passwordHash: '$2a$10$hashedpw',
      role: 'FLEET_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-03T00:00:00Z'),
      updatedAt: new Date('2026-01-03T00:00:00Z'),
      company: { id: 'comp-1', name: 'Company 1' }
    },
    {
      id: 'usr-viewer-1',
      companyId: 'comp-1',
      name: 'Viewer User',
      email: 'viewer@comp1.com',
      passwordHash: '$2a$10$hashedpw',
      role: 'VIEWER',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-04T00:00:00Z'),
      updatedAt: new Date('2026-01-04T00:00:00Z'),
      company: { id: 'comp-1', name: 'Company 1' }
    },
    {
      id: 'usr-other-1',
      companyId: 'comp-2',
      name: 'Other Company Admin',
      email: 'admin@comp2.com',
      passwordHash: '$2a$10$hashedpw',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
      company: { id: 'comp-2', name: 'Company 2' }
    }
  ];

  const mPrisma = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(mockUsers.find(u => u.id === where.id) || null);
        if (where.email) return Promise.resolve(mockUsers.find(u => u.email === where.email) || null);
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockUsers.find(u => {
          let match = true;
          if (where.id && u.id !== where.id) match = false;
          if (where.companyId && u.companyId !== where.companyId) match = false;
          if (where.email && u.email !== where.email) match = false;
          return match;
        }) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockUsers.filter(u => !where.companyId || u.companyId === where.companyId));
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        const filtered = mockUsers.filter(u => {
          if (where.companyId && u.companyId !== where.companyId) return false;
          if (where.role && u.role !== where.role) return false;
          if (where.status && u.status !== where.status) return false;
          return true;
        });
        return Promise.resolve(filtered.length);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const created = { id: `usr-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        mockUsers.push(created);
        return Promise.resolve(created);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockUsers.findIndex(u => u.id === where.id);
        if (idx !== -1) {
          mockUsers[idx] = { ...mockUsers[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockUsers[idx]);
        }
        return Promise.resolve(null);
      }),
      groupBy: jest.fn().mockResolvedValue([
        { role: 'ADMIN', status: 'ACTIVE', _count: { id: 2 } },
        { role: 'FLEET_MANAGER', status: 'ACTIVE', _count: { id: 1 } },
        { role: 'VIEWER', status: 'ACTIVE', _count: { id: 1 } }
      ])
    },
    refreshSession: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    driver: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'ACTIVE', _count: { id: 5 } }
      ])
    },
    vehicle: {
      groupBy: jest.fn().mockResolvedValue([
        { status: 'ACTIVE', _count: { id: 10 } },
        { status: 'MAINTENANCE', _count: { id: 2 } }
      ])
    },
    trip: {
      count: jest.fn().mockResolvedValue(3)
    },
    maintenanceSchedule: {
      count: jest.fn().mockResolvedValue(2)
    },
    alert: {
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([
        { severity: 'CRITICAL', _count: { id: 1 } }
      ])
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    $transaction: jest.fn().mockImplementation((cb) => {
      if (typeof cb === 'function') return cb(mPrisma);
      return Promise.all(cb);
    }),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }])
  };

  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('Phase 10: Admin Operations & User Management', () => {
  const adminUser = {
    id: 'usr-admin-1',
    companyId: 'comp-1',
    email: 'admin1@comp1.com',
    role: 'ADMIN'
  };

  const managerUser = {
    id: 'usr-manager-1',
    companyId: 'comp-1',
    email: 'manager@comp1.com',
    role: 'FLEET_MANAGER'
  };

  const viewerUser = {
    id: 'usr-viewer-1',
    companyId: 'comp-1',
    email: 'viewer@comp1.com',
    role: 'VIEWER'
  };

  const otherAdminUser = {
    id: 'usr-other-1',
    companyId: 'comp-2',
    email: 'admin@comp2.com',
    role: 'ADMIN'
  };

  const adminToken = generateAccessToken(adminUser);
  const managerToken = generateAccessToken(managerUser);
  const viewerToken = generateAccessToken(viewerUser);
  const otherAdminToken = generateAccessToken(otherAdminUser);

  describe('RBAC & Access Control', () => {
    it('allows ADMIN to list company users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('denies FLEET_MANAGER from accessing user management', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies VIEWER from accessing user management', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('User Creation & Validation', () => {
    it('creates a new user within the company', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Driver User',
          email: 'newdriver@comp1.com',
          password: 'Password123!',
          role: 'DRIVER'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('newdriver@comp1.com');
      expect(res.body.data.role).toBe('DRIVER');
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('rejects invalid email or short password', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad User',
          email: 'not-an-email',
          password: '123',
          role: 'VIEWER'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Role Management & Protections', () => {
    it('allows ADMIN to change role of another user', async () => {
      const res = await request(app)
        .patch('/api/admin/users/usr-viewer-1/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'FLEET_MANAGER' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('FLEET_MANAGER');
    });

    it('prevents ADMIN from removing their own ADMIN role (Self-Protection)', async () => {
      const res = await request(app)
        .patch('/api/admin/users/usr-admin-1/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot remove their own/i);
    });

    it('prevents removing the last active ADMIN (Last-Admin Protection)', async () => {
      // Mock count returning 1 active admin
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      prisma.user.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .patch('/api/admin/users/usr-admin-2/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/last active administrator/i);
    });
  });

  describe('User Activation / Deactivation', () => {
    it('allows ADMIN to deactivate a non-admin user', async () => {
      const res = await request(app)
        .post('/api/admin/users/usr-viewer-1/deactivate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('INACTIVE');
    });

    it('prevents ADMIN from deactivating themselves (Self-Protection)', async () => {
      const res = await request(app)
        .post('/api/admin/users/usr-admin-1/deactivate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot deactivate their own account/i);
    });

    it('allows ADMIN to reactivate an inactive user', async () => {
      const res = await request(app)
        .post('/api/admin/users/usr-viewer-1/activate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Tenant Isolation', () => {
    it('prevents Company 2 admin from modifying Company 1 user', async () => {
      const res = await request(app)
        .patch('/api/admin/users/usr-viewer-1')
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin Overview & System Health', () => {
    it('provides aggregated operational overview for ADMIN', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.vehicles).toBeDefined();
      expect(res.body.data.drivers).toBeDefined();
      expect(res.body.data.operations).toBeDefined();
    });

    it('provides system health observability endpoint for ADMIN', async () => {
      const res = await request(app)
        .get('/api/admin/system')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.api).toBeDefined();
      expect(res.body.data.database).toBeDefined();
      expect(res.body.data.redis).toBeDefined();
      expect(res.body.data.process).toBeDefined();
    });
  });
});
