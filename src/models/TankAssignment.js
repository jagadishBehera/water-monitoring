'use strict';

const mongoose = require('mongoose');

/**
 * TankAssignment: Full audit trail of all tank-user assignments.
 * This is separate from the current assignedTank/assignedUser fields
 * to maintain a complete history of who was assigned when.
 */
const tankAssignmentSchema = new mongoose.Schema(
  {
    tank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
      index: true,
    },
    tankRef: {
      type: String,
      required: true,
      comment: 'Human-readable tankId snapshot at time of assignment',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      comment: 'User email snapshot at time of assignment',
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      comment: 'Admin who performed the assignment',
    },
    action: {
      type: String,
      enum: ['assign', 'reassign', 'unassign'],
      required: true,
    },
    // Previous user if this was a reassignment
    previousUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    previousUserEmail: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
      default: null,
      comment: 'Set when a new assignment supersedes this one',
    },
    isActive: {
      type: Boolean,
      default: true,
      comment: 'Only one assignment per tank should be active at a time',
    },
  },
  {
    timestamps: true,
  }
);

tankAssignmentSchema.index({ tank: 1, isActive: 1 });
tankAssignmentSchema.index({ user: 1, isActive: 1 });
tankAssignmentSchema.index({ effectiveFrom: -1 });

const TankAssignment = mongoose.model('TankAssignment', tankAssignmentSchema);
module.exports = TankAssignment;