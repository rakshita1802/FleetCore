const { getQueueByName, QUEUE_NAMES } = require('../jobs/queues');

const getJobStatus = async (req, res, next) => {
  try {
    const { queue: queueName, jobId } = req.params;

    const allowedQueues = Object.values(QUEUE_NAMES);
    if (!allowedQueues.includes(queueName)) {
      return res.status(400).json({
        success: false,
        message: `Invalid queue name. Allowed queues: ${allowedQueues.join(', ')}`
      });
    }

    const queue = getQueueByName(queueName);
    if (!queue) {
      return res.status(503).json({ success: false, message: "Queue unavailable" });
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Tenant Isolation Check
    if (job.data?.companyId && job.data.companyId !== req.user.companyId) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const state = await job.getState();

    res.json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        queue: queueName,
        state,
        progress: job.progress,
        returnvalue: job.returnvalue || null,
        failedReason: job.failedReason || null,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn || null,
        finishedOn: job.finishedOn || null
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobStatus
};
