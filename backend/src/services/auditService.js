const { query } = require('../config/db');

/**
 * Log an administrative, academic, or security action to PostgreSQL audit_logs table
 */
const logAudit = async ({ userId = null, action, entityType, entityId = null, details = {}, ipAddress = null }) => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId ? String(entityId) : null, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error('[AUDIT LOG FAILED]', error);
  }
};

module.exports = {
  logAudit,
};
