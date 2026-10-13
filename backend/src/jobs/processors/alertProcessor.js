const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { JOB_TYPES } = require('../config');

const processAlertJob = async (job) => {
  const startTime = Date.now();
  const { name, data, id: jobId, attemptsMade } = job;

  console.log(`[Job:${jobId}] Started ${name} (Attempt ${attemptsMade + 1})`, { data });

  try {
    const { companyId, alertId } = data || {};

    if (alertId) {
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: { vehicle: true, maintenanceSchedule: true }
      });

      if (!alert) {
        console.warn(`[Job:${jobId}] Alert ${alertId} not found, skipping.`);
        return { skipped: true, reason: "Alert not found" };
      }

      // Socket.IO real-time notification
      try {
        const socket = require('../../socket');
        const driverUserId = null; // Future driver link if applicable
        if (alert.status === 'OPEN') {
          socket.emitAlertCreated(companyId, alert, driverUserId);
        } else if (alert.status === 'ACKNOWLEDGED') {
          socket.emitAlertAcknowledged(companyId, alert, driverUserId);
        } else if (alert.status === 'RESOLVED') {
          socket.emitAlertResolved(companyId, alert, driverUserId);
        }
      } catch (sockErr) {
        // Socket emission failure in worker is non-fatal
      }

      const durationMs = Date.now() - startTime;
      console.log(`[Job:${jobId}] Processed alert ${alertId} (${alert.type}/${alert.severity}) in ${durationMs}ms`);

      return {
        success: true,
        alertId,
        type: alert.type,
        severity: alert.severity,
        durationMs
      };
    }

    return { success: true, message: "No specific alert to process" };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[Job:${jobId}] Alert job failed after ${durationMs}ms:`, error.message);
    throw error;
  }
};

module.exports = {
  processAlertJob
};
