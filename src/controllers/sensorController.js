'use strict';

const sensorService = require('../services/sensorService');
const { success, created, paginated } = require('../utils/response');

/**
 * POST /sensor/ingest
 * Accepts incoming device data, stores and broadcasts it.
 */
const ingest = async (req, res, next) => {
  try {
    const { tankId, flowRate, efmReading, totalizer, pressure, temperature, deviceId, source } = req.body;
    const result = await sensorService.ingestReading({
      tankId, flowRate, efmReading, totalizer,
      pressure, temperature, deviceId, source,
    });
    return created(res, { reading: result.sensorData, tank: result.tank }, 'Sensor data ingested');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sensor/history/:tankId
 * Returns paginated historical sensor data for a tank.
 * Admin: any tank. User: only their assigned tank.
 */
const getHistory = async (req, res, next) => {
  try {
    const { tankId } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const result = await sensorService.getHistory({
      tankId, page, limit, startDate, endDate,
      userRole: req.user.role,
      userId: req.user._id.toString(),
    });
    return paginated(res, result.records, result.total, result.page, result.limit, 'History fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sensor/stats/:tankId
 * Returns aggregated stats for a tank.
 */
const getStats = async (req, res, next) => {
  try {
    const { tankId } = req.params;
    const { startDate, endDate } = req.query;
    const result = await sensorService.getStats({ tankId, startDate, endDate });
    return success(res, result, 'Stats fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sensor/my-tank
 * User-facing: get latest + history for their assigned tank.
 */
const getMyTankData = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const result = await sensorService.getMyTankData(req.user._id, { page, limit, startDate, endDate });
    return paginated(res, result.records, result.total, result.page, result.limit, 'Tank data fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tanks/:id/data  (convenience alias used in spec)
 * Returns the latest reading for a specific tank.
 */
const getTankLatestData = async (req, res, next) => {
  try {
    const tankService = require('../services/tankService');
    const tank = await tankService.getTankById(req.params.id);

    // Authorization: user can only see their tank
    if (req.user.role !== 'admin') {
      const assignedId = tank.assignedUser?._id?.toString() || tank.assignedUser?.toString();
      if (assignedId !== req.user._id.toString()) {
        return require('../utils/response').forbidden(res, 'Access denied to this tank');
      }
    }
    return success(res, { tank, latestReading: tank.latestReading }, 'Latest data fetched');
  } catch (err) {
    next(err);
  }
};

module.exports = { ingest, getHistory, getStats, getMyTankData, getTankLatestData };