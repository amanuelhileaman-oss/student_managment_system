const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getPlatformStats,
  getSchools,
  createSchool,
  updateSchoolStatus,
  extendSchoolSubscription,
  deleteSchool,
  getActionSchools,
  issueSchoolWarning,
  suspendSchoolForBreach,
  restoreSchoolStanding,
  safeDeleteSchool,
  performSystemCleanup,
  getDisciplinaryLogs,
} = require('../controllers/superAdminController');

// All Super Admin endpoints strictly require valid JWT and 'superadmin' role
router.use(authenticateToken);
router.use(requireRole(['superadmin']));

router.get('/stats', getPlatformStats);
router.get('/schools', getSchools);
router.post('/schools', createSchool);
router.patch('/schools/:id/status', updateSchoolStatus);
router.put('/schools/:id/status', updateSchoolStatus);
router.post('/schools/:id/extend-subscription', extendSchoolSubscription);
router.delete('/schools/:id', deleteSchool);
router.delete('/schools/:id/safe-delete', safeDeleteSchool);

// Disciplinary Actions & System Cleanup Endpoints
router.get('/actions/schools', getActionSchools);
router.post('/actions/schools/:id/warn', issueSchoolWarning);
router.post('/actions/schools/:id/suspend', suspendSchoolForBreach);
router.post('/actions/schools/:id/restore', restoreSchoolStanding);
router.delete('/actions/schools/:id', safeDeleteSchool);
router.post('/actions/cleanup', performSystemCleanup);
router.get('/actions/logs', getDisciplinaryLogs);

module.exports = router;
