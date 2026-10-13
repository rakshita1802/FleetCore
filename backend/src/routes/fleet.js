const express = require('express');
const router = express.Router();
const liveFleetController = require('../controllers/liveFleetController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

// Get complete live fleet
router.get('/live',
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'),
  liveFleetController.getLiveFleet
);

module.exports = router;
