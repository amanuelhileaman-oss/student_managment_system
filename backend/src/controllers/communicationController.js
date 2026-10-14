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

    const schoolId = req.user.school_id;

    let sql = `
      SELECT a.*, u.first_name as author_first_name, u.last_name as author_last_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE (
        a.target_audience = 'ALL'
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
    } else if (role === 'admin' || role === 'superadmin') {
      // Admin sees all audience types
      sql += " OR 1=1";
    }

    sql += ' )';

    if (schoolId && role !== 'superadmin') {
      params.push(schoolId);
      sql += ` AND (a.school_id = $${params.length} OR a.school_id IS NULL)`;
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
    const schoolId = req.user.school_id;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const insRes = await query(
      `INSERT INTO announcements (created_by, title, content, target_audience, target_grade_level, target_stream_id, target_section_id, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, title, content, targetAudience, targetGradeLevel || null, targetStreamId || null, targetSectionId || null, schoolId]
    );

    // Broadcast in-app notifications strictly within the same school
    try {
      let targetRoles = [];
      let targetUserIds = [];

      if (targetAudience === 'ALL') {
        let uSql = 'SELECT id FROM users WHERE is_active = TRUE';
        const uParams = [];
        if (schoolId) {
          uParams.push(schoolId);
          uSql += ` AND school_id = $${uParams.length}`;
        }
        const uRes = await query(uSql, uParams);
        targetUserIds = uRes.rows.map((r) => r.id);
      } else if (targetAudience === 'TEACHERS') {
        let uSql = 'SELECT id FROM users WHERE role = \'teacher\' AND is_active = TRUE';
        const uParams = [];
        if (schoolId) {
          uParams.push(schoolId);
          uSql += ` AND school_id = $${uParams.length}`;
        }
        const uRes = await query(uSql, uParams);
        targetUserIds = uRes.rows.map((r) => r.id);
      } else if (targetAudience === 'STUDENTS') {
        let uSql = 'SELECT id FROM users WHERE role = \'student\' AND is_active = TRUE';
        const uParams = [];
        if (schoolId) {
          uParams.push(schoolId);
          uSql += ` AND school_id = $${uParams.length}`;
        }
        const uRes = await query(uSql, uParams);
        targetUserIds = uRes.rows.map((r) => r.id);
      } else if (['GRADE', 'STREAM', 'SECTION'].includes(targetAudience)) {
        let filterSql = 'SELECT s.user_id FROM students s JOIN users u ON s.user_id = u.id WHERE u.is_active = TRUE';
        const filterParams = [];
        if (schoolId) {
          filterParams.push(schoolId);
          filterSql += ` AND (s.school_id = $${filterParams.length} OR u.school_id = $${filterParams.length})`;
        }
        if (targetGradeLevel) {
          filterParams.push(targetGradeLevel);
          filterSql += ` AND s.current_grade_level = $${filterParams.length}`;
        }
        if (targetStreamId) {
          filterParams.push(targetStreamId);
          filterSql += ` AND s.current_stream_id = $${filterParams.length}`;
        }
        if (targetSectionId) {
          filterParams.push(targetSectionId);
          filterSql += ` AND s.current_section_id = $${filterParams.length}`;
        }
        const stRes = await query(filterSql, filterParams);
        targetUserIds = stRes.rows.map((r) => r.user_id);
      }

      if (targetUserIds.length > 0) {
        await broadcastNotification({
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
 * Get active chat conversations for authenticated user (Direct & Group)
 */
const getConversations = async (req, res, next) => {
  try {
    const { role, id: userId, school_id: schoolId } = req.user;

    let studentInfo = null;
    if (role === 'student') {
      const sRes = await query('SELECT current_grade_level, current_stream_id, current_section_id FROM students WHERE user_id = $1', [userId]);
      if (sRes.rows.length > 0) studentInfo = sRes.rows[0];
    }

    let sql = `
      SELECT c.id, c.is_group, c.title, c.group_type, c.target_grade_level, c.target_section_id, c.created_by, c.school_id, c.last_message_at,
             sec.section_name,
             u.id as other_user_id, u.first_name, u.last_name, u.email, u.role,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = FALSE) as unread_count
      FROM conversations c
      LEFT JOIN users u ON (CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END) = u.id
      LEFT JOIN sections sec ON c.target_section_id = sec.id
      WHERE (
        (c.is_group = FALSE AND (c.user1_id = $1 OR c.user2_id = $1))
    `;
    const params = [userId];

    if (role === 'admin' || role === 'superadmin') {
      // Admin sees all groups in their school
      sql += ` OR (c.is_group = TRUE) `;
    } else if (role === 'teacher') {
      // Teachers see teacher staff group, all-students group, and sections they teach
      sql += ` OR (c.is_group = TRUE AND (c.group_type = 'TEACHERS' OR c.group_type = 'ALL_STUDENTS')) `;
    } else if (role === 'student') {
      // Students see all-students group, their grade group, and their section group
      sql += ` OR (c.is_group = TRUE AND (
        c.group_type = 'ALL_STUDENTS'
      `;
      if (studentInfo?.current_grade_level) {
        params.push(studentInfo.current_grade_level);
        sql += ` OR (c.group_type = 'GRADE' AND c.target_grade_level = $${params.length}) `;
      }
      if (studentInfo?.current_section_id) {
        params.push(studentInfo.current_section_id);
        sql += ` OR (c.group_type = 'SECTION' AND c.target_section_id = $${params.length}) `;
      }
      sql += ` )) `;
    }

    sql += ` ) `;

    // Strict multi-tenant school isolation
    if (schoolId && role !== 'superadmin') {
      params.push(schoolId);
      sql += ` AND (
        c.school_id = $${params.length}
        OR (
          c.school_id IS NULL AND (
            c.created_by IN (SELECT id FROM users WHERE school_id = $${params.length})
            OR c.user1_id IN (SELECT id FROM users WHERE school_id = $${params.length})
          )
        )
      ) `;
    }

    sql += ` ORDER BY c.last_message_at DESC `;
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages inside a specific conversation (Direct or Group)
 */
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { role, id: userId, school_id: schoolId } = req.user;

    const convRes = await query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    const conv = convRes.rows[0];

    // Strict multi-tenant school authorization check
    if (schoolId && role !== 'superadmin') {
      if (conv.school_id && conv.school_id !== schoolId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access conversations from another school.' });
      }
      if (!conv.school_id) {
        const checkSchool = await query(
          'SELECT id FROM users WHERE id IN ($1, $2, $3) AND school_id = $4 LIMIT 1',
          [conv.created_by || 0, conv.user1_id || 0, conv.user2_id || 0, schoolId]
        );
        if (checkSchool.rows.length === 0) {
          return res.status(403).json({ success: false, message: 'You are not authorized to access conversations from another school.' });
        }
      }
    }

    // Role and membership authorization check
    if (!conv.is_group) {
      if (conv.user1_id !== userId && conv.user2_id !== userId && role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'You are not authorized to access this conversation.' });
      }
    } else {
      if (role === 'student') {
        const sRes = await query('SELECT current_grade_level, current_section_id FROM students WHERE user_id = $1', [userId]);
        const sInfo = sRes.rows[0];
        const isAllowed =
          conv.group_type === 'ALL_STUDENTS' ||
          (conv.group_type === 'GRADE' && conv.target_grade_level === sInfo?.current_grade_level) ||
          (conv.group_type === 'SECTION' && conv.target_section_id === sInfo?.current_section_id);
        if (!isAllowed) {
          return res.status(403).json({ success: false, message: 'You are not a member of this group conversation.' });
        }
      }
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
 * Get contacts list for current user strictly within their own school
 */
const getContacts = async (req, res, next) => {
  try {
    const { role, id: userId, school_id: schoolId } = req.user;
    let users = [];

    const schoolFilter = (schoolId && role !== 'superadmin') ? ' AND u.school_id = $2' : '';
    const params = [userId];
    if (schoolId && role !== 'superadmin') params.push(schoolId);

    if (role === 'admin' || role === 'superadmin') {
      // Admin can message faculty/teachers and students within the same school
      const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                t.specialization, t.teacher_id,
                s.student_id, sec.section_name, s.current_grade_level
         FROM users u
         LEFT JOIN teachers t ON u.id = t.user_id
         LEFT JOIN students s ON u.id = s.user_id
         LEFT JOIN sections sec ON s.current_section_id = sec.id
         WHERE u.id != $1 AND u.is_active = TRUE ${schoolFilter}
         ORDER BY u.role, u.first_name ASC`,
        params
      );
      users = result.rows;
    } else if (role === 'teacher') {
      // Teacher can message administrators and students within the same school
      const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                s.student_id, sec.section_name, s.current_grade_level
         FROM users u
         LEFT JOIN students s ON u.id = s.user_id
         LEFT JOIN sections sec ON s.current_section_id = sec.id
         WHERE u.id != $1 AND u.is_active = TRUE AND (u.role = 'admin' OR u.role = 'student') ${schoolFilter}
         ORDER BY u.role, u.first_name ASC`,
        params
      );
      users = result.rows;
    } else if (role === 'student') {
      // Student can message administrators and teachers within the same school
      const result = await query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                t.specialization, t.teacher_id
         FROM users u
         LEFT JOIN teachers t ON u.id = t.user_id
         WHERE u.id != $1 AND u.is_active = TRUE AND (u.role = 'admin' OR u.role = 'teacher') ${schoolFilter}
         ORDER BY u.role, u.first_name ASC`,
        params
      );
      users = result.rows;
    }

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

/**
 * Start or retrieve existing 1-on-1 direct conversation with another user
 */
const startConversation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.id;
    const schoolId = req.user.school_id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required.' });
    }

    const rId = parseInt(recipientId, 10);
    if (rId === senderId) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself.' });
    }

    // Verify recipient exists and is active
    const recCheck = await query('SELECT id, first_name, last_name, role, email, school_id FROM users WHERE id = $1 AND is_active = TRUE', [rId]);
    if (recCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recipient user not found or inactive.' });
    }

    const recipient = recCheck.rows[0];
    if (schoolId && req.user.role !== 'superadmin') {
      if (recipient.school_id && recipient.school_id !== schoolId) {
        return res.status(403).json({ success: false, message: 'Cannot start conversation with a user from another school.' });
      }
    }

    const u1 = Math.min(senderId, rId);
    const u2 = Math.max(senderId, rId);

    let convId;
    let existingSql = 'SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2 AND is_group = FALSE';
    const existingParams = [u1, u2];
    if (schoolId) {
      existingParams.push(schoolId);
      existingSql += ` AND (school_id = $${existingParams.length} OR school_id IS NULL)`;
    }
    const existing = await query(existingSql, existingParams);
    if (existing.rows.length > 0) {
      convId = existing.rows[0].id;
    } else {
      const inserted = await query(
        'INSERT INTO conversations (is_group, user1_id, user2_id, school_id, last_message_at) VALUES (FALSE, $1, $2, $3, NOW()) RETURNING id',
        [u1, u2, schoolId || recipient.school_id || null]
      );
      convId = inserted.rows[0].id;
    }

    const convDetail = await query(
      `SELECT c.id, c.is_group, c.title, c.school_id, c.last_message_at,
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
 * Start or retrieve group conversation (By Grade, By Section, All Students, or Faculty Teachers)
 */
const startGroupConversation = async (req, res, next) => {
  try {
    const { groupType, targetGradeLevel, targetSectionId, customTitle } = req.body;
    const userId = req.user.id;
    const schoolId = req.user.school_id;

    if (!groupType) {
      return res.status(400).json({ success: false, message: 'Group type is required.' });
    }

    let defaultTitle = customTitle;
    let existingSql = 'SELECT * FROM conversations WHERE is_group = TRUE AND group_type = $1';
    const existingParams = [groupType];

    if (schoolId) {
      existingParams.push(schoolId);
      existingSql += ` AND (school_id = $${existingParams.length} OR (school_id IS NULL AND created_by IN (SELECT id FROM users WHERE school_id = $${existingParams.length})))`;
    }

    if (groupType === 'TEACHERS') {
      defaultTitle = defaultTitle || 'Faculty Staff Group';
    } else if (groupType === 'ALL_STUDENTS') {
      defaultTitle = defaultTitle || 'All Students (School-wide)';
    } else if (groupType === 'GRADE') {
      if (!targetGradeLevel) {
        return res.status(400).json({ success: false, message: 'Target grade level is required.' });
      }
      existingParams.push(parseInt(targetGradeLevel, 10));
      existingSql += ` AND target_grade_level = $${existingParams.length}`;
      defaultTitle = defaultTitle || `Grade ${targetGradeLevel} - All Students Group`;
    } else if (groupType === 'SECTION') {
      if (!targetSectionId) {
        return res.status(400).json({ success: false, message: 'Target section ID is required.' });
      }
      existingParams.push(parseInt(targetSectionId, 10));
      existingSql += ` AND target_section_id = $${existingParams.length}`;

      const secInfo = await query('SELECT section_name, grade_level FROM sections WHERE id = $1', [targetSectionId]);
      const sName = secInfo.rows[0]?.section_name || '';
      const gLevel = targetGradeLevel || secInfo.rows[0]?.grade_level || '';
      defaultTitle = defaultTitle || `Grade ${gLevel} - Section ${sName} Group`;
    } else {
      defaultTitle = defaultTitle || 'Custom Group Chat';
    }

    const existingRes = await query(existingSql, existingParams);
    if (existingRes.rows.length > 0) {
      const conv = existingRes.rows[0];
      if (!conv.school_id && schoolId) {
        await query('UPDATE conversations SET school_id = $1 WHERE id = $2', [schoolId, conv.id]);
      }
      let secName = null;
      if (conv.target_section_id) {
        const sRes = await query('SELECT section_name FROM sections WHERE id = $1', [conv.target_section_id]);
        secName = sRes.rows[0]?.section_name || null;
      }
      return res.json({
        success: true,
        data: {
          id: conv.id,
          is_group: true,
          title: conv.title,
          group_type: conv.group_type,
          target_grade_level: conv.target_grade_level,
          target_section_id: conv.target_section_id,
          section_name: secName,
          school_id: conv.school_id || schoolId,
          last_message_at: conv.last_message_at,
        },
        isNew: false,
      });
    }

    const insRes = await query(
      `INSERT INTO conversations (is_group, title, group_type, target_grade_level, target_section_id, created_by, school_id, last_message_at)
       VALUES (TRUE, $1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        defaultTitle,
        groupType,
        targetGradeLevel ? parseInt(targetGradeLevel, 10) : null,
        targetSectionId ? parseInt(targetSectionId, 10) : null,
        userId,
        schoolId || null,
      ]
    );

    const created = insRes.rows[0];
    let createdSecName = null;
    if (created.target_section_id) {
      const sRes = await query('SELECT section_name FROM sections WHERE id = $1', [created.target_section_id]);
      createdSecName = sRes.rows[0]?.section_name || null;
    }

    await logAudit({
      userId,
      action: 'GROUP_CHAT_CREATED',
      entityType: 'CONVERSATION',
      entityId: created.id,
      details: { title: defaultTitle, groupType, targetGradeLevel, targetSectionId },
    });

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        is_group: true,
        title: created.title,
        group_type: created.group_type,
        target_grade_level: created.target_grade_level,
        target_section_id: created.target_section_id,
        section_name: createdSecName,
        school_id: created.school_id,
        last_message_at: created.last_message_at,
      },
      isNew: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a conversation (Group or Direct) and all associated messages
 */
const deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { role, id: userId, school_id: schoolId } = req.user;

    const convRes = await query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const conv = convRes.rows[0];

    // School check
    if (schoolId && role !== 'superadmin' && conv.school_id && conv.school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete conversations from another school.' });
    }

    // Admin can delete any conversation in their school. Non-admins can only delete 1-on-1 chats they participate in.
    if (role !== 'admin' && role !== 'superadmin' && conv.user1_id !== userId && conv.user2_id !== userId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this conversation.' });
    }

    // Delete conversation (messages cascade automatically)
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);

    await logAudit({
      userId,
      action: 'CONVERSATION_DELETED',
      entityType: 'CONVERSATION',
      entityId: parseInt(conversationId, 10),
      details: { is_group: conv.is_group, title: conv.title || 'Direct Chat' },
    });

    res.json({ success: true, message: 'Conversation and all messages deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message (creates conversation if not exists and sends notification strictly within school)
 */
const sendMessage = async (req, res, next) => {
  try {
    const { recipientId, conversationId, content } = req.body;
    const senderId = req.user.id;
    const schoolId = req.user.school_id;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    let convId = conversationId;

    if (!convId) {
      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Recipient ID or Conversation ID is required.' });
      }

      const rId = parseInt(recipientId, 10);
      const recCheck = await query('SELECT id, school_id FROM users WHERE id = $1 AND is_active = TRUE', [rId]);
      if (recCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Recipient user not found or inactive.' });
      }
      if (schoolId && req.user.role !== 'superadmin' && recCheck.rows[0].school_id && recCheck.rows[0].school_id !== schoolId) {
        return res.status(403).json({ success: false, message: 'Cannot send messages to a user from another school.' });
      }

      const u1 = Math.min(senderId, rId);
      const u2 = Math.max(senderId, rId);

      const existingConv = await query('SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2 AND is_group = FALSE', [u1, u2]);
      if (existingConv.rows.length > 0) {
        convId = existingConv.rows[0].id;
      } else {
        const newConv = await query(
          'INSERT INTO conversations (is_group, user1_id, user2_id, school_id, last_message_at) VALUES (FALSE, $1, $2, $3, NOW()) RETURNING id',
          [u1, u2, schoolId || recCheck.rows[0].school_id || null]
        );
        convId = newConv.rows[0].id;
      }
    } else {
      const convCheck = await query('SELECT * FROM conversations WHERE id = $1', [convId]);
      if (convCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Conversation not found.' });
      }
      const cObj = convCheck.rows[0];
      if (schoolId && req.user.role !== 'superadmin' && cObj.school_id && cObj.school_id !== schoolId) {
        return res.status(403).json({ success: false, message: 'Cannot send messages to a conversation from another school.' });
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

    // Send notifications strictly within same school
    const convInfo = await query('SELECT * FROM conversations WHERE id = $1', [convId]);
    if (convInfo.rows.length > 0) {
      const conv = convInfo.rows[0];
      const notifSchoolId = conv.school_id || schoolId;

      if (!conv.is_group) {
        const otherUserId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
        const targetUser = await query('SELECT role, school_id FROM users WHERE id = $1', [otherUserId]);
        if (targetUser.rows.length > 0) {
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
      } else {
        // Group notification broadcast strictly scoped to this school
        try {
          let targetUserIds = [];

          if (conv.group_type === 'TEACHERS') {
            let tSql = "SELECT id FROM users WHERE role = 'teacher' AND is_active = TRUE";
            const tParams = [];
            if (notifSchoolId) {
              tParams.push(notifSchoolId);
              tSql += ` AND school_id = $${tParams.length}`;
            }
            const tRes = await query(tSql, tParams);
            targetUserIds = tRes.rows.map(r => r.id).filter(id => id !== senderId);
          } else if (conv.group_type === 'ALL_STUDENTS') {
            let stSql = "SELECT id FROM users WHERE role = 'student' AND is_active = TRUE";
            const stParams = [];
            if (notifSchoolId) {
              stParams.push(notifSchoolId);
              stSql += ` AND school_id = $${stParams.length}`;
            }
            const stRes = await query(stSql, stParams);
            targetUserIds = stRes.rows.map(r => r.id).filter(id => id !== senderId);
          } else if (conv.group_type === 'GRADE') {
            let gSql = 'SELECT s.user_id FROM students s JOIN users u ON s.user_id = u.id WHERE s.current_grade_level = $1 AND u.is_active = TRUE';
            const gParams = [conv.target_grade_level];
            if (notifSchoolId) {
              gParams.push(notifSchoolId);
              gSql += ` AND (s.school_id = $${gParams.length} OR u.school_id = $${gParams.length})`;
            }
            const gRes = await query(gSql, gParams);
            targetUserIds = gRes.rows.map(r => r.user_id).filter(id => id !== senderId);
          } else if (conv.group_type === 'SECTION') {
            let secSql = 'SELECT s.user_id FROM students s JOIN users u ON s.user_id = u.id WHERE s.current_section_id = $1 AND u.is_active = TRUE';
            const secParams = [conv.target_section_id];
            if (notifSchoolId) {
              secParams.push(notifSchoolId);
              secSql += ` AND (s.school_id = $${secParams.length} OR u.school_id = $${secParams.length})`;
            }
            const secRes = await query(secSql, secParams);
            targetUserIds = secRes.rows.map(r => r.user_id).filter(id => id !== senderId);
          }

          if (targetUserIds.length > 0) {
            await broadcastNotification({
              userIds: targetUserIds,
              title: `${conv.title}: New message from ${req.user.firstName || 'Admin'}`,
              message: content.trim().slice(0, 100),
              type: 'MESSAGE',
              link: `/${req.user.role === 'admin' ? 'admin' : req.user.role === 'teacher' ? 'teacher' : 'student'}/messages`,
            });
          }
        } catch (notifErr) {
          console.warn('[sendMessage] Group notification error:', notifErr.message);
        }
      }
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
      `SELECT m.id, m.conversation_id, m.sender_id, c.school_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const message = msgCheck.rows[0];
    if (req.user.school_id && req.user.role !== 'superadmin' && message.school_id && message.school_id !== req.user.school_id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit messages from another school.' });
    }

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
    const schoolId = req.user.school_id;

    const msgCheck = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, c.school_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1`,
      [messageId]
    );

    if (msgCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const message = msgCheck.rows[0];
    if (schoolId && userRole !== 'superadmin' && message.school_id && message.school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete messages from another school.' });
    }

    // Allowed if sender or school admin
    if (message.sender_id !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
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
  startGroupConversation,
  deleteConversation,
};
