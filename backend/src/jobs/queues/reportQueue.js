const { Queue } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, JOB_TYPES, DEFAULT_JOB_OPTIONS, createRedisConnection } = require('../config');

let reportQueueInstance = null;

const getReportQueue = () => {
  if (!reportQueueInstance) {
    reportQueueInstance = new Queue(QUEUE_NAMES.REPORT, {
      prefix: QUEUE_PREFIX,
      connection: createRedisConnection(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 2
      }
    });
  }
  return reportQueueInstance;
};

const enqueueReportGeneration = async (companyId, reportType, filters = {}, requestingUserId = null) => {
  const queue = getReportQueue();
  const timestamp = Date.now();
  const jobId = `report:${companyId}:${String(reportType).toLowerCase()}:${timestamp}`;

  const job = await queue.add(
    JOB_TYPES.REPORT_GENERATE,
    {
      companyId,
      reportType,
      filters,
      requestingUserId,
      enqueuedAt: new Date().toISOString()
    },
    {
      jobId,
      removeOnComplete: { count: 50, age: 86400 },
      removeOnFail: { count: 100, age: 7 * 86400 }
    }
  );

  return {
    jobId: job.id,
    queue: QUEUE_NAMES.REPORT,
    status: 'queued'
  };
};

module.exports = {
  getReportQueue,
  enqueueReportGeneration
};
