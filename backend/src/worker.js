require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startAllWorkers, closeAllWorkers } = require('./jobs/workers');
const { closeAllQueues } = require('./jobs/queues');
const { initSchedulers } = require('./jobs/schedulers/maintenanceScheduler');

console.log('====================================================');
console.log('  FleetCore Background Worker Process Starting...   ');
console.log('====================================================');

let isShuttingDown = false;

const start = async () => {
  try {
    // 1. Verify Prisma connectivity
    await prisma.$connect();
    console.log('[Worker Process] Database connection verified.');

    // 2. Start all queue workers
    startAllWorkers();

    // 3. Initialize repeatable scheduled jobs
    await initSchedulers();

    console.log('[Worker Process] Background worker process is fully operational and listening for jobs.');
  } catch (error) {
    console.error('[Worker Process] Failed to start worker process:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Worker Process] Received ${signal}. Starting graceful shutdown...`);

  try {
    await closeAllWorkers();
    await closeAllQueues();
    await prisma.$disconnect();
    console.log('[Worker Process] Graceful shutdown completed cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[Worker Process] Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
