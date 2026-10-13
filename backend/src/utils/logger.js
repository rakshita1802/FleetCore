const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const SENSITIVE_KEYS = ['password', 'passwordhash', 'token', 'accesstoken', 'refreshtoken', 'secret', 'authorization', 'cookie', 'database_url', 'redis_url'];

const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const shouldLog = (level) => {
  const currentLevelValue = LOG_LEVELS[CURRENT_LEVEL] !== undefined ? LOG_LEVELS[CURRENT_LEVEL] : 1;
  const targetLevelValue = LOG_LEVELS[level.toLowerCase()] !== undefined ? LOG_LEVELS[level.toLowerCase()] : 1;
  return targetLevelValue >= currentLevelValue;
};

const formatLog = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const sanitizedContext = sanitizeData(context);
  const requestId = sanitizedContext.requestId || '-';
  return {
    timestamp,
    level: level.toUpperCase(),
    requestId,
    message,
    ...sanitizedContext
  };
};

const logger = {
  debug: (message, context = {}) => {
    if (shouldLog('debug')) {
      const logObj = formatLog('debug', message, context);
      console.log(`[${logObj.timestamp}] [DEBUG] [${logObj.requestId}] ${message}`, Object.keys(context).length ? logObj : '');
    }
  },
  info: (message, context = {}) => {
    if (shouldLog('info')) {
      const logObj = formatLog('info', message, context);
      console.log(`[${logObj.timestamp}] [INFO] [${logObj.requestId}] ${message}`, Object.keys(context).length ? logObj : '');
    }
  },
  warn: (message, context = {}) => {
    if (shouldLog('warn')) {
      const logObj = formatLog('warn', message, context);
      console.warn(`[${logObj.timestamp}] [WARN] [${logObj.requestId}] ${message}`, Object.keys(context).length ? logObj : '');
    }
  },
  error: (message, context = {}) => {
    if (shouldLog('error')) {
      const logObj = formatLog('error', message, context);
      console.error(`[${logObj.timestamp}] [ERROR] [${logObj.requestId}] ${message}`, Object.keys(context).length ? logObj : '');
    }
  },
  sanitize: sanitizeData
};

module.exports = logger;
