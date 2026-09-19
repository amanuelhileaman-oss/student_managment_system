const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Resilient file upload handler for registration: accepts 'file', 'document', or 'grade8Document'
const handleStudentDocUpload = (req, res, next) => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'grade8Document', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      req.file = req.files['file']?.[0] || req.files['document']?.[0] || req.files['grade8Document']?.[0] || null;
    }
    next();
  });
};

router.post('/login', authController.login);
router.post('/register/student', handleStudentDocUpload, authController.registerStudent);
router.post('/register/teacher', authController.registerTeacher);
router.get('/check-prerequisite/:studentId', authController.checkPrerequisite);
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;

