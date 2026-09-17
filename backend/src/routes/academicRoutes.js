const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');

router.get('/grades', academicController.getGrades);
router.get('/streams', academicController.getStreams);
router.get('/subjects', academicController.getSubjects);
router.get('/sections', academicController.getSections);
router.get('/years', academicController.getAcademicYears);
router.get('/stream-criteria', academicController.getStreamCriteria);

module.exports = router;
