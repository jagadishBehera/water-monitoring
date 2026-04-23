'use strict';

const { validationResult, body, param, query } = require('express-validator');
const { badRequest } = require('../utils/response');

/**
 * Run validation result check. Must be placed after validator chain.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Validation failed', errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    })));
  }
  next();
};

// ─── Auth Validators ────────────────────────────────────────────────────────

const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and a number'),
  body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  validate,
];

// ─── Tank Validators ─────────────────────────────────────────────────────────

const createTankValidator = [
  body('name').trim().notEmpty().withMessage('Tank name is required').isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('location').optional().trim(),
  body('capacity').optional().isFloat({ min: 0 }).withMessage('Capacity must be a positive number'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  validate,
];

const updateTankValidator = [
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('location').optional().trim(),
  body('capacity').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
  body('metadata').optional().isObject(),
  validate,
];

const assignTankValidator = [
  body('tankId').notEmpty().withMessage('tankId is required'),
  body('userId').notEmpty().withMessage('userId is required'),
  body('notes').optional().trim().isLength({ max: 300 }),
  validate,
];

// ─── Sensor Validators ────────────────────────────────────────────────────────

const ingestValidator = [
  body('tankId').notEmpty().withMessage('tankId is required'),
  body('flowRate').isFloat({ min: 0 }).withMessage('flowRate must be a non-negative number'),
  body('efmReading').isFloat({ min: 0 }).withMessage('efmReading must be a non-negative number'),
  body('totalizer').isFloat({ min: 0 }).withMessage('totalizer must be a non-negative number'),
  body('pressure').optional().isFloat(),
  body('temperature').optional().isFloat(),
  body('deviceId').optional().trim(),
  validate,
];

// ─── Query Validators ─────────────────────────────────────────────────────────

const historyQueryValidator = [
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO8601 date'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  validate,
];

module.exports = {
  validate,
  loginValidator,
  registerValidator,
  createTankValidator,
  updateTankValidator,
  assignTankValidator,
  ingestValidator,
  historyQueryValidator,
};