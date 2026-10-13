const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const redisService = require('../services/redisService');
const { getQueueHealth } = require('../jobs/queues');

/**
 * Basic health check
 */
exports.getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    service: "FleetCore API",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
};

/**
 * Liveness probe: checks if process is responding.
 * Does not depend on external databases.
 */
exports.getLiveness = (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid
  });
};

/**
 * Readiness probe: checks critical dependencies (MySQL, Redis).
 */
exports.getReadiness = async (req, res) => {
  const checks = {
    database: false,
    redis: false
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    checks.database = false;
  }

  try {
    checks.redis = await redisService.checkHealth();
  } catch (err) {
    checks.redis = false;
  }

  const isReady = checks.database && checks.redis;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks
  });
};

exports.getDbHealth = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      database: "mysql",
      status: "connected"
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      database: "mysql",
      status: "disconnected",
      message: "Database connection failed"
    });
  }
};

exports.getRedisHealth = async (req, res) => {
  const isHealthy = await redisService.checkHealth();
  if (isHealthy) {
    res.status(200).json({
      success: true,
      service: "redis",
      status: "connected"
    });
  } else {
    res.status(503).json({
      success: false,
      service: "redis",
      status: "disconnected",
      message: "Redis connection failed"
    });
  }
};

exports.getJobsHealth = async (req, res) => {
  try {
    const health = await getQueueHealth();
    const isOnline = Object.values(health).some(q => q.status === 'online');
    res.status(isOnline ? 200 : 503).json({
      success: isOnline,
      service: "bullmq",
      queues: health
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: "bullmq",
      status: "disconnected",
      message: error.message
    });
  }
};
