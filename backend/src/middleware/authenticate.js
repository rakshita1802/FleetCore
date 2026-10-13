const { verifyAccessToken } = require('../utils/jwt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    
    // Fetch fresh user from DB to ensure they still exist and attach company securely
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { company: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    // Attach trusted identity to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
