const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { JOB_TYPES } = require('../config');
const alertService = require('../../services/alertService');

const processMaintenanceJob = async (job) => {
  const startTime = Date.now();
  const { name, data, id: jobId, attemptsMade } = job;

  console.log(`[Job:${jobId}] Started ${name} (Attempt ${attemptsMade + 1})`, { data });

  try {
    if (name === JOB_TYPES.MAINTENANCE_EVALUATE_COMPANY || (data && data.companyId)) {
      const companyId = data.companyId;
      if (!companyId) throw new Error("Missing companyId in job payload");

      // Verify company exists
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        console.warn(`[Job:${jobId}] Company ${companyId} not found, skipping evaluation.`);
        return { skipped: true, reason: "Company not found" };
      }

      // Execute deterministic Phase 8 evaluation service
      const result = await alertService.evaluateAndGenerateAlerts(companyId);
      const durationMs = Date.now() - startTime;

      console.log(`[Job:${jobId}] Completed ${name} for company ${companyId} in ${durationMs}ms`, result);

      return {
        success: true,
        companyId,
        durationMs,
        ...result
      };
    }

    if (name === JOB_TYPES.MAINTENANCE_EVALUATE_ALL) {
      // Fanout: Find all active companies
      const companies = await prisma.company.findMany({ select: { id: true, name: true } });
      const { enqueueCompanyEvaluation } = require('../queues/maintenanceQueue');

      const enqueued = [];
      for (const comp of companies) {
        const enqueuedJob = await enqueueCompanyEvaluation(comp.id);
        enqueued.push({ companyId: comp.id, jobId: enqueuedJob?.id });
      }

      const durationMs = Date.now() - startTime;
      console.log(`[Job:${jobId}] Fanout completed for ${companies.length} companies in ${durationMs}ms`);

      return {
        success: true,
        enqueuedCompaniesCount: companies.length,
        durationMs,
        enqueued
      };
    }

    throw new Error(`Unknown maintenance job type: ${name}`);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[Job:${jobId}] Failed ${name} after ${durationMs}ms:`, error.message);
    throw error;
  }
};

module.exports = {
  processMaintenanceJob
};
