const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../services/auditService');
const {
  sendNotification,
  broadcastNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} = require('../services/notificationService');

/**
 * Get announcements relevant to authenticated user
 */
const getAnnouncements = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;

    let studentInfo = null;
    if (role === 'student') {
      const sRes = await query('SELECT current_grade_level, current_stream_id, current_section_id FROM students WHERE user_id = $1', [userId]);
      if (sRes.rows.length > 0) studentInfo = sRes.rows[0];
    }

    let sql = `
      SELECT a.*, u.first_name as author_first_name, u.last_name as author_last_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.target_audience = 'ALL'
    `;
    const params = [];

    if (role === 'teacher') {
      sql += " OR a.target_audience = 'TEACHERS'";
    } else if (role === 'student') {
      sql += " OR a.target_audience = 'STUDENTS'";
      if (studentInfo && studentInfo.current_grade_level) {
        params.push(studentInfo.current_grade_level);
        sql += ` OR (a.target_audience = 'GRADE' AND a.target_grade_level = $${params.length})`;
      }
      if (studentInfo && studentInfo.current_stream_id) {
        params.push(studentInfo.current_stream_id);
        sql += ` OR (a.target_audience = 'STREAM' AND a.target_stream_id = $${params.length})`;
      }
      if (studentInfo && studentInfo.current_section_id) {
        params.push(studentInfo.current_section_id);
        sql += ` OR (a.target_audience = 'SECTION' AND a.target_section_id = $${params.length})`;
      }
    } else if (role === 'admin') {
      // Admin sees all announcements
      sql = `
        SELECT a.*, u.first_name as author_first_name, u.last_name as author_last_name
        FROM announcements a
        LEFT JOIN users u ON a.created_by = u.id
      `;
    }

    sql += ' ORDER BY a.created_at DESC LIMIT 50';
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin creates targeted announcement
 */
