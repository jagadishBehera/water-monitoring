'use strict';

const User = require('../models/User');
const { verifyToken, extractToken } = require('../utils/jwt');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * Protect routes - verify JWT token.
 * Attaches decoded user to req.user.
 */
const protect = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      return unauthorized(res, 'No authentication token provided');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorized(res, 'Token has expired. Please log in again.');
      }
      return unauthorized(res, 'Invalid token. Please log in again.');
    }

    // Fetch fresh user from DB (ensures user still exists and is active)
    const user = await User.findById(decoded.sub).select('-password').lean();

    if (!user) {
      return unauthorized(res, 'User no longer exists.');
    }

    if (!user.isActive) {
      return unauthorized(res, 'Account has been deactivated.');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return unauthorized(res, 'Authentication failed.');
  }
};

/**
 * Restrict access to specific roles.
 * Usage: restrictTo('admin') or restrictTo('admin', 'user')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return forbidden(res, `Access denied. Required role: ${roles.join(' or ')}`);
    }
    next();
  };
};

/**
 * Admin-only shorthand middleware.
 */
const adminOnly = [protect, restrictTo('admin')];

/**
 * Verify that a user can access a specific tank.
 * Admin can access any tank; user can only access their assigned tank.
 */
const canAccessTank = async (req, res, next) => {
  try {
    const { id } = req.params; // tankId param
    if (!id) return next();

    if (req.user.role === 'admin') return next();

    const Tank = require('../models/Tank');
    const tank = await Tank.findOne({
      $or: [{ _id: id }, { tankId: id }],
      isActive: true,
    }).lean();

    if (!tank) {
      const { notFound } = require('../utils/response');
      return notFound(res, 'Tank not found');
    }

    const assignedId = tank.assignedUser?.toString();
    const userId = req.user._id.toString();

    if (assignedId !== userId) {
      return forbidden(res, 'You are not authorized to access this tank.');
    }

    req.tank = tank;
    next();
  } catch (err) {
    console.error('canAccessTank middleware error:', err);
    next(err);
  }
};

module.exports = { protect, restrictTo, adminOnly, canAccessTank };