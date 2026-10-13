const { QUEUE_NAMES } = require('../config');
const { getMaintenanceQueue, enqueueCompanyEvaluation, enqueueSystemEvaluation } = require('./maintenanceQueue');
const { getAlertQueue, enqueueAlertProcess } = require('./alertQueue');
const { getOperationalQueue, enqueueCleanup } = require('./operationalQueue');
const { getReportQueue, enqueueReportGeneration } = require('./reportQueue');

const getAllQueues = () => {
  return {
    [QUEUE_NAMES.MAINTENANCE]: getMaintenanceQueue(),
    [QUEUE_NAMES.ALERT]: getAlertQueue(),
    [QUEUE_NAMES.OPERATIONAL]: getOperationalQueue(),
    [QUEUE_NAMES.REPORT]: getReportQueue()
  };
};

const getQueueByName = (name) => {
  const queues = getAllQueues();
  return queues[name] || null;
};

const getQueueHealth = async () => {
  const queues = getAllQueues();
  const health = {};

  for (const [name, queue] of Object.entries(queues)) {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
      health[name] = {
        status: 'online',
        counts
      };
    } catch (error) {
      health[name] = {
        status: 'error',
        message: error.message
      };
    }
  }

  return health;
};

const closeAllQueues = async () => {
  const queues = getAllQueues();
  await Promise.all(Object.values(queues).map(q => q.close().catch(() => {})));
};

module.exports = {
  QUEUE_NAMES,
  getMaintenanceQueue,
  enqueueCompanyEvaluation,
  enqueueSystemEvaluation,
  getAlertQueue,
  enqueueAlertProcess,
  getOperationalQueue,
  enqueueCleanup,
  getReportQueue,
  enqueueReportGeneration,
  getAllQueues,
  getQueueByName,
  getQueueHealth,
  closeAllQueues
};
