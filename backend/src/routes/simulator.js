const express = require('express');
const router = express.Router();
const simulatorController = require('../controllers/simulatorController');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

router.get('/status', simulatorController.getStatus);
router.post('/start', simulatorController.start);
router.post('/stop', simulatorController.stop);
router.post('/speed', simulatorController.setSpeed);
router.post('/reset', simulatorController.reset);

module.exports = router;
