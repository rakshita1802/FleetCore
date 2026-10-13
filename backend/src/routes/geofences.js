const express = require('express');
const router = express.Router();
const geofenceController = require('../controllers/geofenceController');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use(authenticate);

// List & Breaches accessible to Admins, Fleet Managers, and Viewers
router.get('/', geofenceController.getGeofences);
router.get('/breaches', geofenceController.getBreaches);
router.post('/breaches/:id/resolve', authorize('ADMIN', 'FLEET_MANAGER'), geofenceController.resolveBreach);

// Mutation routes only for Admins & Fleet Managers
router.post('/', authorize('ADMIN', 'FLEET_MANAGER'), geofenceController.createGeofence);
router.patch('/:id', authorize('ADMIN', 'FLEET_MANAGER'), geofenceController.updateGeofence);
router.delete('/:id', authorize('ADMIN', 'FLEET_MANAGER'), geofenceController.deleteGeofence);

module.exports = router;
