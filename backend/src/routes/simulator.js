const express = require('express');
const router = express.Router();
const simulatorController = require('../controllers/simulatorController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/status', requireRole('ADMIN', 'FLEET_MANAGER'), simulatorController.getStatus);
router.post('/start', requireRole('ADMIN', 'FLEET_MANAGER'), simulatorController.start);
router.post('/stop', requireRole('ADMIN', 'FLEET_MANAGER'), simulatorController.stop);
router.post('/speed', requireRole('ADMIN', 'FLEET_MANAGER'), simulatorController.setSpeed);
router.post('/reset', requireRole('ADMIN', 'FLEET_MANAGER'), simulatorController.reset);

module.exports = router;
