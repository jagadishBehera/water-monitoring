'use strict';

const User = require('../models/User');
const { signToken, buildPayload } = require('../utils/jwt');

/**
 * Authenticate a user by email + password.
 * Returns { user, token } on success, throws on failure.
 */
const login = async (email, password) => {
  // Fetch user with password field
  const user = await User.findOne({ email, isActive: true }).select('+password');

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  // Update last login
  await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

  const token = signToken(buildPayload(user));
  const safeUser = user.toSafeObject();

  return { user: safeUser, token };
};

/**
 * Register a new user (admin-only operation).
 */
const register = async ({ name, email, password, role = 'user' }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const user = await User.create({ name, email, password, role });
  const token = signToken(buildPayload(user));

  return { user: user.toSafeObject(), token };
};

/**
 * Get user profile by ID.
 */
const getProfile = async (userId) => {
  const user = await User.findById(userId)
    .populate('assignedTank', 'tankId name location latestReading isActive')
    .lean();

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return user;
};

module.exports = { login, register, getProfile };