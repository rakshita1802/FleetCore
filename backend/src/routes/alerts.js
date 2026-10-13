const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), alertController.getAlerts);
router.get('/:id', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER', 'DRIVER'), alertController.getAlertById);
router.post('/:id/acknowledge', requireRole('ADMIN', 'FLEET_MANAGER'), alertController.acknowledgeAlert);
router.post('/:id/resolve', requireRole('ADMIN', 'FLEET_MANAGER'), alertController.resolveAlert);

module.exports = router;