const createAnnouncement = async (req, res, next) => {
  try {
    const { title, content, targetAudience = 'ALL', targetGradeLevel, targetStreamId, targetSectionId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const insRes = await query(
      `INSERT INTO announcements (created_by, title, content, target_audience, target_grade_level, target_stream_id, target_section_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, title, content, targetAudience, targetGradeLevel || null, targetStreamId || null, targetSectionId || null]
    );

    // Broadcast in-app notifications
    try {
      let targetRoles = [];
      let targetUserIds = [];

      if (targetAudience === 'ALL') {
        targetRoles = ['student', 'teacher', 'admin'];
      } else if (targetAudience === 'TEACHERS') {
        targetRoles = ['teacher'];
      } else if (targetAudience === 'STUDENTS') {
        targetRoles = ['student'];
      } else if (['GRADE', 'STREAM', 'SECTION'].includes(targetAudience)) {
        let filterSql = 'SELECT user_id FROM students WHERE 1=1';
        const filterParams = [];
        if (targetGradeLevel) {
          filterParams.push(targetGradeLevel);
          filterSql += ` AND current_grade_level = $${filterParams.length}`;
        }
        if (targetStreamId) {
          filterParams.push(targetStreamId);
          filterSql += ` AND current_stream_id = $${filterParams.length}`;
        }
        if (targetSectionId) {
          filterParams.push(targetSectionId);
          filterSql += ` AND current_section_id = $${filterParams.length}`;
        }
        const stRes = await query(filterSql, filterParams);
        targetUserIds = stRes.rows.map((r) => r.user_id);
      }

      if (targetRoles.length > 0 || targetUserIds.length > 0) {
        await broadcastNotification({
          roles: targetRoles,
          userIds: targetUserIds,
          title: `Announcement: ${title.slice(0, 50)}`,
          message: content.slice(0, 120),
          type: 'ANNOUNCEMENT',
          link: '/admin/announcements',
        });
      }
    } catch (notifErr) {
      console.warn('[createAnnouncement] Notification broadcast warning:', notifErr.message);
    }

    await logAudit({
      userId: req.user.id,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'ANNOUNCEMENT',
      entityId: insRes.rows[0].id,
      details: { title, targetAudience },
    });

    res.status(201).json({ success: true, message: 'Announcement published successfully.', data: insRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin updates an existing announcement
 */
const updateAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, targetAudience = 'ALL', targetGradeLevel, targetStreamId, targetSectionId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const checkRes = await query('SELECT * FROM announcements WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const updateRes = await query(
      `UPDATE announcements
       SET title = $1,
           content = $2,
           target_audience = $3,
           target_grade_level = $4,
           target_stream_id = $5,
           target_section_id = $6
       WHERE id = $7
       RETURNING *`,
      [title, content, targetAudience, targetGradeLevel || null, targetStreamId || null, targetSectionId || null, id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      details: { title, targetAudience },
    });

    res.json({
      success: true,
      message: 'Announcement updated successfully.',
      data: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin deletes an existing announcement
 */
const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;

    const checkRes = await query('SELECT * FROM announcements WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    await query('DELETE FROM announcements WHERE id = $1', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      details: { title: checkRes.rows[0].title },
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active chat conversations for authenticated user
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT c.id, c.last_message_at,
              u.id as other_user_id, u.first_name, u.last_name, u.email, u.role,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = FALSE) as unread_count
       FROM conversations c
       JOIN users u ON (CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END) = u.id
       WHERE c.user1_id = $1 OR c.user2_id = $1
       ORDER BY c.last_message_at DESC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages inside a specific conversation
 */
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify membership
    const convCheck = await query(
      'SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this conversation.' });
    }

    // Mark unread messages as read
    await query(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND sender_id != $2',
      [conversationId, userId]
    );

    const msgs = await query(
      `SELECT m.*, u.first_name, u.last_name, u.role
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    res.json({ success: true, data: msgs.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get contacts list for current user based on role responsibilities
 */
const getContacts = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    let users = [];

    if (role === 'admin') {
      // Admin can message all faculty/teachers and all students
      const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                t.specialization, t.teacher_id,
                s.student_id, sec.section_name, s.current_grade_level
         FROM users u
         LEFT JOIN teachers t ON u.id = t.user_id
         LEFT JOIN students s ON u.id = s.user_id
         LEFT JOIN sections sec ON s.current_section_id = sec.id
         WHERE u.id != $1 AND u.is_active = TRUE
         ORDER BY u.role, u.first_name ASC`,
        [userId]
      );
      users = result.rows;
    } else if (role === 'teacher') {
      // Teacher can message administrators and all students
      const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                s.student_id, sec.section_name, s.current_grade_level
         FROM users u
         LEFT JOIN students s ON u.id = s.user_id
         LEFT JOIN sections sec ON s.current_section_id = sec.id
         WHERE u.id != $1 AND u.is_active = TRUE AND (u.role = 'admin' OR u.role = 'student')
         ORDER BY u.role, u.first_name ASC`,
        [userId]
      );
      users = result.rows;
    } else if (role === 'student') {
      // Student can message administrators and faculty teachers
      const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                t.specialization, t.teacher_id
         FROM users u
         LEFT JOIN teachers t ON u.id = t.user_id
         WHERE u.id != $1 AND u.is_active = TRUE AND (u.role = 'admin' OR u.role = 'teacher')
         ORDER BY u.role, u.first_name ASC`,
        [userId]
      );
      users = result.rows;
    }

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

/**
 * Start or retrieve existing conversation with another user
 */
const startConversation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required.' });
    }

    const rId = parseInt(recipientId, 10);
    if (rId === senderId) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself.' });
    }

    // Verify recipient exists and is active
    const recCheck = await query('SELECT id, first_name, last_name, role, email FROM users WHERE id = $1 AND is_active = TRUE', [rId]);
    if (recCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recipient user not found or inactive.' });
    }

    const u1 = Math.min(senderId, rId);
    const u2 = Math.max(senderId, rId);

    let convId;
    const existing = await query('SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2', [u1, u2]);
    if (existing.rows.length > 0) {
      convId = existing.rows[0].id;
    } else {
      const inserted = await query(
        'INSERT INTO conversations (user1_id, user2_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id',
        [u1, u2]
      );
      convId = inserted.rows[0].id;
    }

    const convDetail = await query(
      `SELECT c.id, c.last_message_at,
              u.id as other_user_id, u.first_name, u.last_name, u.email, u.role
       FROM conversations c
       JOIN users u ON (CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END) = u.id
       WHERE c.id = $2`,
      [senderId, convId]
    );

    res.json({ success: true, data: convDetail.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message (creates conversation if not exists and sends notification)
 */
const sendMessage = async (req, res, next) => {
  try {
    const { recipientId, conversationId, content } = req.body;
    const senderId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    let convId = conversationId;

    if (!convId) {
      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Recipient ID or Conversation ID is required.' });
      }

      const u1 = Math.min(senderId, parseInt(recipientId, 10));
      const u2 = Math.max(senderId, parseInt(recipientId, 10));

      const existingConv = await query('SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2', [u1, u2]);
      if (existingConv.rows.length > 0) {
        convId = existingConv.rows[0].id;
      } else {
        const newConv = await query(
          'INSERT INTO conversations (user1_id, user2_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id',
          [u1, u2]
        );
        convId = newConv.rows[0].id;
      }
    }

    const msgRes = await query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [convId, senderId, content.trim()]
    );

    // Update conversation timestamp
    await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convId]);

    // Send in-app notification to recipient
    const convInfo = await query('SELECT user1_id, user2_id FROM conversations WHERE id = $1', [convId]);
    if (convInfo.rows.length > 0) {
      const otherUserId = convInfo.rows[0].user1_id === senderId ? convInfo.rows[0].user2_id : convInfo.rows[0].user1_id;
      const targetUser = await query('SELECT role FROM users WHERE id = $1', [otherUserId]);
      const targetRole = targetUser.rows[0]?.role || 'student';
      const targetLink = `/${targetRole === 'admin' ? 'admin' : targetRole === 'teacher' ? 'teacher' : 'student'}/messages`;

      await sendNotification({
        userId: otherUserId,
        title: `New message from ${req.user.firstName || 'Faculty/Staff'}`,
        message: content.trim().slice(0, 100),
        type: 'MESSAGE',
        link: targetLink,
      });
    }

    res.status(201).json({ success: true, data: msgRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Get in-app notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`,
      [req.user.id]
    );
    const unreadCountRes = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt(unreadCountRes.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const ok = await markAsRead(notificationId, req.user.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for current user
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const count = await markAllAsRead(req.user.id);
    res.json({ success: true, message: `Marked ${count} notifications as read.`, updatedCount: count });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a single notification
 */
const deleteNotificationEndpoint = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const ok = await deleteNotification(notificationId, req.user.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    res.json({ success: true, message: 'Notification deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all notifications for user
 */
const clearAllNotificationsEndpoint = async (req, res, next) => {
  try {
    const count = await clearAllNotifications(req.user.id);
    res.json({ success: true, message: `Cleared ${count} notifications.`, deletedCount: count });
  } catch (error) {
    next(error);
  }
};

/**
 * Edit an existing message
 * Only the message author can edit their message
 */
const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    const msgCheck = await query(
      'SELECT id, conversation_id, sender_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const message = msgCheck.rows[0];

    // Only the original author can edit
    if (message.sender_id !== userId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages.' });
    }

    await query(
      `UPDATE messages 
       SET content = $1, is_edited = TRUE, updated_at = NOW() 
       WHERE id = $2`,
      [content.trim(), messageId]
    );

    // Fetch updated message with user details
    const authorRes = await query(
      `SELECT m.*, u.first_name, u.last_name, u.role
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = $1`,
      [messageId]
    );

    res.json({
      success: true,
      message: 'Message edited successfully.',
      data: authorRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a message
 * Author or Administrator can delete
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const msgCheck = await query(
      'SELECT id, conversation_id, sender_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const message = msgCheck.rows[0];

    // Allowed if sender or admin
    if (message.sender_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this message.' });
    }

    await query('DELETE FROM messages WHERE id = $1', [messageId]);

    res.json({
      success: true,
      message: 'Message deleted successfully.',
      data: { id: parseInt(messageId, 10), conversation_id: message.conversation_id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification: deleteNotificationEndpoint,
  clearAllNotifications: clearAllNotificationsEndpoint,
  getContacts,
  startConversation,
};
