const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const requestId = req.id || req.headers['x-request-id'] || '-';

  // Structured error logging with request ID and method/route
  logger.error(err.message || 'Internal Server Error', {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  // Handle specific Zod validation errors if passed to next(err)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues || err.errors,
      requestId
    });
  }

  // Safe message formatting
  const message = (process.env.NODE_ENV === 'production' && statusCode === 500)
    ? 'Internal Server Error'
    : (err.message || 'Something went wrong');

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.code ? { code: err.code } : {}),
    requestId
  });
};

module.exports = errorHandler;
