const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Insufficient permissions' });
    }

    next();
  };
};

const authorize = requireRole;

module.exports = { requireRole, authorize };
