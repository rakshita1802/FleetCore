const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/', healthController.getHealth);
router.get('/live', healthController.getLiveness);
router.get('/ready', healthController.getReadiness);
router.get('/db', healthController.getDbHealth);
router.get('/redis', healthController.getRedisHealth);
router.get('/jobs', healthController.getJobsHealth);

module.exports = router;
