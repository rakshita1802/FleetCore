const Redis = require('ioredis');

const QUEUE_NAMES = {
  MAINTENANCE: 'maintenance',
  ALERT: 'alert',
  OPERATIONAL: 'operational',
  REPORT: 'report'
};

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || 'fleetcore:queue';

const JOB_TYPES = {
  MAINTENANCE_EVALUATE_COMPANY: 'maintenance:evaluate:company',
  MAINTENANCE_EVALUATE_ALL: 'maintenance:evaluate:all',
  ALERT_PROCESS: 'alert:process',
  ALERT_ESCALATE: 'alert:escalate',
  ALERT_NOTIFY: 'alert:notify',
  REPORT_GENERATE: 'report:generate',
  OPERATIONAL_CLEANUP: 'operational:cleanup',
  OPERATIONAL_CLEANUP_REPORTS: 'operational:cleanup:reports'
};

const DEFAULT_JOB_OPTIONS = {
  attempts: parseInt(process.env.JOB_ATTEMPTS || '3', 10),
  backoff: {
    type: 'exponential',
    delay: parseInt(process.env.JOB_BACKOFF_MS || '5000', 10)
  },
  removeOnComplete: {
    count: 100,
    age: 86400 // Keep for 24h
  },
  removeOnFail: {
    count: 500,
    age: 7 * 86400 // Keep for 7 days
  }
};

const createRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 100, 3000);
    }
  });
};

module.exports = {
  QUEUE_NAMES,
  QUEUE_PREFIX,
  JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
  createRedisConnection
};
