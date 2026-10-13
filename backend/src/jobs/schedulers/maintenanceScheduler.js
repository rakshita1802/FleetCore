const { getMaintenanceQueue } = require('../queues/maintenanceQueue');
const { getOperationalQueue } = require('../queues/operationalQueue');
const { JOB_TYPES } = require('../config');

const initSchedulers = async () => {
  const cronPattern = process.env.MAINTENANCE_EVALUATION_CRON || '*/15 * * * *';
  const maintenanceQueue = getMaintenanceQueue();
  const operationalQueue = getOperationalQueue();

  try {
    // 1. Register repeatable maintenance evaluation fanout job
    await maintenanceQueue.add(
      JOB_TYPES.MAINTENANCE_EVALUATE_ALL,
      {},
      {
        repeat: {
          pattern: cronPattern
        },
        jobId: 'scheduled:maintenance:evaluate:all'
      }
    );
    console.log(`[Scheduler] Maintenance evaluation registered with cron schedule: "${cronPattern}"`);

    // 2. Register repeatable daily operational cleanup job (every night at 2:00 AM)
    const cleanupCron = process.env.CLEANUP_CRON || '0 2 * * *';
    await operationalQueue.add(
      JOB_TYPES.OPERATIONAL_CLEANUP,
      {},
      {
        repeat: {
          pattern: cleanupCron
        },
        jobId: 'scheduled:operational:cleanup'
      }
    );
    console.log(`[Scheduler] Operational queue cleanup registered with cron schedule: "${cleanupCron}"`);
  } catch (error) {
    console.error('[Scheduler] Failed to initialize repeatable jobs:', error.message);
  }
};

module.exports = {
  initSchedulers
};
