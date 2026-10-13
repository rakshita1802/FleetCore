const auditService = require('../services/auditService');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, userId, startDate, endDate, page, limit } = req.query;
    const companyId = req.user.companyId;

    const result = await auditService.getAuditLogs(companyId, {
      action,
      entityType,
      userId,
      startDate,
      endDate,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};
