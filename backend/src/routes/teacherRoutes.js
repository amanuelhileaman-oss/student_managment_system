const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const materialController = require('../controllers/materialController');
const materialUpload = require('../middleware/materialUpload');
const upload = require('../middleware/upload');
const { authenticateToken, requireRole } = require('../middleware/auth');

const attendanceController = require('../controllers/attendanceController');

// All teacher routes require teacher role
router.use(authenticateToken);
router.use(requireRole(['teacher']));

// Student Attendance Management
router.get('/attendance', attendanceController.getSectionAttendance);
router.post('/attendance', attendanceController.saveSectionAttendance);
router.get('/attendance/history', attendanceController.getAttendanceHistory);

// Study Materials & Digital Library
router.get('/materials/options', materialController.getTeacherUploadOptions);
router.get('/materials', materialController.getTeacherMaterials);
router.post('/materials', materialUpload.single('file'), materialController.uploadMaterial);
router.put('/materials/:id', materialController.updateMaterial);
router.delete('/materials/:id', materialController.deleteMaterial);

router.get('/classes', teacherController.getAssignedClasses);
router.get('/classes/:sectionId/students', teacherController.getClassStudents);
router.get('/grades', teacherController.getGradeRecords);
router.post('/grades', teacherController.updateStudentGrade);
router.get('/assignments', teacherController.getAssignments);
router.post('/assignments', upload.single('file'), teacherController.createAssignment);
router.delete('/assignments/:id', teacherController.deleteAssignment);
router.get('/assignments/:id/students', teacherController.getAssignmentSectionStudents);
router.get('/assignments/:id/groups', teacherController.getAssignmentGroups);
router.get('/assignments/groups/by-code/:code', teacherController.getGroupByCode);
router.post('/assignments/groups', teacherController.createAssignmentGroup);
router.post('/assignments/groups/score', teacherController.submitGroupScore);
router.post('/grades/sync-groups', teacherController.syncSectionGroupScores);
router.get('/schedule', teacherController.getTeacherSchedule);

module.exports = router;

