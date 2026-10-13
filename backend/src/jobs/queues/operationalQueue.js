const { Queue } = require('bullmq');
const { QUEUE_NAMES, QUEUE_PREFIX, JOB_TYPES, DEFAULT_JOB_OPTIONS, createRedisConnection } = require('../config');

let operationalQueue = null;

const getOperationalQueue = () => {
  if (!operationalQueue) {
    operationalQueue = new Queue(QUEUE_NAMES.OPERATIONAL, {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });
  }
  return operationalQueue;
};

const enqueueCleanup = async (options = {}) => {
  const queue = getOperationalQueue();
  return queue.add(
    JOB_TYPES.OPERATIONAL_CLEANUP,
    {},
    {
      priority: 4, // Low priority
      ...options
    }
  );
};

module.exports = {
  getOperationalQueue,
  enqueueCleanup
};
