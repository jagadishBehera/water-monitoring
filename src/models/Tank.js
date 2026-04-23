'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const tankSchema = new mongoose.Schema(
  {
    tankId: {
      type: String,
      unique: true,
      default: () => `TANK-${uuidv4().slice(0, 8).toUpperCase()}`,
    },
    name: {
      type: String,
      required: [true, 'Tank name is required'],
      trim: true,
      maxlength: [150, 'Tank name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    capacity: {
      type: Number,
      min: [0, 'Capacity cannot be negative'],
      default: 0,
      comment: 'Capacity in liters',
    },
    // User currently assigned to this tank
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Latest sensor snapshot (denormalized for fast reads)
    latestReading: {
      flowRate: { type: Number, default: 0 },
      efmReading: { type: Number, default: 0 },
      totalizer: { type: Number, default: 0 },
      timestamp: { type: Date, default: null },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
tankSchema.index({ tankId: 1 }, { unique: true });
tankSchema.index({ assignedUser: 1 });
tankSchema.index({ isActive: 1 });

const Tank = mongoose.model('Tank', tankSchema);
module.exports = Tank;