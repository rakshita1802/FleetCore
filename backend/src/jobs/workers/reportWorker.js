const { Worker } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, createRedisConnection } = require('../config');
const { processReportJob } = require('../processors/reportProcessor');
const logger = require('../../utils/logger');

const createReportWorker = (options = {}) => {
  const concurrency = parseInt(process.env.REPORT_WORKER_CONCURRENCY || '3', 10);

  const worker = new Worker(
    QUEUE_NAMES.REPORT,
    async (job) => {
      return await processReportJob(job);
    },
    {
      prefix: QUEUE_PREFIX,
      connection: createRedisConnection(),
      concurrency,
      ...options
    }
  );

  worker.on('completed', (job, result) => {
    logger.info(`[ReportWorker] Job ${job.id} completed successfully`, {
      jobId: job.id,
      reportType: result?.reportType,
      rowCount: result?.rowCount
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`[ReportWorker] Job ${job?.id} failed: ${err.message}`, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: err.stack
    });
  });

  return worker;
};

module.exports = {
  createReportWorker
};
