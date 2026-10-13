const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use(authenticate);

// Overview available to ADMIN and FLEET_MANAGER
router.get('/overview', authorize(['ADMIN', 'FLEET_MANAGER']), adminController.getOverview);

// System Health Observability available to ADMIN
router.get('/system', authorize(['ADMIN']), adminController.getSystemHealth);

// User Management strictly for ADMIN
router.get('/users', authorize(['ADMIN']), adminController.listUsers);
router.get('/users/:id', authorize(['ADMIN']), adminController.getUser);
router.post('/users', authorize(['ADMIN']), adminController.createUser);
router.patch('/users/:id', authorize(['ADMIN']), adminController.updateUser);
router.patch('/users/:id/role', authorize(['ADMIN']), adminController.changeRole);
router.post('/users/:id/activate', authorize(['ADMIN']), adminController.activateUser);
router.post('/users/:id/deactivate', authorize(['ADMIN']), adminController.deactivateUser);

module.exports = router;
