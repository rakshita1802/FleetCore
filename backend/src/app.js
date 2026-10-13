const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const requestId = require('./middleware/requestId');
const { requestMetrics } = require('./middleware/requestMetrics');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const assignmentRoutes = require('./routes/assignments');
const tripRoutes = require('./routes/trips');
const telemetryRoutes = require('./routes/telemetry');
const fleetRoutes = require('./routes/fleet');
const analyticsRoutes = require('./routes/analytics');
const maintenanceRoutes = require('./routes/maintenance');
const alertRoutes = require('./routes/alerts');
const jobRoutes = require('./routes/jobs');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & Core Middleware
app.use(helmet());
app.use(requestId);
app.use(requestMetrics);
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:80',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];
const envOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/simulator', require('./routes/simulator'));
app.use('/api/geofences', require('./routes/geofences'));

// Error Handling
app.use(errorHandler);

module.exports = app;
