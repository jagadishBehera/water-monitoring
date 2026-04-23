'use strict';

require('dotenv').config();

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const createApp = require('./src/app');
const connectDB = require('./src/config/database');
const { initSocket } = require('./src/socket/socketManager');

const PORT = process.env.PORT || 3000;

const bootstrap = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Create Express app
  const app = createApp();

  // 3. Create HTTP server
  const httpServer = http.createServer(app);

  // 4. Initialize Socket.io
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  initSocket(io);

  // 5. Start listening
  httpServer.listen(PORT, () => {
    console.log('\n🚀 ══════════════════════════════════════════════════');
    console.log(`   Water Storage Monitoring System`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   HTTP API    : http://localhost:${PORT}/api`);
    console.log(`   Health      : http://localhost:${PORT}/health`);
    console.log(`   WebSocket   : ws://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════\n');
  });

  // 6. Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('⛔ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
};

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});