const { getAllQueues } = require('../queues');

const processOperationalJob = async (job) => {
  const startTime = Date.now();
  const { name, id: jobId } = job;

  console.log(`[Job:${jobId}] Started ${name}`);

  try {
    const queues = getAllQueues();
    const cleanResults = {};

    for (const [queueName, queue] of Object.entries(queues)) {
      try {
        // Clean completed jobs older than 24 hours (keep recent 100)
        const completedCleaned = await queue.clean(24 * 3600 * 1000, 100, 'completed');
        // Clean failed jobs older than 7 days (keep recent 500)
        const failedCleaned = await queue.clean(7 * 24 * 3600 * 1000, 500, 'failed');

        cleanResults[queueName] = {
          completedCleanedCount: Array.isArray(completedCleaned) ? completedCleaned.length : 0,
          failedCleanedCount: Array.isArray(failedCleaned) ? failedCleaned.length : 0
        };
      } catch (err) {
        cleanResults[queueName] = { error: err.message };
      }
    }

    // Clean up expired temp report files (> 24h old)
    try {
      const reportService = require('../../services/reportService');
      const reportFileClean = await reportService.cleanupExpiredReports(24);
      cleanResults.reports = reportFileClean;
    } catch (err) {
      cleanResults.reports = { error: err.message };
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Job:${jobId}] Operational cleanup finished in ${durationMs}ms`, cleanResults);

    return {
      success: true,
      durationMs,
      cleanResults
    };
  } catch (error) {
    console.error(`[Job:${jobId}] Operational cleanup failed:`, error.message);
    throw error;
  }
};

module.exports = {
  processOperationalJob
};
