const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/', 
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), 
  tripController.getTrips
);

router.get('/:id', 
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), 
  tripController.getTripById
);

// Add Phase 5 explicit requirement
const telemetryController = require('../controllers/telemetryController');
router.get('/:tripId/telemetry', 
  requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), 
  telemetryController.getTripTelemetry
);

router.post('/', 
  requireRole('ADMIN', 'FLEET_MANAGER'), 
  tripController.createTrip
);

router.post('/:id/start', 
  requireRole('ADMIN', 'FLEET_MANAGER', 'DRIVER'), 
  tripController.startTrip
);

router.post('/:id/complete', 
  requireRole('ADMIN', 'FLEET_MANAGER', 'DRIVER'), 
  tripController.completeTrip
);

router.post('/:id/cancel', 
  requireRole('ADMIN', 'FLEET_MANAGER'), 
  tripController.cancelTrip
);

module.exports = router;
