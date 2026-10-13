const tripService = require('../services/tripService');
const { createTripSchema, completeTripSchema } = require('../validators/tripValidators');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDriverAccessId = async (user) => {
  if (user.role === 'DRIVER') {
    const driver = await prisma.driver.findFirst({ where: { userId: user.id, companyId: user.companyId } });
    if (!driver) throw Object.assign(new Error("Driver profile not linked to your user account"), { code: 403 });
    return driver.id;
  }
  return null;
};

const getTrips = async (req, res, next) => {
  try {
    const driverRoleAccessId = await getDriverAccessId(req.user);
    const { page, limit, status, vehicleId, driverId, search, startDate, endDate, sortBy, sortOrder } = req.query;
    
    const params = { page, limit, status, vehicleId, search, startDate, endDate, sortBy, sortOrder };
    if (driverRoleAccessId) {
      params.driverId = driverRoleAccessId; // restrict query to this driver
    } else if (driverId) {
      params.driverId = driverId;
    }

    const result = await tripService.getTrips(req.user.companyId, params);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.code === 403) return res.status(403).json({ success: false, message: error.message });
    next(error);
  }
};

const getTripById = async (req, res, next) => {
  try {
    const driverRoleAccessId = await getDriverAccessId(req.user);
    const trip = await tripService.getTripById(req.user.companyId, req.params.id, driverRoleAccessId);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    res.json({ success: true, data: trip });
  } catch (error) {
    if (error.code === 403) return res.status(403).json({ success: false, message: error.message });
    next(error);
  }
};

const createTrip = async (req, res, next) => {
  try {
    const validatedData = createTripSchema.parse(req.body);
    const trip = await tripService.createTrip(req.user.companyId, validatedData);
    res.status(201).json({ success: true, data: trip });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, errors: error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const startTrip = async (req, res, next) => {
  try {
    const driverRoleAccessId = await getDriverAccessId(req.user);
    const trip = await tripService.startTrip(req.user.companyId, req.params.id, driverRoleAccessId);
    res.json({ success: true, data: trip });
  } catch (error) {
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const completeTrip = async (req, res, next) => {
  try {
    const driverRoleAccessId = await getDriverAccessId(req.user);
    const validatedData = completeTripSchema.parse(req.body);
    const trip = await tripService.completeTrip(req.user.companyId, req.params.id, validatedData, driverRoleAccessId);
    res.json({ success: true, data: trip });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, errors: error.errors });
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const cancelTrip = async (req, res, next) => {
  try {
    // DRIVER cannot cancel trips. Route middleware requires ADMIN/FLEET_MANAGER.
    const trip = await tripService.cancelTrip(req.user.companyId, req.params.id);
    res.json({ success: true, data: trip });
  } catch (error) {
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  getTrips,
  getTripById,
  createTrip,
  startTrip,
  completeTrip,
  cancelTrip
};
