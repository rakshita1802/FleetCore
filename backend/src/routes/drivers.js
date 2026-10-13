const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), driverController.getDrivers);
router.get('/:id', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), driverController.getDriverById);
router.post('/', requireRole('ADMIN', 'FLEET_MANAGER'), driverController.createDriver);
router.patch('/:id', requireRole('ADMIN', 'FLEET_MANAGER'), driverController.updateDriver);
router.delete('/:id', requireRole('ADMIN'), driverController.archiveDriver);

module.exports = router;
