const telemetryService = require('../services/telemetryService');
const { telemetryIngestionSchema } = require('../validators/telemetryValidators');

const ingest = async (req, res, next) => {
  try {
    const validatedData = telemetryIngestionSchema.parse(req.body);
    const telemetry = await telemetryService.ingest(req.user.companyId, validatedData);
    res.status(201).json({ success: true, data: telemetry });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, errors: error.errors || error.issues });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getTelemetry = async (req, res, next) => {
  try {
    const result = await telemetryService.getTelemetry(req.user.companyId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const getTelemetryById = async (req, res, next) => {
  try {
    const telemetry = await telemetryService.getTelemetryById(req.user.companyId, req.params.id);
    if (!telemetry) return res.status(404).json({ success: false, message: "Telemetry not found" });
    res.json({ success: true, data: telemetry });
  } catch (error) {
    next(error);
  }
};

const getVehicleTelemetry = async (req, res, next) => {
  try {
    const result = await telemetryService.getVehicleTelemetry(req.user.companyId, req.params.vehicleId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getTripTelemetry = async (req, res, next) => {
  try {
    const result = await telemetryService.getTripTelemetry(req.user.companyId, req.params.tripId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  ingest,
  getTelemetry,
  getTelemetryById,
  getVehicleTelemetry,
  getTripTelemetry
};
