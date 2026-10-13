const gpsSimulatorService = require('../services/gpsSimulatorService');

const getStatus = (req, res) => {
  res.json({
    success: true,
    data: gpsSimulatorService.getStatus()
  });
};

const start = (req, res) => {
  gpsSimulatorService.start();
  res.json({
    success: true,
    message: 'Autonomous GPS Simulator started',
    data: gpsSimulatorService.getStatus()
  });
};

const stop = (req, res) => {
  gpsSimulatorService.stop();
  res.json({
    success: true,
    message: 'Autonomous GPS Simulator paused',
    data: gpsSimulatorService.getStatus()
  });
};

const setSpeed = (req, res) => {
  const multiplier = Number(req.body.multiplier || 1);
  const data = gpsSimulatorService.setSpeed(multiplier);
  res.json({
    success: true,
    message: `Simulator speed updated to ${multiplier}x`,
    data
  });
};

const reset = (req, res) => {
  const data = gpsSimulatorService.reset();
  res.json({
    success: true,
    message: 'Simulator waypoints reset to origin',
    data
  });
};

module.exports = {
  getStatus,
  start,
  stop,
  setSpeed,
  reset
};
