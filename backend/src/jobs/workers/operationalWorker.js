const { Worker } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, createRedisConnection } = require('../config');
const { processOperationalJob } = require('../processors/operationalProcessor');

const createOperationalWorker = (options = {}) => {
  const worker = new Worker(
    QUEUE_NAMES.OPERATIONAL,
    processOperationalJob,
    {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      concurrency: 2,
      ...options
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:Operational] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:Operational] Job ${job?.id} failed:`, err.message);
  });

  return worker;
};

module.exports = {
  createOperationalWorker
};
