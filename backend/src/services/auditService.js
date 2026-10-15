const { query } = require('../config/db');

/**
 * Log an administrative, academic, platform, or security action to PostgreSQL audit_logs table
 */
const logAudit = async ({ schoolId = null, userId = null, action, entityType, entityId = null, details = {}, ipAddress = null }) => {
  try {
    let effectiveSchoolId = schoolId;
    if (!effectiveSchoolId && userId) {
      const uRes = await query('SELECT school_id FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length > 0) {
        effectiveSchoolId = uRes.rows[0].school_id || null;
      }
    }

    await query(
      `INSERT INTO audit_logs (school_id, user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [effectiveSchoolId, userId, action, entityType, entityId ? String(entityId) : null, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error('[AUDIT LOG FAILED]', error);
  }
};

module.exports = {
  logAudit,
};
