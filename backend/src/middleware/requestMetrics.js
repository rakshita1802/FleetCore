const metricsState = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  totalLatencyMs: 0,
  statusCodes: {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0
  },
  routes: {}
};

/**
 * Normalizes dynamic URL paths to prevent high metric cardinality.
 * e.g., /api/vehicles/550e8400-e29b-41d4-a716-446655440000 -> /api/vehicles/:id
 */
const normalizePath = (path) => {
  if (!path) return '/';
  
  // Strip query string
  const cleanPath = path.split('?')[0];

  return cleanPath
    // UUID v4 regex
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    // Job IDs or custom entity IDs like alt-1, rec-1, trip-1, veh-1, sched-1
    .replace(/\/(alt|rec|trip|veh|sched|job|usr|comp)-[a-zA-Z0-9_-]+/gi, '/:id');
};

const requestMetrics = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusClass = `${Math.floor(statusCode / 100)}xx`;

    metricsState.totalRequests += 1;
    metricsState.totalLatencyMs += duration;

    if (metricsState.statusCodes[statusClass] !== undefined) {
      metricsState.statusCodes[statusClass] += 1;
    }

    const normalized = `${req.method} ${normalizePath(req.baseUrl || req.path || req.originalUrl)}`;
    if (!metricsState.routes[normalized]) {
      metricsState.routes[normalized] = {
        count: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        errors: 0
      };
    }

    const routeMetric = metricsState.routes[normalized];
    routeMetric.count += 1;
    routeMetric.totalDurationMs += duration;
    routeMetric.avgDurationMs = Math.round(routeMetric.totalDurationMs / routeMetric.count);
    if (statusCode >= 400) {
      routeMetric.errors += 1;
    }
  });

  next();
};

const getApiMetrics = () => {
  const avgLatency = metricsState.totalRequests > 0
    ? Math.round(metricsState.totalLatencyMs / metricsState.totalRequests)
    : 0;

  return {
    startedAt: metricsState.startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    totalRequests: metricsState.totalRequests,
    avgLatencyMs: avgLatency,
    statusCodes: { ...metricsState.statusCodes },
    routes: { ...metricsState.routes }
  };
};

const resetMetricsForTesting = () => {
  metricsState.totalRequests = 0;
  metricsState.totalLatencyMs = 0;
  metricsState.statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  metricsState.routes = {};
};

module.exports = {
  requestMetrics,
  getApiMetrics,
  normalizePath,
  resetMetricsForTesting
};
