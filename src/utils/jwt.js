'use strict';

const jwt = require('jsonwebtoken');

/**
 * Sign a JWT token for a given user payload.
 */
const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'water-monitoring-system',
    audience: 'water-monitoring-client',
  });
};

/**
 * Verify a JWT token and return decoded payload.
 * Throws if invalid or expired.
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'water-monitoring-system',
    audience: 'water-monitoring-client',
  });
};

/**
 * Extract token from Authorization header.
 * Supports "Bearer <token>" format.
 */
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
};

/**
 * Build a standardized JWT payload from a user document.
 */
const buildPayload = (user) => ({
  sub: user._id.toString(),
  email: user.email,
  role: user.role,
  name: user.name,
});

module.exports = { signToken, verifyToken, extractToken, buildPayload };