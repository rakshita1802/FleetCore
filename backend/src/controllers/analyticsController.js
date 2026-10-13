const analyticsService = require('../services/analyticsService');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const getDriverFilter = async (user) => {
  if (user.role !== 'DRIVER') return null;

  const assignment = await prisma.vehicleAssignment.findFirst({
    where: { driver: { userId: user.id }, isActive: true, companyId: user.companyId }
  });

  const vehicleId = assignment?.vehicleId || 'UNASSIGNED';

  return {
    vehicleWhere: { id: vehicleId },
    tripWhere: { vehicleId },
    rawTripWhere: Prisma.sql`AND vehicleId = ${vehicleId}`,
    rawVehicleWhere: Prisma.sql`AND vehicleId = ${vehicleId}`,
    rawVehicleIdWhere: Prisma.sql`AND v.id = ${vehicleId}`
  };
};

const getDates = (req) => {
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate) 
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
  return { startDate, endDate };
};

exports.getOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = getDates(req);
    const driverFilter = await getDriverFilter(req.user);
    
    const overview = await analyticsService.getOverview(req.user.companyId, startDate, endDate, driverFilter);
    
    res.json({ success: true, data: overview, meta: { startDate, endDate } });
  } catch (err) {
    next(err);
  }
};

exports.getTrends = async (req, res, next) => {
  try {
    const { startDate, endDate } = getDates(req);
    const driverFilter = await getDriverFilter(req.user);
    const groupBy = req.query.groupBy || 'day'; // day, week, month
    
    const trends = await analyticsService.getTrends(req.user.companyId, startDate, endDate, groupBy, driverFilter);
    
    res.json({ success: true, data: trends, meta: { startDate, endDate, groupBy } });
  } catch (err) {
    next(err);
  }
};

exports.getUtilization = async (req, res, next) => {
  try {
    const { startDate, endDate } = getDates(req);
    const driverFilter = await getDriverFilter(req.user);
    
    const utilization = await analyticsService.getUtilization(req.user.companyId, startDate, endDate, driverFilter);
    
    res.json({ success: true, data: utilization, meta: { startDate, endDate } });
  } catch (err) {
    next(err);
  }
};

exports.getFuel = async (req, res, next) => {
  try {
    const { startDate, endDate } = getDates(req);
    const driverFilter = await getDriverFilter(req.user);
    
    const fuel = await analyticsService.getFuel(req.user.companyId, startDate, endDate, driverFilter);
    
    res.json({ success: true, data: fuel, meta: { startDate, endDate } });
  } catch (err) {
    next(err);
  }
};

exports.getIdleTime = async (req, res, next) => {
  try {
    const { startDate, endDate } = getDates(req);
    const driverFilter = await getDriverFilter(req.user);
    
    const idleTime = await analyticsService.getIdleTime(req.user.companyId, startDate, endDate, driverFilter);
    
    res.json({ success: true, data: idleTime, meta: { startDate, endDate } });
  } catch (err) {
    next(err);
  }
};
