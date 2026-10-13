const liveFleetService = require('../services/liveFleetService');
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

const getLiveFleet = async (req, res, next) => {
  try {
    const driverRoleAccessId = await getDriverAccessId(req.user);
    const data = await liveFleetService.getLiveFleet(req.user.companyId, driverRoleAccessId, req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

const getVehicleLiveState = async (req, res, next) => {
  try {
    const driverRoleAccessId = await getDriverAccessId(req.user);
    const data = await liveFleetService.getLiveFleet(req.user.companyId, driverRoleAccessId, req.user.id);
    const state = data.find(s => s.vehicleId === req.params.vehicleId);
    
    if (!state) return res.status(404).json({ success: false, message: "Vehicle state not found" });
    res.json({ success: true, data: state });
  } catch (error) {
    if (error.code) return res.status(error.code).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  getLiveFleet,
  getVehicleLiveState
};
