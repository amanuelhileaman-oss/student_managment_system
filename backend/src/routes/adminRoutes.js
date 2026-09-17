const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const scheduleController = require('../controllers/scheduleController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All admin routes strictly require admin role
router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/analytics', adminController.getAnalytics);
router.get('/users', adminController.getUsers);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);
router.patch('/users/:userId/toggle-status', adminController.toggleUserStatus);

router.post('/sections', adminController.createSection);
router.put('/sections/:sectionId', adminController.updateSection);
router.delete('/sections/:sectionId', adminController.deleteSection);
router.patch('/sections/:sectionId/capacity', adminController.updateSectionCapacity);

router.get('/teacher-assignments', adminController.getTeacherAssignments);
router.post('/teacher-assignments', adminController.createTeacherAssignment);
router.put('/teacher-assignments/:id', adminController.updateTeacherAssignment);
router.delete('/teacher-assignments/:id', adminController.deleteTeacherAssignment);

// Academic Subjects & Curriculum Management
router.post('/subjects', adminController.createSubject);
router.put('/subjects/:id', adminController.updateSubject);
router.delete('/subjects/:id', adminController.deleteSubject);

router.patch('/stream-criteria/:criteriaId', adminController.updateStreamCriteria);
router.get('/documents', adminController.getStudentDocuments);
router.post('/documents/:studentId/review', adminController.reviewStudentDocument);
router.get('/prerequisites', adminController.getPrerequisites);
router.post('/prerequisites', adminController.createPrerequisite);

// Master School Scheduling & Conflict Management Routes
router.get('/schedules', scheduleController.getSchedules);
router.get('/schedules/standard-periods', scheduleController.getStandardPeriods);
router.post('/schedules/validate', scheduleController.validateSlot);
router.post('/schedules', scheduleController.createScheduleSlot);
router.put('/schedules/:id', scheduleController.updateScheduleSlot);
router.delete('/schedules/all', scheduleController.deleteAllSchedules);
router.delete('/schedules/section/:sectionId', scheduleController.deleteSectionSchedules);
router.delete('/schedules/:id', scheduleController.deleteScheduleSlot);
router.post('/schedules/generate-section', scheduleController.generateSectionSchedule);
router.post('/schedules/generate-master', scheduleController.generateMasterSchedule);
router.get('/schedules/conflicts', scheduleController.getScheduleAudit);

// Institutional System Settings & Academic Parameters
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;


