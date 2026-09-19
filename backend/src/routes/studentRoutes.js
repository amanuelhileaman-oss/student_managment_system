const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const materialController = require('../controllers/materialController');
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All student routes require student role
router.use(authenticateToken);
router.use(requireRole(['student']));

const upload = require('../middleware/upload');

// Student Personal Attendance Overview
router.get('/attendance', attendanceController.getMyStudentAttendance);

// Learning Materials & Digital Library
router.get('/materials', materialController.getStudentMaterials);
router.post('/materials/:id/download', materialController.trackDownload);
router.get('/materials/:id/download', materialController.downloadMaterialFile);
router.get('/materials/:id/view', materialController.viewMaterialFile);
router.get('/materials/:id/file', materialController.downloadMaterialFile);

router.get('/prerequisite-status', studentController.getPrerequisiteStatus);
router.get('/progression-eligibility', studentController.getProgressionEligibility);
router.get('/stream-eligibility', studentController.getStreamEligibility);
router.get('/available-sections', studentController.getAvailableSections);
router.post('/enroll', studentController.enroll);
router.get('/results', studentController.getMyResults);
router.get('/assignments', studentController.getMyAssignments);
router.post('/assignments/submit', upload.single('file'), studentController.submitGroupAssignment);

// Assignment question document download & preview
router.get('/assignments/:id/download', studentController.downloadAssignmentFile);
router.get('/assignments/:id/view', studentController.viewAssignmentFile);

// Submission document download & preview
router.get('/submissions/:groupId/download', studentController.downloadSubmissionFile);
router.get('/submissions/:groupId/view', studentController.viewSubmissionFile);
router.get('/assignments/submissions/:groupId/download', studentController.downloadSubmissionFile);
router.get('/assignments/submissions/:groupId/view', studentController.viewSubmissionFile);

router.get('/schedule', studentController.getMySchedule);

module.exports = router;
