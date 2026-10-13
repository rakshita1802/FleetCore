const alertService = require('../services/alertService');
const { acknowledgeAlertSchema, resolveAlertSchema } = require('../validators/alertValidators');
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

const getAlerts = async (req, res, next) => {
  try {
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const result = await alertService.getAlerts(req.user.companyId, req.query, driverVehicleId);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getAlertById = async (req, res, next) => {
  try {
    const driverVehicleId = await getDriverAssignedVehicleId(req.user);
    const alert = await alertService.getAlertById(req.user.companyId, req.params.id, driverVehicleId);
    if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
    res.json({ success: true, data: alert });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const acknowledgeAlert = async (req, res, next) => {
  try {
    const validated = acknowledgeAlertSchema.parse(req.body || {});
    const alert = await alertService.acknowledgeAlert(req.user.companyId, req.params.id, req.user.id, validated);
    res.json({ success: true, data: alert });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const resolveAlert = async (req, res, next) => {
  try {
    const validated = resolveAlertSchema.parse(req.body || {});
    const alert = await alertService.resolveAlert(req.user.companyId, req.params.id, req.user.id, validated);
    res.json({ success: true, data: alert });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, message: "Validation error", errors: error.issues || error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert
};
