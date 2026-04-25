'use strict';

const authService = require('../services/authService');
const { success, created, error } = require('../utils/response');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await authService.register({ name, email, password, role });
    return created(res, result, 'User registered successfully');
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user._id);
    return success(res, { user }, 'Profile fetched');
  } catch (err) {
    next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { page = 1, limit = 20, role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('assignedTank', 'tankId name location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(filter),
    ]);
    return success(res, { users, total, page: parseInt(page), limit: parseInt(limit) }, 'Users fetched');
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.params.id);
    return success(res, { user });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const allowed = ['name', 'isActive'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!user) return require('../utils/response').notFound(res, 'User not found');
    return success(res, { user }, 'User updated');
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return require('../utils/response').error(res, 'Email is required', 400);
    }
    const result = await authService.forgotPassword(email);
    return success(res, result, 'OTP sent if account exists');
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return require('../utils/response').error(res, 'Email, OTP, and newPassword are required', 400);
    }
    const result = await authService.resetPassword(email, otp, newPassword);
    return success(res, result, 'Password reset successful');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, getProfile, listUsers, getUserById, updateUser, forgotPassword, resetPassword };