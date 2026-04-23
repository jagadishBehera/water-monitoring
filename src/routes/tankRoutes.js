'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/tankController');
const sensorCtrl = require('../controllers/sensorController');
const { protect, restrictTo } = require('../middleware/auth');
const {
  createTankValidator,
  updateTankValidator,
  assignTankValidator,
  historyQueryValidator,
} = require('../middleware/validators');

// ─── User Routes ──────────────────────────────────────────────────────────────

// GET /tanks/my  → user gets their own assigned tank
router.get('/my', protect, restrictTo('user'), ctrl.getMyTank);

// GET /tanks/:id/data  → latest sensor reading for a tank (admin + user)
router.get('/:id/data', protect, sensorCtrl.getTankLatestData);

// ─── Admin-Only Routes ────────────────────────────────────────────────────────

// GET /tanks  → list all tanks
router.get('/', protect, restrictTo('admin'), ctrl.getAllTanks);

// POST /tanks  → create a new tank
router.post('/', protect, restrictTo('admin'), createTankValidator, ctrl.createTank);

// POST /tanks/assign  → assign tank to user
router.post('/assign', protect, restrictTo('admin'), assignTankValidator, ctrl.assignTank);

// POST /tanks/reassign  → reassign tank (same endpoint, service handles both)
router.post('/reassign', protect, restrictTo('admin'), assignTankValidator, ctrl.assignTank);

// POST /tanks/unassign  → remove user assignment from tank
router.post('/unassign', protect, restrictTo('admin'), ctrl.unassignTank);

// GET /tanks/:id  → get specific tank
router.get('/:id', protect, restrictTo('admin'), ctrl.getTank);

// PATCH /tanks/:id  → update tank
router.patch('/:id', protect, restrictTo('admin'), updateTankValidator, ctrl.updateTank);

// DELETE /tanks/:id  → soft-delete tank
router.delete('/:id', protect, restrictTo('admin'), ctrl.deleteTank);

// GET /tanks/:id/assignments  → assignment history
router.get('/:id/assignments', protect, restrictTo('admin'), ctrl.getAssignmentHistory);

module.exports = router;