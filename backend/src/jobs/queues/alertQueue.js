const { Queue } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, JOB_TYPES, DEFAULT_JOB_OPTIONS, createRedisConnection } = require('../config');

let alertQueue = null;

const getAlertQueue = () => {
  if (!alertQueue) {
    alertQueue = new Queue(QUEUE_NAMES.ALERT, {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });
  }
  return alertQueue;
};

const enqueueAlertProcess = async (companyId, alertId, options = {}) => {
  const queue = getAlertQueue();
  return queue.add(
    JOB_TYPES.ALERT_PROCESS,
    { companyId, alertId },
    {
      priority: 1, // Critical priority
      ...options
    }
  );
};

module.exports = {
  getAlertQueue,
  enqueueAlertProcess
};
