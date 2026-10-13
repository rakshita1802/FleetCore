const request = require('supertest');
const app = require('../src/app');
const { normalizePath, getApiMetrics } = require('../src/middleware/requestMetrics');

jest.mock('@prisma/client', () => {
  const mPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }])
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

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

describe('Phase 10: Observability, Probes & Request Metrics', () => {
  describe('Health & Lifecycle Probes', () => {
    it('returns basic health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
    });

    it('returns 200 on liveness probe (/api/health/live)', async () => {
      const res = await request(app).get('/api/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(res.body.uptime).toBeDefined();
      expect(res.body.pid).toBeDefined();
    });

    it('returns 200 on readiness probe (/api/health/ready)', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe(true);
      expect(res.body.checks.redis).toBe(true);
    });

    it('returns detailed job queue health (/api/health/jobs)', async () => {
      const res = await request(app).get('/api/health/jobs');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('bullmq');
      expect(res.body.queues.maintenance).toBeDefined();
    });
  });

  describe('Request ID Tracing Header', () => {
    it('attaches a unique X-Request-ID if none is provided', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('preserves valid client-provided X-Request-ID', async () => {
      const customId = 'client-req-9988-safe';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-ID', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });
  });

  describe('Low-Cardinality Route Path Normalization & Metrics', () => {
    it('normalizes UUIDs and entity IDs to :id in metrics path', () => {
      expect(normalizePath('/api/vehicles/550e8400-e29b-41d4-a716-446655440000')).toBe('/api/vehicles/:id');
      expect(normalizePath('/api/trips/trip-12345/start')).toBe('/api/trips/:id/start');
      expect(normalizePath('/api/alerts/alt-999')).toBe('/api/alerts/:id');
      expect(normalizePath('/api/jobs/maintenance/job-123')).toBe('/api/jobs/maintenance/:id');
    });

    it('collects in-memory API metrics accurately', async () => {
      await request(app).get('/api/health');
      const metrics = getApiMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.statusCodes['2xx']).toBeGreaterThan(0);
    });
  });
});
