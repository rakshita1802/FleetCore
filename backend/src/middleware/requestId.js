const crypto = require('crypto');

const requestId = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  // Ensure the request ID contains only safe alphanumeric/hyphen characters to prevent header injection
  const safeId = incomingId && typeof incomingId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(incomingId)
    ? incomingId
    : crypto.randomUUID();

  req.id = safeId;
  res.setHeader('X-Request-ID', safeId);
  next();
};

module.exports = requestId;
