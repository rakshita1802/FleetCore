const { JOB_TYPES } = require('../config');
const reportService = require('../../services/reportService');
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../../services/auditService');
const logger = require('../../utils/logger');

const processReportJob = async (job) => {
  const startTime = Date.now();
  const { companyId, reportType, filters = {}, requestingUserId } = job.data;

  logger.info(`[Job:${job.id}] Started ${job.name} (Attempt ${job.attemptsMade + 1})`, {
    jobId: job.id,
    companyId,
    reportType
  });

  if (job.name === JOB_TYPES.REPORT_GENERATE) {
    if (!companyId || !reportType) {
      throw new Error(`Invalid report job payload: companyId and reportType are required.`);
    }

    // 1. Fetch all rows for the report with tenant isolation strictly enforced
    const rows = await reportService.generateAllReportRows(companyId, reportType, filters);

    // 2. Format to CSV
    const csvContent = reportService.formatReportToCSV(reportType, rows);

    // 3. Write to temporary secure file
    const fileMeta = await reportService.writeReportFile(companyId, reportType, csvContent);

    const duration = Date.now() - startTime;
    logger.info(`[Job:${job.id}] Generated ${reportType} report with ${rows.length} rows in ${duration}ms`, {
      jobId: job.id,
      companyId,
      fileId: fileMeta.fileId
    });

    // 4. Log audit for report generation
    await logAudit({
      companyId,
      userId: requestingUserId,
      action: AUDIT_ACTIONS.REPORT_EXPORTED,
      entityType: AUDIT_ENTITY_TYPES.REPORT,
      entityId: fileMeta.fileId,
      metadata: {
        reportType,
        rowCount: rows.length,
        durationMs: duration
      }
    });

    return {
      fileId: fileMeta.fileId,
      fileName: fileMeta.fileName,
      rowCount: rows.length,
      reportType,
      durationMs: duration,
      downloadUrl: `/api/reports/download/${fileMeta.fileId}`,
      completedAt: new Date().toISOString()
    };
  }

  throw new Error(`Unknown job type in report processor: ${job.name}`);
};

module.exports = {
  processReportJob
};
