'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const tankRoutes = require('./routes/tankRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { getConnectionStats } = require('./socket/socketManager');

const createApp = () => {
  const app = express();

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ─── Rate Limiting ─────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });

  // Stricter limit for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts, please try again later.' },
  });

  app.use('/api/', limiter);
  app.use('/api/auth/login', authLimiter);

  // ─── Body Parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Logging ──────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // ─── Health Check ─────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      websockets: getConnectionStats(),
    });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/tanks', tankRoutes);
  app.use('/api/sensor', sensorRoutes);

  // ─── API Index ────────────────────────────────────────────────────────────
  app.get('/api', (req, res) => {
    res.json({
      success: true,
      message: 'Water Storage Monitoring System API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        tanks: '/api/tanks',
        sensor: '/api/sensor',
        health: '/health',
      },
    });
  });

  // ─── Error Handling ───────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;