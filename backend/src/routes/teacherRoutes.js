const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const studentController = require('../controllers/studentController');
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
router.get('/materials/:id/download', materialController.downloadMaterialFile);
router.get('/materials/:id/view', materialController.viewMaterialFile);
router.get('/materials/:id/file', materialController.downloadMaterialFile);

router.get('/classes', teacherController.getAssignedClasses);
router.get('/classes/:sectionId/students', teacherController.getClassStudents);
router.get('/grades', teacherController.getGradeRecords);
router.post('/grades', teacherController.updateStudentGrade);
router.get('/assignments', teacherController.getAssignments);
router.post('/assignments', upload.single('file'), teacherController.createAssignment);
router.delete('/assignments/:id', teacherController.deleteAssignment);
router.get('/assignments/:id/download', studentController.downloadAssignmentFile);
router.get('/assignments/:id/view', studentController.viewAssignmentFile);
router.get('/assignments/:id/students', teacherController.getAssignmentSectionStudents);
router.get('/assignments/:id/groups', teacherController.getAssignmentGroups);
router.get('/assignments/groups/by-code/:code', teacherController.getGroupByCode);
router.get('/assignments/submissions/:groupId/download', studentController.downloadSubmissionFile);
router.get('/assignments/submissions/:groupId/view', studentController.viewSubmissionFile);
router.get('/submissions/:groupId/download', studentController.downloadSubmissionFile);
router.get('/submissions/:groupId/view', studentController.viewSubmissionFile);
router.post('/assignments/groups', teacherController.createAssignmentGroup);
router.post('/assignments/groups/score', teacherController.submitGroupScore);
router.post('/grades/sync-groups', teacherController.syncSectionGroupScores);
router.get('/schedule', teacherController.getTeacherSchedule);

module.exports = router;

