const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use(authenticate);

// Only ADMIN and FLEET_MANAGER can query company audit logs
router.get('/', authorize(['ADMIN', 'FLEET_MANAGER']), auditController.getAuditLogs);

module.exports = router;
