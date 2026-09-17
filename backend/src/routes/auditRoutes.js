const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Audit logs are restricted to Admin
router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/', auditController.getAuditLogs);
router.put('/:id', auditController.updateAuditLog);
router.delete('/clear-all', auditController.clearAuditLogs);
router.delete('/:id', auditController.deleteAuditLog);

module.exports = router;
