const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Reports are accessible by Admin (and Teachers can view capacity)
router.use(authenticateToken);
router.use(requireRole(['admin', 'teacher']));

router.get('/capacity', reportController.getCapacityReport);
router.get('/promotion', reportController.getPromotionReport);
router.get('/capacity/csv', reportController.exportCapacityCSV);
router.get('/promotion/csv', reportController.exportPromotionCSV);

module.exports = router;
