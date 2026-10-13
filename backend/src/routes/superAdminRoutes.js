const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getPlatformStats,
  getSchools,
  createSchool,
  updateSchoolStatus,
  deleteSchool,
} = require('../controllers/superAdminController');

// All Super Admin endpoints strictly require valid JWT and 'superadmin' role
router.use(authenticateToken);
router.use(requireRole(['superadmin']));

router.get('/stats', getPlatformStats);
router.get('/schools', getSchools);
router.post('/schools', createSchool);
router.patch('/schools/:id/status', updateSchoolStatus);
router.delete('/schools/:id', deleteSchool);

module.exports = router;
