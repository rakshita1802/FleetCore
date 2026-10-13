const geofenceService = require('../services/geofenceService');

const getGeofences = async (req, res, next) => {
  try {
    const geofences = await geofenceService.getGeofences(req.user.companyId);
    res.json({
      success: true,
      data: geofences
    });
  } catch (err) {
    next(err);
  }
};

const createGeofence = async (req, res, next) => {
  try {
    const { name, description, type, rule, coordinates, radiusMeters, speedLimitKph, color, isActive } = req.body;
    if (!name || !coordinates) {
      return res.status(400).json({ success: false, message: 'Name and coordinates are required.' });
    }

    const geofence = await geofenceService.createGeofence(req.user.companyId, {
      name,
      description,
      type,
      rule,
      coordinates,
      radiusMeters,
      speedLimitKph,
      color,
      isActive
    });

    res.status(201).json({
      success: true,
      message: 'Geofence created successfully',
      data: geofence
    });
  } catch (err) {
    next(err);
  }
};

const updateGeofence = async (req, res, next) => {
  try {
    const geofence = await geofenceService.updateGeofence(req.user.companyId, req.params.id, req.body);
    res.json({
      success: true,
      message: 'Geofence updated successfully',
      data: geofence
    });
  } catch (err) {
    next(err);
  }
};

const deleteGeofence = async (req, res, next) => {
  try {
    await geofenceService.deleteGeofence(req.user.companyId, req.params.id);
    res.json({
      success: true,
      message: 'Geofence deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

const getBreaches = async (req, res, next) => {
  try {
    const breaches = await geofenceService.getBreaches(req.user.companyId, req.query);
    res.json({
      success: true,
      data: breaches
    });
  } catch (err) {
    next(err);
  }
};

const resolveBreach = async (req, res, next) => {
  try {
    const breach = await geofenceService.resolveBreach(req.user.companyId, req.params.id);
    res.json({
      success: true,
      message: 'Breach marked as resolved',
      data: breach
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  getBreaches,
  resolveBreach
};
