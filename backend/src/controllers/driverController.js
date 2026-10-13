const { driverSchema } = require('../validators/fleetValidators');
const driverService = require('../services/driverService');

const getDrivers = async (req, res, next) => {
  try {
    const result = await driverService.getDrivers(req.user.companyId, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getDriverById = async (req, res, next) => {
  try {
    const driver = await driverService.getDriverById(req.user.companyId, req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.status(200).json({ success: true, data: driver });
  } catch (err) { next(err); }
};

const createDriver = async (req, res, next) => {
  try {
    const validatedData = driverSchema.parse(req.body);
    const driver = await driverService.createDriver(req.user.companyId, validatedData);
    res.status(201).json({ success: true, data: driver });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
    if (err.message.includes('already exists')) return res.status(409).json({ success: false, message: err.message });
    if (err.message.includes('cross-tenant')) return res.status(403).json({ success: false, message: err.message });
    next(err);
  }
};

const updateDriver = async (req, res, next) => {
  try {
    const validatedData = driverSchema.partial().parse(req.body);
    const driver = await driverService.updateDriver(req.user.companyId, req.params.id, validatedData);
    res.status(200).json({ success: true, data: driver });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
    if (err.message === 'Driver not found') return res.status(404).json({ success: false, message: err.message });
    if (err.message.includes('already exists')) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
};

const archiveDriver = async (req, res, next) => {
  try {
    const result = await driverService.archiveDriver(req.user.companyId, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    if (err.message === 'Driver not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = { getDrivers, getDriverById, createDriver, updateDriver, archiveDriver };
