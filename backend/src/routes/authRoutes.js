const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register/student', authController.registerStudent);
router.post('/register/teacher', authController.registerTeacher);
router.get('/check-prerequisite/:studentId', authController.checkPrerequisite);
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;
