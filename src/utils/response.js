'use strict';

/**
 * Standardized API response helpers.
 * All responses follow: { success, message, data?, meta?, error? }
 */

const success = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  if (meta !== null) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const created = (res, data = null, message = 'Resource created successfully') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'An error occurred', statusCode = 500, details = null) => {
  const payload = { success: false, message };
  if (details && process.env.NODE_ENV !== 'production') payload.details = details;
  return res.status(statusCode).json(payload);
};

const unauthorized = (res, message = 'Authentication required') => {
  return error(res, message, 401);
};

const forbidden = (res, message = 'Access denied') => {
  return error(res, message, 403);
};

const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404);
};

const badRequest = (res, message = 'Bad request', details = null) => {
  return error(res, message, 400, details);
};

const paginated = (res, data, total, page, limit, message = 'Success') => {
  return success(res, data, message, 200, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  });
};

module.exports = { success, created, error, unauthorized, forbidden, notFound, badRequest, paginated };