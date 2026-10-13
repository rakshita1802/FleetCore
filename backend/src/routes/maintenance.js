const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

// Summary & Due Items
router.get('/summary', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getSummary);
router.get('/due', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getDueItems);

// Evaluation
router.post('/evaluate', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.evaluateMaintenance);

// Schedules
router.get('/schedules', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getSchedules);
router.post('/schedules', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.createSchedule);
router.get('/schedules/:id', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getScheduleById);
router.patch('/schedules/:id', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.updateSchedule);
router.delete('/schedules/:id', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.deleteSchedule);

// Records & Lifecycle
router.get('/records', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getRecords);
router.post('/records', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.createRecord);
router.get('/records/:id', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getRecordById);
router.patch('/records/:id', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.updateRecord);
router.post('/records/:id/start', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.startRecord);
router.post('/records/:id/complete', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.completeRecord);
router.post('/records/:id/cancel', requireRole('ADMIN', 'FLEET_MANAGER'), maintenanceController.cancelRecord);

// Vehicle-specific Maintenance Details
router.get('/vehicles/:vehicleId', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), maintenanceController.getVehicleMaintenanceDetails);

module.exports = router;
