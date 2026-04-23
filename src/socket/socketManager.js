'use strict';

const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

let io = null;

// Connected socket registry: socketId → { userId, role, assignedTank }
const connectedClients = new Map();

/**
 * Initialize Socket.io with authentication and event handlers.
 */
const initSocket = (socketIo) => {
  io = socketIo;

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.sub).select('-password').lean();

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    console.log(`🔌 Socket connected: ${user.email} [${user.role}] (${socket.id})`);

    // Register client
    connectedClients.set(socket.id, {
      userId: user._id.toString(),
      role: user.role,
      assignedTank: user.assignedTank?.toString() || null,
      socketId: socket.id,
    });

    // Admins join a global admin room
    if (user.role === 'admin') {
      socket.join('room:admins');
    }

    // Users join their tank room (if assigned)
    if (user.role === 'user' && user.assignedTank) {
      const tankRoom = `room:tank:${user.assignedTank}`;
      socket.join(tankRoom);
      console.log(`   └─ Joined tank room: ${tankRoom}`);
    }

    // Join personal room (for targeted messages)
    socket.join(`room:user:${user._id}`);

    // Acknowledge connection
    socket.emit('connected', {
      message: 'Connected to Water Monitoring System',
      userId: user._id,
      role: user.role,
      assignedTank: user.assignedTank,
    });

    // Handle explicit tank room subscription (re-fetch from DB)
    socket.on('subscribe:tank', async (tankId) => {
      try {
        const freshUser = await User.findById(user._id).lean();
        if (
          user.role === 'admin' ||
          freshUser.assignedTank?.toString() === tankId
        ) {
          socket.join(`room:tank:${tankId}`);
          socket.emit('subscribed', { tankId });
        } else {
          socket.emit('error', { message: 'Not authorized for this tank' });
        }
      } catch (err) {
        socket.emit('error', { message: 'Subscription failed' });
      }
    });

    socket.on('disconnect', (reason) => {
      connectedClients.delete(socket.id);
      console.log(`🔌 Socket disconnected: ${user.email} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`Socket error for ${user.email}:`, err);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
};

/**
 * Emit a sensor data update to the relevant rooms.
 * - Admins always receive all updates (room:admins)
 * - Assigned user receives via their tank room (room:tank:<tankObjectId>)
 */
const emitSensorUpdate = (tankObjectId, tankRef, sensorPayload) => {
  if (!io) return;

  const event = 'sensor:update';
  const data = {
    tankId: tankObjectId,
    tankRef,
    ...sensorPayload,
    emittedAt: new Date().toISOString(),
  };

  // Broadcast to all admins
  io.to('room:admins').emit(event, data);

  // Broadcast to tank-specific room (user assigned to this tank)
  io.to(`room:tank:${tankObjectId}`).emit(event, data);
};

/**
 * Notify a user that their tank assignment changed.
 * The user's socket will be moved to the new tank room.
 */
const notifyTankReassignment = async (userId, newTankId, oldTankId = null) => {
  if (!io) return;

  const userSockets = await io.in(`room:user:${userId}`).fetchSockets();

  for (const socket of userSockets) {
    // Leave old tank room
    if (oldTankId) {
      socket.leave(`room:tank:${oldTankId}`);
    }
    // Join new tank room
    if (newTankId) {
      socket.join(`room:tank:${newTankId}`);
    }
    // Notify user
    socket.emit('assignment:changed', {
      message: 'Your tank assignment has been updated.',
      newTankId,
      oldTankId,
      timestamp: new Date().toISOString(),
    });
  }

  // Notify admins
  io.to('room:admins').emit('assignment:changed', {
    userId,
    newTankId,
    oldTankId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit a system broadcast to all connected clients.
 */
const broadcast = (event, data) => {
  if (!io) return;
  io.emit(event, data);
};

/**
 * Get count of connected clients per role.
 */
const getConnectionStats = () => {
  const stats = { admins: 0, users: 0, total: connectedClients.size };
  connectedClients.forEach((client) => {
    if (client.role === 'admin') stats.admins++;
    else stats.users++;
  });
  return stats;
};

const getIO = () => io;

module.exports = {
  initSocket,
  emitSensorUpdate,
  notifyTankReassignment,
  broadcast,
  getConnectionStats,
  getIO,
};