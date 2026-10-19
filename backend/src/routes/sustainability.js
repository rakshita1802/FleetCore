const express = require('express');
const router = express.Router();
const sustainabilityController = require('../controllers/sustainabilityController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

// Green Fleet Analytics Metrics
router.get(
  '/metrics',
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'),
  sustainabilityController.getMetrics
);

// Vehicle Head-to-Head Comparison
router.get(
  '/compare',
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'),
  sustainabilityController.compareVehicles
);

// Green Computing Cache Management
router.post(
  '/cache/clear',
  requireRole('ADMIN', 'FLEET_MANAGER'),
  sustainabilityController.clearCache
);

module.exports = router;
