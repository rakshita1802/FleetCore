const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

// List/Query globally
router.get('/',
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'),
  telemetryController.getTelemetry
);

// Detail
router.get('/:id',
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'),
  telemetryController.getTelemetryById
);

// Ingestion
router.post('/',
  requireRole('ADMIN', 'FLEET_MANAGER'),
  telemetryController.ingest
);

module.exports = router;
