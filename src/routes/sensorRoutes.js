'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/sensorController');
const { protect, restrictTo } = require('../middleware/auth');
const { ingestValidator, historyQueryValidator } = require('../middleware/validators');

// POST /sensor/ingest  → device sends data (secured by JWT; use a device token in production)
router.post('/ingest', protect, ingestValidator, ctrl.ingest);

// GET /sensor/my-tank  → user gets their own tank's sensor history
router.get('/my-tank', protect, restrictTo('user'), historyQueryValidator, ctrl.getMyTankData);

// GET /sensor/history/:tankId  → admin or authorized user gets sensor history
router.get('/history/:tankId', protect, historyQueryValidator, ctrl.getHistory);

// GET /sensor/stats/:tankId  → aggregated stats
router.get('/stats/:tankId', protect, restrictTo('admin'), ctrl.getStats);

module.exports = router;