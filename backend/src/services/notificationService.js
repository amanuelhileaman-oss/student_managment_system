const { query } = require('../config/db');

/**
 * Send an in-app notification to a specific user
 * @param {Object} params
 * @param {number} params.userId - Target user ID
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body text
 * @param {string} [params.type='SYSTEM'] - Notification type ('ANNOUNCEMENT', 'MESSAGE', 'DOCUMENT_REVIEW', 'SCHEDULE', 'RESULT', 'ENROLLMENT', 'SYSTEM')
 * @param {string} [params.link=null] - Frontend route destination link
 */
const sendNotification = async ({ userId, title, message, type = 'SYSTEM', link = null }) => {
  if (!userId || !title || !message) return null;
  try {
    const res = await query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, title.trim(), message.trim(), type, link]
    );
    return res.rows[0];
  } catch (err) {
    console.error(`[NotificationService] Error sending notification to user ${userId}:`, err.message);
    return null;
  }
};

/**
 * Broadcast an in-app notification to multiple users or roles
 * @param {Object} params
 * @param {string[]} [params.roles] - Target roles (e.g. ['student', 'teacher', 'admin'])
 * @param {number[]} [params.userIds] - Explicit array of target user IDs
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification body text
 * @param {string} [params.type='ANNOUNCEMENT'] - Notification type
 * @param {string} [params.link=null] - Frontend route link
 */
const broadcastNotification = async ({ roles = [], userIds = [], title, message, type = 'ANNOUNCEMENT', link = null }) => {
  if (!title || !message) return [];
  try {
    let targetUsers = [];
    if (userIds.length > 0) {
      const idPlaceholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
      const res = await query(
        `SELECT id, role FROM users WHERE id IN (${idPlaceholders}) AND is_active = TRUE`,
        userIds
      );
      targetUsers = res.rows;
    } else if (roles.length > 0) {
      const rolePlaceholders = roles.map((_, i) => `$${i + 1}`).join(', ');
      const res = await query(
        `SELECT id, role FROM users WHERE role IN (${rolePlaceholders}) AND is_active = TRUE`,
        roles
      );
      targetUsers = res.rows;
    }

    if (targetUsers.length === 0) return [];

    // Batch insert notifications
    const values = [];
    const placeholders = [];
    let pIdx = 1;

    for (const u of targetUsers) {
      let resolvedLink = link;
      if (!resolvedLink || type === 'ANNOUNCEMENT') {
        resolvedLink =
          u.role === 'admin'
            ? '/admin/announcements'
            : u.role === 'teacher'
            ? '/teacher/dashboard'
            : '/student/dashboard';
      }

      placeholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      values.push(u.id, title.trim(), message.trim(), type, resolvedLink);
    }

    const insertSql = `
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES ${placeholders.join(', ')}
      RETURNING id, user_id
    `;
    const res = await query(insertSql, values);
    return res.rows;
  } catch (err) {
    console.error('[NotificationService] Error broadcasting notification:', err.message);
    return [];
  }
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const res = await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [notificationId, userId]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error('[NotificationService] Error marking notification read:', err.message);
    return false;
  }
};

/**
 * Mark all unread notifications for a user as read
 */
const markAllAsRead = async (userId) => {
  try {
    const res = await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE RETURNING id`,
      [userId]
    );
    return res.rows.length;
  } catch (err) {
    console.error('[NotificationService] Error marking all notifications read:', err.message);
    return 0;
  }
};

/**
 * Delete a specific notification
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const res = await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error('[NotificationService] Error deleting notification:', err.message);
    return false;
  }
};

/**
 * Clear all notifications for a user
 */
const clearAllNotifications = async (userId) => {
  try {
    const res = await query(`DELETE FROM notifications WHERE user_id = $1 RETURNING id`, [userId]);
    return res.rows.length;
  } catch (err) {
    console.error('[NotificationService] Error clearing notifications:', err.message);
    return 0;
  }
};

module.exports = {
  sendNotification,
  broadcastNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};
