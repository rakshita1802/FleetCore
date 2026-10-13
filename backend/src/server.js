require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`FleetCore API Server running on port ${PORT}`);
});

const { initSocket } = require('./socket');
initSocket(server);

// Initialize Autonomous GPS Route Simulator
const gpsSimulatorService = require('./services/gpsSimulatorService');
gpsSimulatorService.initialize().catch((err) => {
  console.error('Failed to initialize Autonomous GPS Simulator:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
