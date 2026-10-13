const { Worker } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, createRedisConnection } = require('../config');
const { processAlertJob } = require('../processors/alertProcessor');

const createAlertWorker = (options = {}) => {
  const concurrency = parseInt(process.env.ALERT_WORKER_CONCURRENCY || '5', 10);

  const worker = new Worker(
    QUEUE_NAMES.ALERT,
    processAlertJob,
    {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      concurrency,
      ...options
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:Alert] Job ${job.id} (${job.name}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:Alert] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  return worker;
};

module.exports = {
  createAlertWorker
};
