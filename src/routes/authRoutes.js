'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/auth');
const { loginValidator, registerValidator } = require('../middleware/validators');

// POST /auth/login
router.post('/login', loginValidator, ctrl.login);

// POST /auth/register  (admin only)
router.post('/register', protect, restrictTo('admin'), registerValidator, ctrl.register);

// GET /auth/profile  (own profile)
router.get('/profile', protect, ctrl.getProfile);

// GET /auth/users  (admin: list all users)
router.get('/users', protect, restrictTo('admin'), ctrl.listUsers);

// GET /auth/users/:id  (admin: get specific user)
router.get('/users/:id', protect, restrictTo('admin'), ctrl.getUserById);

// PATCH /auth/users/:id  (admin: update user)
router.patch('/users/:id', protect, restrictTo('admin'), ctrl.updateUser);

module.exports = router;