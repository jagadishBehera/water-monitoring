'use strict';

const Tank = require('../models/Tank');
const User = require('../models/User');
const TankAssignment = require('../models/TankAssignment');
const { notifyTankReassignment } = require('../socket/socketManager');

/**
 * Create a new tank.
 */
const createTank = async (tankData) => {
  const tank = await Tank.create(tankData);
  return tank;
};

/**
 * Get all tanks (admin view - includes user info).
 */
const getAllTanks = async ({ page = 1, limit = 20, isActive } = {}) => {
  const filter = {};
  if (typeof isActive !== 'undefined') filter.isActive = isActive;

  const skip = (page - 1) * limit;
  const [tanks, total] = await Promise.all([
    Tank.find(filter)
      .populate('assignedUser', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Tank.countDocuments(filter),
  ]);

  return { tanks, total, page, limit };
};

/**
 * Get a single tank by its ObjectId or custom tankId string.
 */
const getTankById = async (id, populate = true) => {
  const query = Tank.findOne({ $or: [{ _id: id }, { tankId: id }], isActive: true });
  if (populate) query.populate('assignedUser', 'name email role');
  const tank = await query.lean();

  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }
  return tank;
};

/**
 * Update tank metadata.
 */
const updateTank = async (id, updates) => {
  // Prevent changing tankId or assignedUser via this method
  delete updates.tankId;
  delete updates.assignedUser;

  const tank = await Tank.findOneAndUpdate(
    { $or: [{ _id: id }, { tankId: id }] },
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('assignedUser', 'name email role');

  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }
  return tank;
};

/**
 * Soft-delete a tank.
 */
const deleteTank = async (id) => {
  const tank = await Tank.findOneAndUpdate(
    { $or: [{ _id: id }, { tankId: id }] },
    { $set: { isActive: false, assignedUser: null } },
    { new: true }
  );

  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }

  // Unassign user if there was one
  if (tank.assignedUser) {
    await User.findByIdAndUpdate(tank.assignedUser, { $set: { assignedTank: null } });
  }

  return tank;
};

/**
 * Assign or reassign a tank to a user.
 * This is fully dynamic - no hardcoded logic.
 */
const assignTank = async ({ tankId, userId, assignedBy, notes = '' }) => {
  // Validate tank
  const tank = await Tank.findOne({ $or: [{ _id: tankId }, { tankId }], isActive: true });
  if (!tank) {
    const err = new Error('Tank not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  // Validate user
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    const err = new Error('User not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  if (user.role === 'admin') {
    const err = new Error('Cannot assign tanks to admin users');
    err.statusCode = 400;
    throw err;
  }

  const oldTankId = user.assignedTank?.toString() || null;
  const previousUserId = tank.assignedUser?.toString() || null;

  const action = previousUserId ? 'reassign' : 'assign';

  // Close old assignment record for the tank
  await TankAssignment.updateMany(
    { tank: tank._id, isActive: true },
    { $set: { isActive: false, effectiveTo: new Date() } }
  );

  // If user had a previous tank, unassign from it
  if (oldTankId && oldTankId !== tank._id.toString()) {
    await Tank.findByIdAndUpdate(oldTankId, { $set: { assignedUser: null } });
  }

  // If this tank had a previous user, unassign them
  if (previousUserId && previousUserId !== userId) {
    await User.findByIdAndUpdate(previousUserId, { $set: { assignedTank: null } });
    // Notify previous user via WebSocket
    await notifyTankReassignment(previousUserId, null, tank._id.toString());
  }

  // Create new assignment record
  const previousUser = previousUserId ? await User.findById(previousUserId).lean() : null;
  await TankAssignment.create({
    tank: tank._id,
    tankRef: tank.tankId,
    user: user._id,
    userEmail: user.email,
    assignedBy,
    action,
    previousUser: previousUserId || null,
    previousUserEmail: previousUser?.email || null,
    notes,
    isActive: true,
  });

  // Update tank's assignedUser
  tank.assignedUser = user._id;
  await tank.save();

  // Update user's assignedTank
  user.assignedTank = tank._id;
  await user.save();

  // Notify new user via WebSocket
  await notifyTankReassignment(user._id.toString(), tank._id.toString(), oldTankId);

  return {
    tank: await Tank.findById(tank._id).populate('assignedUser', 'name email').lean(),
    user: await User.findById(user._id).populate('assignedTank', 'tankId name').lean(),
    action,
  };
};

/**
 * Unassign a user from their tank.
 */
const unassignTank = async ({ tankId, assignedBy, notes = '' }) => {
  const tank = await Tank.findOne({ $or: [{ _id: tankId }, { tankId }] });
  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }

  const previousUserId = tank.assignedUser?.toString();
  if (!previousUserId) {
    const err = new Error('Tank has no assigned user');
    err.statusCode = 400;
    throw err;
  }

  const previousUser = await User.findById(previousUserId).lean();

  // Close assignment
  await TankAssignment.updateMany(
    { tank: tank._id, isActive: true },
    { $set: { isActive: false, effectiveTo: new Date() } }
  );

  await TankAssignment.create({
    tank: tank._id,
    tankRef: tank.tankId,
    user: previousUserId,
    userEmail: previousUser?.email || '',
    assignedBy,
    action: 'unassign',
    notes,
    isActive: false,
    effectiveTo: new Date(),
  });

  // Clear references
  await Tank.findByIdAndUpdate(tank._id, { $set: { assignedUser: null } });
  await User.findByIdAndUpdate(previousUserId, { $set: { assignedTank: null } });

  // Notify user
  await notifyTankReassignment(previousUserId, null, tank._id.toString());

  return { tankId: tank.tankId, unassignedUserId: previousUserId };
};

/**
 * Get assignment history for a tank.
 */
const getAssignmentHistory = async (tankId) => {
  const tank = await Tank.findOne({ $or: [{ _id: tankId }, { tankId }] }).lean();
  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }

  return TankAssignment.find({ tank: tank._id })
    .populate('user', 'name email')
    .populate('assignedBy', 'name email')
    .populate('previousUser', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};

module.exports = {
  createTank,
  getAllTanks,
  getTankById,
  updateTank,
  deleteTank,
  assignTank,
  unassignTank,
  getAssignmentHistory,
};