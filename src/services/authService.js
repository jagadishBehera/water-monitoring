'use strict';

const User = require('../models/User');
const { signToken, buildPayload } = require('../utils/jwt');
const { sendResetOTPEmail } = require('./emailService');

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

/**
 * Generate a random 6-digit OTP.
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send password reset OTP to user's email.
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email, isActive: true });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'If an account exists, an OTP will be sent to the email' };
  }

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.resetOTP = otp;
  user.resetOTPExpires = otpExpires;
  await user.save();

  // Send OTP via email
  await sendResetOTPEmail(email, otp);

  return { message: 'If an account exists, an OTP will be sent to the email' };
};

/**
 * Reset password using OTP.
 */
const resetPassword = async (email, otp, newPassword) => {
  const user = await User.findOne({ email, isActive: true })
    .select('+resetOTP +resetOTPExpires');

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  // Check if OTP exists
  if (!user.resetOTP || !user.resetOTPExpires) {
    const err = new Error('No OTP requested. Request password reset first.');
    err.statusCode = 400;
    throw err;
  }

  // Check if OTP is expired
  if (new Date() > user.resetOTPExpires) {
    const err = new Error('OTP expired. Please request a new OTP.');
    err.statusCode = 400;
    throw err;
  }

  // Verify OTP
  if (user.resetOTP !== otp) {
    const err = new Error('Invalid OTP');
    err.statusCode = 401;
    throw err;
  }

  // Update password
  user.password = newPassword;
  user.resetOTP = null;
  user.resetOTPExpires = null;
  await user.save();

  return { message: 'Password reset successful' };
};

module.exports = { login, register, getProfile, forgotPassword, resetPassword };