const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('./utils/jwt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let io;

const initSocket = (server) => {
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

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          allowedOrigins.includes('*') ||
          /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
          /\.vercel\.app$/i.test(origin) ||
          /\.onrender\.com$/i.test(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = verifyAccessToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      socket.companyId = user.companyId;
      
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join the company-specific room for tenant isolation
    const companyRoom = `company:${socket.companyId}`;
    
    // For DRIVER, only allow them to listen to their own updates or specific vehicle rooms
    if (socket.user.role === 'DRIVER') {
      // Drivers join a specific driver room
      const driverRoom = `driver:${socket.user.id}`;
      socket.join(driverRoom);
    } else {
      // Admins, Fleet Managers, Viewers join the full company room
      socket.join(companyRoom);
    }

    socket.on('disconnect', () => {
      // Cleanup happens automatically, but we can log if necessary
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Function to emit vehicle update
const emitVehicleUpdate = (companyId, driverUserId, vehicleId, state) => {
  if (!io) return;
  
  // Emit to company room (Admins, Fleet Managers, Viewers)
  io.to(`company:${companyId}`).emit('fleet:vehicle:update', state);

  // Emit to the specific driver's room if the vehicle is assigned to them
  if (driverUserId) {
    io.to(`driver:${driverUserId}`).emit('fleet:vehicle:update', state);
  }
};

const emitAlertCreated = (companyId, alert, driverUserId = null) => {
  if (!io) return;
  io.to(`company:${companyId}`).emit('alert:created', alert);
  if (driverUserId) {
    io.to(`driver:${driverUserId}`).emit('alert:created', alert);
  }
};

const emitAlertAcknowledged = (companyId, alert, driverUserId = null) => {
  if (!io) return;
  io.to(`company:${companyId}`).emit('alert:acknowledged', alert);
  if (driverUserId) {
    io.to(`driver:${driverUserId}`).emit('alert:acknowledged', alert);
  }
};

const emitAlertResolved = (companyId, alert, driverUserId = null) => {
  if (!io) return;
  io.to(`company:${companyId}`).emit('alert:resolved', alert);
  if (driverUserId) {
    io.to(`driver:${driverUserId}`).emit('alert:resolved', alert);
  }
};

module.exports = {
  initSocket,
  getIo,
  emitVehicleUpdate,
  emitAlertCreated,
  emitAlertAcknowledged,
  emitAlertResolved
};

