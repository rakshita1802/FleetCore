const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authenticate');
const { validateDateRange, validatePagination, validateSorting } = require('../validators/analyticsValidators');

router.use(authenticate);
router.use(validateDateRange);

router.get('/overview', analyticsController.getOverview);
router.get('/trends', analyticsController.getTrends);
router.get('/utilization', validatePagination, validateSorting, analyticsController.getUtilization);
router.get('/fuel', validatePagination, validateSorting, analyticsController.getFuel);
router.get('/idle-time', validatePagination, validateSorting, analyticsController.getIdleTime);

module.exports = router;
