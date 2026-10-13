const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/:queue/:jobId', requireRole('ADMIN', 'FLEET_MANAGER'), jobController.getJobStatus);

module.exports = router;
