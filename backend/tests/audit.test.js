const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../src/services/auditService');

jest.mock('@prisma/client', () => {
  const mockLogs = [
    {
      id: 'audit-1',
      companyId: 'comp-1',
      userId: 'usr-admin-1',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 'usr-new-1',
      metadata: { email: 'new@comp1.com', role: 'DRIVER' },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest/29.0',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      user: { id: 'usr-admin-1', name: 'Admin', email: 'admin@comp1.com', role: 'ADMIN' }
    },
    {
      id: 'audit-2',
      companyId: 'comp-1',
      userId: 'usr-admin-1',
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: 'usr-new-1',
      metadata: { oldRole: 'DRIVER', newRole: 'FLEET_MANAGER' },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest/29.0',
      createdAt: new Date('2026-03-01T11:00:00Z'),
      user: { id: 'usr-admin-1', name: 'Admin', email: 'admin@comp1.com', role: 'ADMIN' }
    },
    {
      id: 'audit-3',
      companyId: 'comp-2',
      userId: 'usr-other-1',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 'usr-other-2',
      metadata: { email: 'other@comp2.com' },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest/29.0',
      createdAt: new Date('2026-03-01T12:00:00Z'),
      user: { id: 'usr-other-1', name: 'Other Admin', email: 'admin@comp2.com', role: 'ADMIN' }
    }
  ];

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
    auditLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        const entry = { id: `audit-${Date.now()}`, ...data, createdAt: new Date() };
        mockLogs.push(entry);
        return Promise.resolve(entry);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockLogs.filter(l => !where.companyId || l.companyId === where.companyId));
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockLogs.filter(l => !where.companyId || l.companyId === where.companyId).length);
      })
    }
  };

  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('Phase 10: Audit Logging & Tenant Isolation', () => {
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

  describe('Append-Only Audit Logging', () => {
    it('creates an audit log entry with sanitized metadata', async () => {
      const entry = await logAudit({
        companyId: 'comp-1',
        userId: 'usr-admin-1',
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: 'usr-test-123',
        metadata: {
          email: 'test@comp1.com',
          password: 'super-secret-password',
          token: 'jwt-access-token-string'
        }
      });

      expect(entry).toBeDefined();
      expect(entry.metadata.password).toBe('[REDACTED]');
      expect(entry.metadata.token).toBe('[REDACTED]');
      expect(entry.metadata.email).toBe('test@comp1.com');
    });
  });

  describe('Audit Log Querying & RBAC', () => {
    it('allows ADMIN to query company audit logs', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      // Tenant isolation: only company 1 logs returned
      expect(res.body.data.every(l => l.companyId === 'comp-1')).toBe(true);
    });

    it('denies VIEWER from querying audit logs', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
