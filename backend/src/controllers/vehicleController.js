const { vehicleSchema } = require('../validators/fleetValidators');
const vehicleService = require('../services/vehicleService');

const getVehicles = async (req, res, next) => {
  try {
    const result = await vehicleService.getVehicles(req.user.companyId, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.getVehicleById(req.user.companyId, req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.status(200).json({ success: true, data: vehicle });
  } catch (err) { next(err); }
};

const createVehicle = async (req, res, next) => {
  try {
    const validatedData = vehicleSchema.parse(req.body);
    const vehicle = await vehicleService.createVehicle(req.user.companyId, validatedData);
    res.status(201).json({ success: true, data: vehicle });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
    if (err.message.includes('already exists')) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const validatedData = vehicleSchema.partial().parse(req.body);
    const vehicle = await vehicleService.updateVehicle(req.user.companyId, req.params.id, validatedData);
    res.status(200).json({ success: true, data: vehicle });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
    if (err.code) return res.status(err.code).json({ success: false, message: err.message });
    if (err.message === 'Vehicle not found') return res.status(404).json({ success: false, message: err.message });
    if (err.message.includes('already exists')) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
};

const archiveVehicle = async (req, res, next) => {
  try {
    const result = await vehicleService.archiveVehicle(req.user.companyId, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    if (err.message === 'Vehicle not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = { getVehicles, getVehicleById, createVehicle, updateVehicle, archiveVehicle };
