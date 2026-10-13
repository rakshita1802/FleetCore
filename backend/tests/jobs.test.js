const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Mock BullMQ
jest.mock('bullmq', () => {
  const mockJobs = new Map();

  class MockQueue {
    constructor(name, opts) {
      this.name = name;
      this.opts = opts;
    }
    async add(name, data, opts = {}) {
      const jobId = opts.jobId || `job-${Date.now()}`;
      const job = {
        id: jobId,
        name,
        data,
        opts,
        progress: 0,
        attemptsMade: 0,
        timestamp: Date.now(),
        getState: jest.fn().mockResolvedValue('waiting'),
        returnvalue: null,
        failedReason: null
      };
      mockJobs.set(`${this.name}:${jobId}`, job);
      return job;
    }
    async getJob(jobId) {
      return mockJobs.get(`${this.name}:${jobId}`) || null;
    }
    async getJobCounts() {
      return { waiting: 1, active: 0, completed: 5, failed: 0, delayed: 0, paused: 0 };
    }
    async clean() {
      return [1, 2];
    }
    async close() {
      return Promise.resolve();
    }
  }

  class MockWorker {
    constructor(name, processor, opts) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      this.handlers = {};
    }
    on(event, handler) {
      this.handlers[event] = handler;
    }
    async close() {
      return Promise.resolve();
    }
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker
  };
});

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    company: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    maintenanceSchedule: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    alert: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mPrismaClient)
  };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { enqueueCompanyEvaluation, enqueueSystemEvaluation } = require('../src/jobs/queues/maintenanceQueue');
const { getQueueHealth } = require('../src/jobs/queues');
const { processMaintenanceJob } = require('../src/jobs/processors/maintenanceProcessor');
const { processAlertJob } = require('../src/jobs/processors/alertProcessor');
const { processOperationalJob } = require('../src/jobs/processors/operationalProcessor');
const { JOB_TYPES, DEFAULT_JOB_OPTIONS } = require('../src/jobs/config');
const alertService = require('../src/services/alertService');

describe('Phase 9 - Background Jobs & Queue Automation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getAuthToken = (role = 'ADMIN', companyId = 'comp-a') => {
    return jwt.sign({ sub: 'user-1', role, companyId }, 'fallback_access_secret');
  };

  describe('Queue & Job Configuration', () => {
    it('Should have exponential backoff and controlled retry defaults', () => {
      expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThanOrEqual(3);
      expect(DEFAULT_JOB_OPTIONS.backoff.type).toBe('exponential');
      expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toBeDefined();
      expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBeDefined();
    });

    it('Should enqueue company-scoped evaluation with deterministic job ID', async () => {
      const job = await enqueueCompanyEvaluation('comp-a');
      expect(job).toBeDefined();
      expect(job.name).toBe(JOB_TYPES.MAINTENANCE_EVALUATE_COMPANY);
      expect(job.data.companyId).toBe('comp-a');
      expect(job.id).toContain('maint-eval:comp-a:');
    });

    it('Should enqueue system evaluation fanout job', async () => {
      const job = await enqueueSystemEvaluation();
      expect(job).toBeDefined();
      expect(job.name).toBe(JOB_TYPES.MAINTENANCE_EVALUATE_ALL);
    });
  });

  describe('HTTP API Endpoints', () => {
    it('POST /api/maintenance/evaluate should return 202 Accepted and enqueue job', async () => {
      const token = getAuthToken('FLEET_MANAGER', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'FLEET_MANAGER', companyId: 'comp-a' });

      const res = await request(app)
        .post('/api/maintenance/evaluate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(202);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('queued');
      expect(res.body.data.queue).toBe('maintenance');
      expect(res.body.data.jobId).toBeDefined();
    });

    it('GET /api/jobs/:queue/:jobId should return job state for company', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // Enqueue job for comp-a
      const enqueuedJob = await enqueueCompanyEvaluation('comp-a', { jobId: 'test-job-status-1' });

      const res = await request(app)
        .get(`/api/jobs/maintenance/${enqueuedJob.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(enqueuedJob.id);
      expect(res.body.data.state).toBe('waiting');
    });

    it('GET /api/jobs/:queue/:jobId should enforce tenant isolation and return 404 for cross-tenant job', async () => {
      const token = getAuthToken('ADMIN', 'comp-a');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', role: 'ADMIN', companyId: 'comp-a' });

      // Enqueue job for comp-b
      const enqueuedJob = await enqueueCompanyEvaluation('comp-b', { jobId: 'test-job-cross-tenant' });

      const res = await request(app)
        .get(`/api/jobs/maintenance/${enqueuedJob.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });

    it('GET /api/health/jobs should return queue status and counts', async () => {
      const res = await request(app).get('/api/health/jobs');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('bullmq');
      expect(res.body.queues.maintenance).toBeDefined();
      expect(res.body.queues.maintenance.counts.waiting).toBeDefined();
    });
  });

  describe('Worker Processors', () => {
    it('processMaintenanceJob should evaluate company maintenance idempotently', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-a', name: 'Company A' });
      
      const evalSpy = jest.spyOn(alertService, 'evaluateAndGenerateAlerts').mockResolvedValueOnce({
        evaluatedSchedulesCount: 10,
        alertsCreatedCount: 2,
        alertsResolvedCount: 0
      });

      const mockJob = {
        id: 'job-123',
        name: JOB_TYPES.MAINTENANCE_EVALUATE_COMPANY,
        data: { companyId: 'comp-a' },
        attemptsMade: 0
      };

      const result = await processMaintenanceJob(mockJob);

      expect(evalSpy).toHaveBeenCalledWith('comp-a');
      expect(result.success).toBe(true);
      expect(result.alertsCreatedCount).toBe(2);
      expect(result.companyId).toBe('comp-a');
    });

    it('processMaintenanceJob with MAINTENANCE_EVALUATE_ALL should fan out across active companies', async () => {
      prisma.company.findMany.mockResolvedValueOnce([
        { id: 'comp-1', name: 'Fleet Alpha' },
        { id: 'comp-2', name: 'Fleet Beta' }
      ]);

      const mockJob = {
        id: 'job-fanout',
        name: JOB_TYPES.MAINTENANCE_EVALUATE_ALL,
        data: {},
        attemptsMade: 0
      };

      const result = await processMaintenanceJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.enqueuedCompaniesCount).toBe(2);
      expect(result.enqueued.length).toBe(2);
    });

    it('processAlertJob should handle alert processing safely', async () => {
      prisma.alert.findUnique.mockResolvedValueOnce({
        id: 'alt-99',
        companyId: 'comp-a',
        type: 'MAINTENANCE_OVERDUE',
        severity: 'CRITICAL',
        status: 'OPEN'
      });

      const mockJob = {
        id: 'job-alert-1',
        name: JOB_TYPES.ALERT_PROCESS,
        data: { companyId: 'comp-a', alertId: 'alt-99' },
        attemptsMade: 0
      };

      const result = await processAlertJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.type).toBe('MAINTENANCE_OVERDUE');
      expect(result.severity).toBe('CRITICAL');
    });

    it('processOperationalJob should execute queue cleanup', async () => {
      const mockJob = {
        id: 'job-cleanup-1',
        name: JOB_TYPES.OPERATIONAL_CLEANUP,
        data: {},
        attemptsMade: 0
      };

      const result = await processOperationalJob(mockJob);
      expect(result.success).toBe(true);
      expect(result.cleanResults.maintenance).toBeDefined();
    });
  });
});
