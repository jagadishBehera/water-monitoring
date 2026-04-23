'use strict';

const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: [true, 'Tank reference is required'],
      index: true,
    },
    tankRef: {
      type: String,
      required: [true, 'Tank ID string is required'],
      index: true,
      comment: 'Human-readable tankId for easy querying',
    },
    // Core sensor readings
    flowRate: {
      type: Number,
      required: [true, 'Flow rate is required'],
      min: [0, 'Flow rate cannot be negative'],
      comment: 'Real-time water flow in L/min',
    },
    efmReading: {
      type: Number,
      required: [true, 'EFM reading is required'],
      min: [0, 'EFM reading cannot be negative'],
      comment: 'Electromagnetic Flow Meter reading in m³/h',
    },
    totalizer: {
      type: Number,
      required: [true, 'Totalizer value is required'],
      min: [0, 'Totalizer cannot be negative'],
      comment: 'Cumulative water usage in liters',
    },
    // Optional extra sensor fields (extensible for future sensors)
    pressure: {
      type: Number,
      default: null,
      comment: 'Water pressure in bar',
    },
    temperature: {
      type: Number,
      default: null,
      comment: 'Water temperature in Celsius',
    },
    // Source metadata
    source: {
      type: String,
      enum: ['device', 'manual', 'simulation', 'api'],
      default: 'device',
    },
    deviceId: {
      type: String,
      default: null,
      comment: 'Physical device identifier that sent the data',
    },
    // Data quality
    isValid: {
      type: Boolean,
      default: true,
    },
    // Reference to which user was assigned at time of reading
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    // Prevent Mongoose from creating extra __v index
    versionKey: false,
  }
);

// Compound indexes for common queries
sensorDataSchema.index({ tankId: 1, timestamp: -1 });
sensorDataSchema.index({ tankRef: 1, timestamp: -1 });
sensorDataSchema.index({ assignedUser: 1, timestamp: -1 });
sensorDataSchema.index({ timestamp: -1 });

// TTL index: auto-delete records older than 1 year (optional, comment out to keep forever)
// sensorDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

const SensorData = mongoose.model('SensorData', sensorDataSchema);
module.exports = SensorData;