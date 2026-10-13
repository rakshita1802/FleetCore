const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use(authenticate);

// Preview endpoints: ADMIN, FLEET_MANAGER, VIEWER
router.get('/:type', authorize(['ADMIN', 'FLEET_MANAGER', 'VIEWER']), reportController.getReportPreview);

// Export endpoints: ADMIN, FLEET_MANAGER
router.get('/:type/export', authorize(['ADMIN', 'FLEET_MANAGER']), reportController.exportReportSync);
router.post('/:type/export', authorize(['ADMIN', 'FLEET_MANAGER']), reportController.exportReportAsync);

// Job status & Download
router.get('/jobs/:jobId', authorize(['ADMIN', 'FLEET_MANAGER']), reportController.getReportJobStatus);
router.get('/download/:fileId', authorize(['ADMIN', 'FLEET_MANAGER']), reportController.downloadReportFile);

module.exports = router;
