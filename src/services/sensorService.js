'use strict';

const SensorData = require('../models/SensorData');
const Tank = require('../models/Tank');
const { emitSensorUpdate } = require('../socket/socketManager');

/**
 * Ingest a sensor reading for a tank.
 * - Validates tank exists and is active
 * - Stores reading in SensorData collection
 * - Updates tank's latestReading snapshot
 * - Emits WebSocket event to subscribed clients
 */
const ingestReading = async ({
  tankId,
  flowRate,
  efmReading,
  totalizer,
  pressure = null,
  temperature = null,
  deviceId = null,
  source = 'device',
}) => {
  // Resolve tank by custom tankId string or ObjectId
  const tank = await Tank.findOne({
    $or: [{ tankId }, { _id: tankId.match(/^[0-9a-fA-F]{24}$/) ? tankId : null }],
    isActive: true,
  }).lean();

  if (!tank) {
    const err = new Error(`Tank not found: ${tankId}`);
    err.statusCode = 404;
    throw err;
  }

  const timestamp = new Date();

  // Persist sensor reading
  const sensorData = await SensorData.create({
    tankId: tank._id,
    tankRef: tank.tankId,
    flowRate,
    efmReading,
    totalizer,
    pressure,
    temperature,
    source,
    deviceId,
    assignedUser: tank.assignedUser || null,
    timestamp,
  });

  // Update tank's denormalized latestReading for fast dashboard reads
  await Tank.findByIdAndUpdate(tank._id, {
    $set: {
      'latestReading.flowRate': flowRate,
      'latestReading.efmReading': efmReading,
      'latestReading.totalizer': totalizer,
      'latestReading.timestamp': timestamp,
    },
  });

  // Emit real-time update via WebSocket
  const wsPayload = {
    flowRate,
    efmReading,
    totalizer,
    pressure,
    temperature,
    timestamp: timestamp.toISOString(),
    source,
    deviceId,
    assignedUser: tank.assignedUser,
    readingId: sensorData._id,
  };

  emitSensorUpdate(tank._id.toString(), tank.tankId, wsPayload);

  return { sensorData, tank: { _id: tank._id, tankId: tank.tankId, name: tank.name } };
};

/**
 * Get sensor history for a tank with optional filtering.
 */
const getHistory = async ({
  tankId,
  startDate,
  endDate,
  page = 1,
  limit = 50,
  userRole,
  userId,
} = {}) => {
  // Resolve tank
  const tank = await Tank.findOne({
    $or: [{ tankId }, { _id: tankId.match(/^[0-9a-fA-F]{24}$/) ? tankId : null }],
  }).lean();

  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }

  // Authorization check: non-admin users can only see their assigned tank
  if (userRole !== 'admin') {
    const assignedTankId = tank.assignedUser?.toString();
    if (assignedTankId !== userId) {
      const err = new Error('Not authorized to access this tank data');
      err.statusCode = 403;
      throw err;
    }
  }

  // Build query
  const filter = { tankId: tank._id };
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    SensorData.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SensorData.countDocuments(filter),
  ]);

  return { records, total, page: parseInt(page), limit: parseInt(limit), tank: { _id: tank._id, tankId: tank.tankId, name: tank.name } };
};

/**
 * Get aggregated stats for a tank.
 */
const getStats = async ({ tankId, startDate, endDate }) => {
  const tank = await Tank.findOne({
    $or: [{ tankId }, { _id: tankId.match(/^[0-9a-fA-F]{24}$/) ? tankId : null }],
  }).lean();

  if (!tank) {
    const err = new Error('Tank not found');
    err.statusCode = 404;
    throw err;
  }

  const matchStage = { tankId: tank._id };
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }

  const stats = await SensorData.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        avgFlowRate: { $avg: '$flowRate' },
        maxFlowRate: { $max: '$flowRate' },
        minFlowRate: { $min: '$flowRate' },
        avgEfmReading: { $avg: '$efmReading' },
        maxEfmReading: { $max: '$efmReading' },
        totalReadings: { $sum: 1 },
        latestTotalizer: { $last: '$totalizer' },
        earliestTotalizer: { $first: '$totalizer' },
        firstReading: { $min: '$timestamp' },
        lastReading: { $max: '$timestamp' },
      },
    },
    {
      $addFields: {
        netConsumption: { $subtract: ['$latestTotalizer', '$earliestTotalizer'] },
      },
    },
  ]);

  return {
    tank: { _id: tank._id, tankId: tank.tankId, name: tank.name },
    stats: stats[0] || null,
    latestReading: tank.latestReading,
  };
};

/**
 * Get data for the currently assigned user's tank.
 */
const getMyTankData = async (userId, { page = 1, limit = 50, startDate, endDate } = {}) => {
  const User = require('../models/User');
  const user = await User.findById(userId).populate('assignedTank').lean();

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (!user.assignedTank) {
    const err = new Error('No tank assigned to your account');
    err.statusCode = 404;
    throw err;
  }

  const tank = user.assignedTank;

  const filter = { tankId: tank._id };
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    SensorData.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SensorData.countDocuments(filter),
  ]);

  return {
    tank: {
      _id: tank._id,
      tankId: tank.tankId,
      name: tank.name,
      latestReading: tank.latestReading,
    },
    records,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

module.exports = { ingestReading, getHistory, getStats, getMyTankData };