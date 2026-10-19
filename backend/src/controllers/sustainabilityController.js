const sustainabilityService = require('../services/sustainabilityService');

const getMetrics = async (req, res, next) => {
  try {
    const data = await sustainabilityService.getSustainabilityMetrics(req.user.companyId, req.query);
    res.set('X-Green-Compute-Cached', data.computingEfficiency?.cached ? 'HIT' : 'MISS');
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

const compareVehicles = async (req, res, next) => {
  try {
    const { vehicleIdA, vehicleIdB } = req.query;
    const data = await sustainabilityService.compareVehicles(req.user.companyId, vehicleIdA, vehicleIdB);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

const clearCache = async (req, res, next) => {
  try {
    const result = sustainabilityService.clearCache();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMetrics,
  compareVehicles,
  clearCache
};
