const { createMaintenanceWorker } = require('./maintenanceWorker');
const { createAlertWorker } = require('./alertWorker');
const { createOperationalWorker } = require('./operationalWorker');
const { createReportWorker } = require('./reportWorker');

let workers = [];

const startAllWorkers = (options = {}) => {
  if (workers.length > 0) {
    return workers;
  }

  const mw = createMaintenanceWorker(options.maintenance);
  const aw = createAlertWorker(options.alert);
  const ow = createOperationalWorker(options.operational);
  const rw = createReportWorker(options.report);

  workers = [mw, aw, ow, rw];
  console.log(`[Workers] Successfully initialized ${workers.length} background workers.`);
  return workers;
};

const closeAllWorkers = async () => {
  console.log(`[Workers] Gracefully stopping ${workers.length} workers...`);
  await Promise.all(workers.map(w => w.close().catch(e => console.error("Error closing worker:", e))));
  workers = [];
  console.log('[Workers] All background workers stopped cleanly.');
};

module.exports = {
  startAllWorkers,
  closeAllWorkers
};
