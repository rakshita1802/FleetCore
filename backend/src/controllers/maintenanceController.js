const maintenanceService = require('../services/maintenanceService');
const alertService = require('../services/alertService');
const {
  createScheduleSchema,
  updateScheduleSchema,
  createRecordSchema,
  updateRecordSchema,
  startRecordSchema,
  completeRecordSchema,
  cancelRecordSchema
} = require('../validators/maintenanceValidators');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDriverAssignedVehicleId = async (user) => {
  if (user.role === 'DRIVER') {
    const driver = await prisma.driver.findFirst({ where: { userId: user.id, companyId: user.companyId } });
    if (!driver) throw Object.assign(new Error("Driver profile not linked to your user account"), { code: 403 });
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { driverId: driver.id, companyId: user.companyId, isActive: true }
    });
    if (!assignment) throw Object.assign(new Error("No active vehicle assignment found for driver"), { code: 403 });
    return assignment.vehicleId;
  }
  return null;
};

const getSummary = async (req, res, next) => {
  try {
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const summary = await maintenanceService.getSummary(req.user.companyId, driverVehicleId);
    res.json({ success: true, data: summary });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getDueItems = async (req, res, next) => {
  try {
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const result = await maintenanceService.getDueItems(req.user.companyId, req.query, driverVehicleId);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getSchedules = async (req, res, next) => {
  try {
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const result = await maintenanceService.getSchedules(req.user.companyId, req.query, driverVehicleId);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getScheduleById = async (req, res, next) => {
  try {
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const schedule = await maintenanceService.getScheduleById(req.user.companyId, req.params.id, driverVehicleId);
    if (!schedule) return res.status(404).json({ success: false, message: "Maintenance schedule not found" });
    res.json({ success: true, data: schedule });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const createSchedule = async (req, res, next) => {
  try {
    const validated = createScheduleSchema.parse(req.body);
    const schedule = await maintenanceService.createSchedule(req.user.companyId, validated);
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const validated = updateScheduleSchema.parse(req.body);
    const updated = await maintenanceService.updateSchedule(req.user.companyId, req.params.id, validated);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const result = await maintenanceService.deleteSchedule(req.user.companyId, req.params.id);
    res.json(result);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getRecords = async (req, res, next) => {
  try {
    const isDriver = req.user.role === 'DRIVER';
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const result = await maintenanceService.getRecords(req.user.companyId, req.query, driverVehicleId, isDriver);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getRecordById = async (req, res, next) => {
  try {
    const isDriver = req.user.role === 'DRIVER';
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const record = await maintenanceService.getRecordById(req.user.companyId, req.params.id, driverVehicleId, isDriver);
    if (!record) return res.status(404).json({ success: false, message: "Maintenance record not found" });
    res.json({ success: true, data: record });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const createRecord = async (req, res, next) => {
  try {
    const validated = createRecordSchema.parse(req.body);
    const record = await maintenanceService.createRecord(req.user.companyId, validated, req.user.id);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const updateRecord = async (req, res, next) => {
  try {
    const validated = updateRecordSchema.parse(req.body);
    const updated = await maintenanceService.updateRecord(req.user.companyId, req.params.id, validated);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const startRecord = async (req, res, next) => {
  try {
    const validated = startRecordSchema.parse(req.body || {});
    const started = await maintenanceService.startRecord(req.user.companyId, req.params.id, req.user.id, validated);
    res.json({ success: true, data: started });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const completeRecord = async (req, res, next) => {
  try {
    const validated = completeRecordSchema.parse(req.body || {});
    const completed = await maintenanceService.completeRecord(req.user.companyId, req.params.id, req.user.id, validated);
    res.json({ success: true, data: completed });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const cancelRecord = async (req, res, next) => {
  try {
    const validated = cancelRecordSchema.parse(req.body || {});
    const cancelled = await maintenanceService.cancelRecord(req.user.companyId, req.params.id, req.user.id, validated);
    res.json({ success: true, data: cancelled });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getVehicleMaintenanceDetails = async (req, res, next) => {
  try {
    const isDriver = req.user.role === 'DRIVER';
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const details = await maintenanceService.getVehicleMaintenanceDetails(
      req.user.companyId,
      req.params.vehicleId,
      driverVehicleId,
      isDriver
    );
    res.json({ success: true, data: details });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const evaluateMaintenance = async (req, res, next) => {
  try {
    const { enqueueCompanyEvaluation } = require('../jobs/queues/maintenanceQueue');
    const job = await enqueueCompanyEvaluation(req.user.companyId);
    res.status(202).json({
      success: true,
      message: "Maintenance evaluation queued",
      data: {
        jobId: job?.id || `maint-eval:${req.user.companyId}:${Date.now()}`,
        queue: 'maintenance',
        status: 'queued'
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  getSummary,
  getDueItems,
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  startRecord,
  completeRecord,
  cancelRecord,
  getVehicleMaintenanceDetails,
  evaluateMaintenance
};
