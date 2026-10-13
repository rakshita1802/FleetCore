const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.get('/test-rbac', authenticate, requireRole('ADMIN'), (req, res) => {
  res.status(200).json({ success: true, message: 'Admin access granted', companyId: req.user.companyId });
});

module.exports = router;
