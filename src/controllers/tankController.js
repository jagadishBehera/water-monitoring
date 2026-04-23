'use strict';

const tankService = require('../services/tankService');
const { success, created, paginated } = require('../utils/response');

const createTank = async (req, res, next) => {
  try {
    const tank = await tankService.createTank(req.body);
    return created(res, { tank }, 'Tank created successfully');
  } catch (err) {
    next(err);
  }
};

const getAllTanks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const filter = {};
    if (typeof isActive !== 'undefined') filter.isActive = isActive === 'true';
    const { tanks, total } = await tankService.getAllTanks({ page, limit, ...filter });
    return paginated(res, tanks, total, page, limit, 'Tanks fetched');
  } catch (err) {
    next(err);
  }
};

const getTank = async (req, res, next) => {
  try {
    const tank = await tankService.getTankById(req.params.id);
    return success(res, { tank });
  } catch (err) {
    next(err);
  }
};

const updateTank = async (req, res, next) => {
  try {
    const tank = await tankService.updateTank(req.params.id, req.body);
    return success(res, { tank }, 'Tank updated');
  } catch (err) {
    next(err);
  }
};

const deleteTank = async (req, res, next) => {
  try {
    await tankService.deleteTank(req.params.id);
    return success(res, null, 'Tank deactivated successfully');
  } catch (err) {
    next(err);
  }
};

const assignTank = async (req, res, next) => {
  try {
    const { tankId, userId, notes } = req.body;
    const result = await tankService.assignTank({ tankId, userId, assignedBy: req.user._id, notes });
    return success(res, result, `Tank ${result.action}ed successfully`);
  } catch (err) {
    next(err);
  }
};

const unassignTank = async (req, res, next) => {
  try {
    const { tankId, notes } = req.body;
    const result = await tankService.unassignTank({ tankId, assignedBy: req.user._id, notes });
    return success(res, result, 'Tank unassigned');
  } catch (err) {
    next(err);
  }
};

const getAssignmentHistory = async (req, res, next) => {
  try {
    const history = await tankService.getAssignmentHistory(req.params.id);
    return success(res, { history }, 'Assignment history fetched');
  } catch (err) {
    next(err);
  }
};

const getMyTank = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id)
      .populate('assignedTank', 'tankId name description location capacity latestReading isActive')
      .lean();
    if (!user.assignedTank) {
      return require('../utils/response').notFound(res, 'No tank assigned to your account');
    }
    return success(res, { tank: user.assignedTank });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTank, getAllTanks, getTank, updateTank, deleteTank,
  assignTank, unassignTank, getAssignmentHistory, getMyTank,
};