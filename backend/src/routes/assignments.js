const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), assignmentController.getAssignments);
router.get('/:id', requireRole('ADMIN', 'FLEET_MANAGER', 'VIEWER'), assignmentController.getAssignmentById);
router.post('/', requireRole('ADMIN', 'FLEET_MANAGER'), assignmentController.createAssignment);
router.post('/:id/unassign', requireRole('ADMIN', 'FLEET_MANAGER'), assignmentController.unassign);

module.exports = router;
