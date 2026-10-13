const { Queue } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, JOB_TYPES, DEFAULT_JOB_OPTIONS, createRedisConnection } = require('../config');

let maintenanceQueue = null;

const getMaintenanceQueue = () => {
  if (!maintenanceQueue) {
    maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });
  }
  return maintenanceQueue;
};

/**
 * Enqueue a company-scoped maintenance evaluation job.
 * Deterministic jobId prevents duplicate runs within the same evaluation window.
 */
const enqueueCompanyEvaluation = async (companyId, options = {}) => {
  const queue = getMaintenanceQueue();
  const timeWindow = Math.floor(Date.now() / (15 * 60 * 1000)); // 15-minute bucket
  const deterministicJobId = `maint-eval:${companyId}:${timeWindow}`;

  return queue.add(
    JOB_TYPES.MAINTENANCE_EVALUATE_COMPANY,
    { companyId },
    {
      jobId: options.jobId || deterministicJobId,
      priority: 2, // High priority for manual or direct evaluation
      ...options
    }
  );
};

/**
 * Enqueue a system-wide maintenance evaluation fanout job.
 */
const enqueueSystemEvaluation = async (options = {}) => {
  const queue = getMaintenanceQueue();
  const timeWindow = Math.floor(Date.now() / (15 * 60 * 1000));
  const deterministicJobId = `maint-eval-system:${timeWindow}`;

  return queue.add(
    JOB_TYPES.MAINTENANCE_EVALUATE_ALL,
    {},
    {
      jobId: options.jobId || deterministicJobId,
      priority: 3,
      ...options
    }
  );
};

module.exports = {
  getMaintenanceQueue,
  enqueueCompanyEvaluation,
  enqueueSystemEvaluation
};
