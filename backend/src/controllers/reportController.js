const reportService = require('../services/reportService');
const { reportQuerySchema, reportExportBodySchema } = require('../validators/reportValidators');
const { enqueueReportGeneration, getReportQueue } = require('../jobs/queues');
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../services/auditService');

const VALID_REPORT_TYPES = ['FLEET_UTILIZATION', 'TRIPS', 'MAINTENANCE', 'ALERTS'];

/**
 * Preview report data (paginated).
 */
exports.getReportPreview = async (req, res, next) => {
  try {
    const reportType = String(req.params.type).toUpperCase();
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Supported types: ${VALID_REPORT_TYPES.join(', ')}`
      });
    }

    const validatedQuery = reportQuerySchema.parse(req.query);
    const result = await reportService.generateReportPreview(
      req.user.companyId,
      reportType,
      validatedQuery,
      { page: validatedQuery.page, limit: validatedQuery.limit }
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      reportType: result.reportType
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

/**
 * Synchronous direct CSV export for smaller reports.
 */
exports.exportReportSync = async (req, res, next) => {
  try {
    const reportType = String(req.params.type).toUpperCase();
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Supported types: ${VALID_REPORT_TYPES.join(', ')}`
      });
    }

    const validatedQuery = reportQuerySchema.parse(req.query);
    const rows = await reportService.generateAllReportRows(req.user.companyId, reportType, validatedQuery);
    const csvContent = reportService.formatReportToCSV(reportType, rows);

    const fileName = `fleetcore_${reportType.toLowerCase()}_${Date.now()}.csv`;

    await logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: AUDIT_ACTIONS.REPORT_EXPORTED,
      entityType: AUDIT_ENTITY_TYPES.REPORT,
      metadata: {
        reportType,
        rowCount: rows.length,
        mode: 'sync'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send('\uFEFF' + csvContent);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

/**
 * Asynchronous CSV export enqueued to BullMQ.
 */
exports.exportReportAsync = async (req, res, next) => {
  try {
    const reportType = String(req.params.type || req.body.reportType).toUpperCase();
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Supported types: ${VALID_REPORT_TYPES.join(', ')}`
      });
    }

    const filters = req.body.filters || req.query || {};
    const validatedFilters = reportQuerySchema.parse(filters);

    const jobInfo = await enqueueReportGeneration(
      req.user.companyId,
      reportType,
      validatedFilters,
      req.user.id
    );

    res.status(202).json({
      success: true,
      message: 'Report generation queued',
      data: {
        jobId: jobInfo.jobId,
        status: jobInfo.status,
        queue: jobInfo.queue
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues || error.errors
      });
    }
    next(error);
  }
};

/**
 * Check async report job status.
 */
exports.getReportJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const queue = getReportQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Report job not found'
      });
    }

    // Tenant Isolation Check
    if (job.data && job.data.companyId && job.data.companyId !== req.user.companyId) {
      return res.status(404).json({
        success: false,
        message: 'Report job not found'
      });
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const failedReason = job.failedReason || null;
    const returnvalue = job.returnvalue || null;

    res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        state,
        progress,
        failedReason,
        result: returnvalue,
        downloadUrl: returnvalue ? returnvalue.downloadUrl : null,
        createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Secure file download endpoint.
 */
exports.downloadReportFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const fileInfo = reportService.getSecureReportFilePath(req.user.companyId, fileId);

    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found or expired'
      });
    }

    res.download(fileInfo.filePath, fileInfo.fileName, (err) => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};
