const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, searchController.globalSearch);

module.exports = router;
