const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), vehicleController.getVehicles);
router.get('/:id', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), vehicleController.getVehicleById);

// Add Phase 5 explicit requirement
const telemetryController = require('../controllers/telemetryController');
router.get('/:vehicleId/telemetry', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), telemetryController.getVehicleTelemetry);

// Add Phase 6 explicit requirement
const liveFleetController = require('../controllers/liveFleetController');
router.get('/:vehicleId/live', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), liveFleetController.getVehicleLiveState);

router.post('/', requireRole('ADMIN', 'FLEET_MANAGER'), vehicleController.createVehicle);
router.patch('/:id', requireRole('ADMIN', 'FLEET_MANAGER'), vehicleController.updateVehicle);
router.delete('/:id', requireRole('ADMIN'), vehicleController.archiveVehicle);

module.exports = router;
