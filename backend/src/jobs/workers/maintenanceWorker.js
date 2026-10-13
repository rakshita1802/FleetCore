const { Worker } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, createRedisConnection } = require('../config');
const { processMaintenanceJob } = require('../processors/maintenanceProcessor');

const createMaintenanceWorker = (options = {}) => {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

  const worker = new Worker(
    QUEUE_NAMES.MAINTENANCE,
    processMaintenanceJob,
    {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      concurrency,
      ...options
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:Maintenance] Job ${job.id} (${job.name}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:Maintenance] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:Maintenance] Worker error:`, err);
  });

  return worker;
};

module.exports = {
  createMaintenanceWorker
};
