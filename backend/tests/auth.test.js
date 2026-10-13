const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    company: {
      create: jest.fn(),
    },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => {
      // Mock transaction context
      return cb(mPrismaClient);
    }),
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

describe('Auth API & RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and company successfully', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.company.create.mockResolvedValueOnce({ id: 'comp-1', name: 'Test Corp' });
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-1',
        name: 'John',
        email: 'john@test.com',
        role: 'ADMIN',
        companyId: 'comp-1'
      });
      prisma.refreshSession.create.mockResolvedValueOnce({});

      const res = await request(app).post('/api/auth/register').send({
        name: 'John',
        email: 'john@test.com',
        password: 'password123',
        companyName: 'Test Corp'
      });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('RBAC & Multi-tenancy', () => {
    it('should grant access to ADMIN on protected route and expose companyId context', async () => {
      const token = jwt.sign({ sub: 'user-1', role: 'ADMIN', companyId: 'comp-1' }, 'fallback_access_secret');
      
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        name: 'John',
        email: 'john@test.com',
        role: 'ADMIN',
        companyId: 'comp-1',
        company: { id: 'comp-1', name: 'Test Corp' }
      });

      const res = await request(app)
        .get('/api/auth/test-rbac')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.companyId).toBe('comp-1');
    });

    it('should deny access to VIEWER on ADMIN-only route', async () => {
      const token = jwt.sign({ sub: 'user-2', role: 'VIEWER', companyId: 'comp-1' }, 'fallback_access_secret');
      
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-2',
        name: 'Jane',
        email: 'jane@test.com',
        role: 'VIEWER',
        companyId: 'comp-1',
        company: { id: 'comp-1', name: 'Test Corp' }
      });

      const res = await request(app)
        .get('/api/auth/test-rbac')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient permissions');
    });
  });
});
