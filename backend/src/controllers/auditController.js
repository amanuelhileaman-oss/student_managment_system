const { query } = require('../config/db');

/**
 * Retrieve audit logs with filtering and pagination
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT al.*, u.email, u.role, u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      params.push(action);
      sql += ` AND al.action = $${params.length}`;
    }
    if (entityType) {
      params.push(entityType);
      sql += ` AND al.entity_type = $${params.length}`;
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);
    const countRes = await query('SELECT COUNT(*) FROM audit_logs');

    res.json({
      success: true,
      data: result.rows,
      totalCount: parseInt(countRes.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an audit log record
 */
const updateAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, entityType, entityId, details } = req.body;

    const checkRes = await query('SELECT * FROM audit_logs WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Audit log record not found.' });
    }

    const current = checkRes.rows[0];
    const newAction = action || current.action;
    const newEntityType = entityType !== undefined ? entityType : current.entity_type;
    const newEntityId = entityId !== undefined ? entityId : current.entity_id;
    let newDetails = current.details;
    if (details !== undefined) {
      newDetails = typeof details === 'object' ? details : { note: String(details) };
    }

    const updateRes = await query(
      `UPDATE audit_logs
       SET action = $1, entity_type = $2, entity_id = $3, details = $4
       WHERE id = $5
       RETURNING *`,
      [newAction, newEntityType, newEntityId, newDetails, id]
    );

    res.json({
      success: true,
      message: 'Audit log record updated successfully.',
      data: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a specific audit log record
 */
const deleteAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const checkRes = await query('SELECT * FROM audit_logs WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Audit log record not found.' });
    }

    await query('DELETE FROM audit_logs WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Audit log record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all audit logs
 */
const clearAuditLogs = async (req, res, next) => {
  try {
    await query('DELETE FROM audit_logs');
    res.json({
      success: true,
      message: 'All audit log records cleared successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  updateAuditLog,
  deleteAuditLog,
  clearAuditLogs,
};
