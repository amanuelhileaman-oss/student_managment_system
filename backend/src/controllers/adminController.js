const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../services/auditService');
const { syncScheduleRoomNumbers } = require('./scheduleController');
const cloudinaryService = require('../services/cloudinaryService');

/**
 * Real-time Admin Dashboard Analytics from live database
 */
const getAnalytics = async (req, res, next) => {
  try {
    // 1. Total counts
    const stuCountRes = await query('SELECT COUNT(*) FROM students');
    const tchCountRes = await query('SELECT COUNT(*) FROM teachers');
    const secCountRes = await query('SELECT COUNT(*) FROM sections WHERE is_active = TRUE');
    const enrollCountRes = await query("SELECT COUNT(*) FROM enrollments WHERE status = 'ENROLLED'");

    // 2. Capacity metrics
    const capRes = await query(`
      SELECT SUM(capacity) as total_capacity,
             COUNT(e.id) as total_enrolled
      FROM sections s
      LEFT JOIN enrollments e ON s.id = e.section_id AND e.status = 'ENROLLED'
      WHERE s.is_active = TRUE
    `);
    const totalCapacity = parseInt(capRes.rows[0].total_capacity || 0, 10);
    const totalEnrolled = parseInt(capRes.rows[0].total_enrolled || 0, 10);
    const utilizationRate = totalCapacity > 0 ? parseFloat(((totalEnrolled / totalCapacity) * 100).toFixed(1)) : 0;

    // 3. Students by Grade
    const gradeDistRes = await query(`
      SELECT g.level as grade_level, g.name as grade_name, COUNT(e.id) as student_count
      FROM grades g
      LEFT JOIN enrollments e ON g.level = e.grade_level AND e.status = 'ENROLLED'
      GROUP BY g.level, g.name
      ORDER BY g.level ASC
    `);

    // 4. Students by Stream
    const streamDistRes = await query(`
      SELECT st.code as stream_code, st.name as stream_name, COUNT(e.id) as student_count
      FROM streams st
      LEFT JOIN enrollments e ON st.id = e.stream_id AND e.status = 'ENROLLED'
      GROUP BY st.id, st.code, st.name
      ORDER BY st.id ASC
    `);

    // 5. Recent audit actions
    const recentAuditsRes = await query(`
      SELECT al.*, u.email, u.role, u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    // 6. Pending Grade 8 admission documents count
    const pendingDocsRes = await query(`
      SELECT COUNT(id) as count
      FROM students
      WHERE document_status = 'PENDING_ADMIN_VERIFICATION'
    `);
    const pendingDocuments = parseInt(pendingDocsRes.rows[0].count || 0, 10);

    // 7. Master Schedules count & coverage
    const schCountRes = await query('SELECT COUNT(*) as count FROM schedules');
    const totalSchedules = parseInt(schCountRes.rows[0].count || 0, 10);

    const secSchRes = await query(`
      SELECT COUNT(DISTINCT ta.section_id) as count
      FROM schedules sch
      JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
    `);
    const sectionsWithSchedules = parseInt(secSchRes.rows[0].count || 0, 10);

    res.json({
      success: true,
      data: {
        totalStudents: parseInt(stuCountRes.rows[0].count, 10),
        totalTeachers: parseInt(tchCountRes.rows[0].count, 10),
        activeSections: parseInt(secCountRes.rows[0].count, 10),
        activeEnrollments: parseInt(enrollCountRes.rows[0].count, 10),
        totalCapacity,
        utilizationRate,
        pendingDocuments,
        totalSchedules,
        sectionsWithSchedules,
        studentsByGrade: gradeDistRes.rows,
        studentsByStream: streamDistRes.rows,
        recentActivity: recentAuditsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Students & Teachers roster
 */
const getUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;

    let sql = `
      SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.avatar_url, u.phone, u.bio, u.is_active, u.created_at,
             s.id as student_record_id, s.student_id, s.current_grade_level, s.current_section_id, s.current_stream_id, s.prerequisite_verified, s.promotion_status,
             s.phone as student_phone, s.address as student_address,
             st.name as stream_name, st.code as stream_code,
             sec.section_name,
             t.id as teacher_record_id, t.teacher_id, t.qualification, t.specialization, t.phone as teacher_phone,
             COALESCE(
               (SELECT STRING_AGG(DISTINCT sub.name, ', ')
                FROM teacher_assignments ta
                JOIN subjects sub ON ta.subject_id = sub.id
                WHERE ta.teacher_id = t.id),
               ''
             ) as assigned_subjects,
             COALESCE(
               (SELECT STRING_AGG(DISTINCT CONCAT('Grade ', s_sec.grade_level, ' (', s_sec.section_name, ')'), ', ')
                FROM teacher_assignments ta
                JOIN sections s_sec ON ta.section_id = s_sec.id
                WHERE ta.teacher_id = t.id),
               ''
             ) as assigned_classes,
             COALESCE(
               (SELECT ARRAY_AGG(DISTINCT s_sec.grade_level)
                FROM teacher_assignments ta
                JOIN sections s_sec ON ta.section_id = s_sec.id
                WHERE ta.teacher_id = t.id),
               '{}'
             ) as teacher_grades
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN streams st ON s.current_stream_id = st.id
      LEFT JOIN sections sec ON s.current_section_id = sec.id
      LEFT JOIN teachers t ON u.id = t.user_id
      WHERE u.role != 'admin'
    `;
    const params = [];

    if (role) {
      params.push(role);
      sql += ` AND u.role = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR s.student_id ILIKE $${params.length} OR t.teacher_id ILIKE $${params.length})`;
    }

    sql += ' ORDER BY u.created_at DESC';
    const result = await query(sql, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle user activation status (Active / Deactivated)
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Admin account cannot be deactivated
    const checkAdmin = await query('SELECT role, is_active FROM users WHERE id = $1', [userId]);
    if (checkAdmin.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (checkAdmin.rows[0].role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot deactivate the system administrator account.' });
    }

    const newStatus = !checkAdmin.rows[0].is_active;
    await query('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, userId]);

    await logAudit({
      userId: req.user.id,
      action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: userId,
    });

    res.json({
      success: true,
      message: `User successfully ${newStatus ? 'activated' : 'deactivated'}.`,
      isActive: newStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin "Create Other Section" (e.g. Section E, Section F)
 */
const createSection = async (req, res, next) => {
  try {
    const { gradeLevel, streamId, sectionName, capacity = 50, academicYearId } = req.body;

    if (!gradeLevel || !streamId || !sectionName) {
      return res.status(400).json({ success: false, message: 'gradeLevel, streamId, and sectionName are required.' });
    }

    const gLevel = parseInt(gradeLevel, 10);
    const sId = parseInt(streamId, 10);

    // Validate stream exists
    const streamRes = await query('SELECT id, code, name FROM streams WHERE id = $1', [sId]);
    if (streamRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid stream selected.' });
    }
    const streamCode = streamRes.rows[0].code;

    // Strict stream enforcement:
    // Grades 9 and 10 -> GENERAL stream ONLY
    if (gLevel <= 10 && streamCode !== 'GENERAL') {
      return res.status(400).json({
        success: false,
        message: `Grades 9 and 10 only support the General Stream. Natural and Social Science streams are not allowed for Grade ${gLevel}.`,
      });
    }

    // Grades 11 and 12 -> NATURAL or SOCIAL stream ONLY
    if (gLevel >= 11 && streamCode === 'GENERAL') {
      return res.status(400).json({
        success: false,
        message: `Grades 11 and 12 require Natural Science or Social Science stream. General Stream is only for Grades 9 and 10.`,
      });
    }

    // Resolve academic year if not provided
    let yearId = academicYearId;
    if (!yearId) {
      const yRes = await query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
      yearId = yRes.rows.length > 0 ? yRes.rows[0].id : 1;
    }

    // Check if section already exists
    const existing = await query(
      'SELECT id FROM sections WHERE grade_level = $1 AND stream_id = $2 AND section_name = $3 AND academic_year_id = $4',
      [gradeLevel, streamId, sectionName.toUpperCase(), yearId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Section ${sectionName.toUpperCase()} already exists for this grade and stream.`,
      });
    }

    const insRes = await query(
      `INSERT INTO sections (grade_level, stream_id, section_name, capacity, academic_year_id, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [gradeLevel, streamId, sectionName.toUpperCase(), parseInt(capacity, 10), yearId]
    );

    await logAudit({
      userId: req.user.id,
      action: 'SECTION_CREATED',
      entityType: 'SECTION',
      entityId: insRes.rows[0].id,
      details: { name: sectionName.toUpperCase(), grade: gradeLevel, capacity },
    });

    // Re-sequence school room allocations so subsequent sections shift forward
    await syncScheduleRoomNumbers();

    res.status(201).json({
      success: true,
      message: `Section ${sectionName.toUpperCase()} created successfully with capacity ${capacity}.`,
      data: insRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Section Capacity
 */
const updateSectionCapacity = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { capacity } = req.body;

    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum <= 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be a positive integer.' });
    }

    const updateRes = await query(
      `UPDATE sections SET capacity = $1 WHERE id = $2 RETURNING *`,
      [capNum, sectionId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'SECTION_CAPACITY_UPDATED',
      entityType: 'SECTION',
      entityId: sectionId,
      details: { newCapacity: capNum },
    });

    res.json({ success: true, message: 'Section capacity updated.', data: updateRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Section Details
 */
const updateSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { sectionName, capacity, gradeLevel, streamId } = req.body;

    const existingRes = await query('SELECT * FROM sections WHERE id = $1', [sectionId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }
    const curr = existingRes.rows[0];

    const newName = sectionName ? sectionName.trim().toUpperCase() : curr.section_name;
    const newCap = capacity ? parseInt(capacity, 10) : curr.capacity;
    const newGrade = gradeLevel ? parseInt(gradeLevel, 10) : curr.grade_level;
    const newStream = streamId ? parseInt(streamId, 10) : curr.stream_id;

    if (newName !== curr.section_name || newGrade !== curr.grade_level || newStream !== curr.stream_id) {
      const dup = await query(
        `SELECT id FROM sections 
         WHERE grade_level = $1 AND stream_id = $2 AND section_name = $3 AND academic_year_id = $4 AND id <> $5`,
        [newGrade, newStream, newName, curr.academic_year_id, sectionId]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Section ${newName} already exists for Grade ${newGrade}.`,
        });
      }
    }

    const upd = await query(
      `UPDATE sections
       SET section_name = $1, capacity = $2, grade_level = $3, stream_id = $4
       WHERE id = $5
       RETURNING *`,
      [newName, newCap, newGrade, newStream, sectionId]
    );

    await logAudit({
      userId: req.user.id,
      action: 'SECTION_UPDATED',
      entityType: 'SECTION',
      entityId: sectionId,
      details: { sectionName: newName, capacity: newCap, gradeLevel: newGrade, streamId: newStream },
    });

    // Re-sequence school room allocations
    await syncScheduleRoomNumbers();

    res.json({ success: true, message: 'Section updated successfully.', data: upd.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Section (only if no active enrolled students)
 */
const deleteSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;

    const enrollRes = await query(
      `SELECT COUNT(*) as count FROM enrollments WHERE section_id = $1 AND status = 'ENROLLED'`,
      [sectionId]
    );
    const count = parseInt(enrollRes.rows[0].count, 10);
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section with ${count} active enrolled student(s). Please transfer or remove students first.`,
      });
    }

    const delRes = await query('DELETE FROM sections WHERE id = $1 RETURNING *', [sectionId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'SECTION_DELETED',
      entityType: 'SECTION',
      entityId: sectionId,
      details: delRes.rows[0],
    });

    // Re-sequence school room allocations so subsequent sections shift backward
    await syncScheduleRoomNumbers();

    res.json({ success: true, message: `Section ${delRes.rows[0].section_name} removed successfully.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Teacher Assignments
 */
const getTeacherAssignments = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ta.id, ta.teacher_id, ta.subject_id, ta.section_id, ta.academic_year_id, ta.assigned_at,
             u.first_name, u.last_name, u.email, t.teacher_id as teacher_code, t.specialization,
             s.name as subject_name, s.code as subject_code, s.grade_level,
             sec.section_name, st.name as stream_name, st.code as stream_code, ay.year_name,
             (SELECT COUNT(*) FROM schedules sch WHERE sch.teacher_assignment_id = ta.id) as scheduled_periods_count
      FROM teacher_assignments ta
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      JOIN subjects s ON ta.subject_id = s.id
      JOIN sections sec ON ta.section_id = sec.id
      JOIN streams st ON sec.stream_id = st.id
      JOIN academic_years ay ON ta.academic_year_id = ay.id
      ORDER BY s.grade_level ASC, sec.section_name ASC, ta.assigned_at DESC, ta.id DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign Teacher to a Subject & Section
 */
const createTeacherAssignment = async (req, res, next) => {
  try {
    const { teacherId, subjectId, sectionId, academicYearId } = req.body;

    if (!teacherId || !subjectId || !sectionId) {
      return res.status(400).json({ success: false, message: 'Teacher, subject, and section are required.' });
    }

    // Auto-resolve teacherId: supports teachers.id primary key, users.id, or teacher_id string (e.g. TCH-2026-001)
    let tCheck = await query(
      `SELECT id FROM teachers WHERE id = $1 LIMIT 1`,
      [!isNaN(teacherId) ? parseInt(teacherId, 10) : -1]
    );
    if (tCheck.rows.length === 0) {
      tCheck = await query(
        `SELECT id FROM teachers WHERE user_id = $1 OR teacher_id = $2 LIMIT 1`,
        [!isNaN(teacherId) ? parseInt(teacherId, 10) : -1, String(teacherId)]
      );
    }
    if (tCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher record not found in faculty registry.' });
    }
    const resolvedTeacherId = tCheck.rows[0].id;

    let yearId = academicYearId;
    if (!yearId) {
      const yRes = await query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
      yearId = yRes.rows.length > 0 ? yRes.rows[0].id : 1;
    }

    const insRes = await query(
      `INSERT INTO teacher_assignments (teacher_id, subject_id, section_id, academic_year_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO NOTHING
       RETURNING *`,
      [resolvedTeacherId, subjectId, sectionId, yearId]
    );

    if (insRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'This teacher assignment already exists.' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'TEACHER_ASSIGNMENT_CREATED',
      entityType: 'TEACHER_ASSIGNMENT',
      entityId: insRes.rows[0].id,
      details: { teacherId, subjectId, sectionId },
    });

    res.status(201).json({ success: true, message: 'Teacher assignment created.', data: insRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Teacher Assignment
 */
const updateTeacherAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teacherId, subjectId, sectionId } = req.body;

    const existing = await query('SELECT * FROM teacher_assignments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher assignment not found.' });
    }
    const curr = existing.rows[0];

    let resolvedTeacherId = curr.teacher_id;
    if (teacherId) {
      let tCheck = await query(
        `SELECT id FROM teachers WHERE id = $1 LIMIT 1`,
        [teacherId]
      );
      if (tCheck.rows.length === 0) {
        tCheck = await query(
          `SELECT id FROM teachers WHERE user_id = $1 LIMIT 1`,
          [teacherId]
        );
      }
      if (tCheck.rows.length > 0) resolvedTeacherId = tCheck.rows[0].id;
    }

    const targetSub = subjectId ? parseInt(subjectId, 10) : curr.subject_id;
    const targetSec = sectionId ? parseInt(sectionId, 10) : curr.section_id;

    const dupCheck = await query(
      `SELECT id FROM teacher_assignments 
       WHERE teacher_id = $1 AND subject_id = $2 AND section_id = $3 AND academic_year_id = $4 AND id <> $5`,
      [resolvedTeacherId, targetSub, targetSec, curr.academic_year_id, id]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'This teacher assignment already exists.' });
    }

    const upd = await query(
      `UPDATE teacher_assignments
       SET teacher_id = $1, subject_id = $2, section_id = $3
       WHERE id = $4
       RETURNING *`,
      [resolvedTeacherId, targetSub, targetSec, id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'TEACHER_ASSIGNMENT_UPDATED',
      entityType: 'TEACHER_ASSIGNMENT',
      entityId: id,
      details: { teacherId: resolvedTeacherId, subjectId: targetSub, sectionId: targetSec },
    });

    res.json({ success: true, message: 'Teacher assignment updated successfully.', data: upd.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Teacher Assignment
 */
const deleteTeacherAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const delRes = await query('DELETE FROM teacher_assignments WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher assignment not found.' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'TEACHER_ASSIGNMENT_DELETED',
      entityType: 'TEACHER_ASSIGNMENT',
      entityId: id,
      details: delRes.rows[0],
    });

    res.json({ success: true, message: 'Teacher assignment and associated schedule periods removed successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new academic subject (curriculum course)
 */
const createSubject = async (req, res, next) => {
  try {
    const { name, code, gradeLevel, streamId, creditHours = 3 } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Subject code is required.' });
    }

    const gLevel = parseInt(gradeLevel, 10);
    if (![9, 10, 11, 12].includes(gLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade level. Ethiopian High School curriculum strictly supports Grades 9 through 12.',
      });
    }

    const formattedCode = code.trim().toUpperCase();
    const formattedName = name.trim();
    const credits = parseInt(creditHours, 10) || 3;

    if (credits < 1 || credits > 10) {
      return res.status(400).json({
        success: false,
        message: 'Credit hours / weekly periods must be between 1 and 10.',
      });
    }

    // Determine and validate stream
    let assignedStreamId = streamId ? parseInt(streamId, 10) : null;

    if (gLevel <= 10) {
      // Grades 9 and 10 are strictly GENERAL stream
      const generalStreamRes = await query("SELECT id FROM streams WHERE code = 'GENERAL' LIMIT 1");
      const defaultGeneralId = generalStreamRes.rows[0]?.id || 1;
      if (assignedStreamId && assignedStreamId !== defaultGeneralId) {
        return res.status(400).json({
          success: false,
          message: 'Grades 9 and 10 subjects belong exclusively to the General Stream.',
        });
      }
      assignedStreamId = defaultGeneralId;
    } else {
      // Grades 11 and 12: Must specify a valid stream (Natural, Social, or General/Common)
      if (!assignedStreamId) {
        return res.status(400).json({
          success: false,
          message: `Please select an academic stream for Grade ${gLevel} (Natural Science, Social Science, or General).`,
        });
      }
      const streamCheck = await query('SELECT id, code, name FROM streams WHERE id = $1', [assignedStreamId]);
      if (streamCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Selected academic stream is invalid.' });
      }
    }

    // Check code uniqueness
    const codeConflict = await query('SELECT id, name FROM subjects WHERE UPPER(code) = $1', [formattedCode]);
    if (codeConflict.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A subject with code "${formattedCode}" already exists (${codeConflict.rows[0].name}).`,
      });
    }

    // Check duplicate subject name in same grade and stream
    const nameConflict = await query(
      'SELECT id, code FROM subjects WHERE LOWER(TRIM(name)) = LOWER($1) AND grade_level = $2 AND stream_id = $3',
      [formattedName, gLevel, assignedStreamId]
    );
    if (nameConflict.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Subject "${formattedName}" already exists for Grade ${gLevel} in this stream (${nameConflict.rows[0].code}).`,
      });
    }

    const insRes = await query(
      `INSERT INTO subjects (code, name, grade_level, stream_id, credit_hours)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [formattedCode, formattedName, gLevel, assignedStreamId, credits]
    );

    const newSubject = insRes.rows[0];

    // Fetch stream info for response
    const streamInfo = await query('SELECT name, code FROM streams WHERE id = $1', [assignedStreamId]);
    newSubject.stream_name = streamInfo.rows[0]?.name || '';
    newSubject.stream_code = streamInfo.rows[0]?.code || '';
    newSubject.teacher_count = 0;
    newSubject.assignment_count = 0;

    await logAudit({
      userId: req.user.id,
      action: 'SUBJECT_CREATED',
      entityType: 'SUBJECT',
      entityId: newSubject.id,
      details: {
        code: formattedCode,
        name: formattedName,
        grade_level: gLevel,
        stream_id: assignedStreamId,
        credit_hours: credits,
      },
    });

    res.status(201).json({
      success: true,
      message: `Subject "${formattedName}" (${formattedCode}) added successfully to the curriculum.`,
      data: newSubject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing academic subject
 */
const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, gradeLevel, streamId, creditHours } = req.body;

    const subCheck = await query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (subCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const existingSub = subCheck.rows[0];
    const newName = name !== undefined ? name.trim() : existingSub.name;
    const newCode = code !== undefined ? code.trim().toUpperCase() : existingSub.code;
    const newGrade = gradeLevel !== undefined ? parseInt(gradeLevel, 10) : existingSub.grade_level;
    const newCredits = creditHours !== undefined ? parseInt(creditHours, 10) : existingSub.credit_hours;
    let newStreamId = streamId !== undefined ? parseInt(streamId, 10) : existingSub.stream_id;

    if (!newName) {
      return res.status(400).json({ success: false, message: 'Subject name cannot be empty.' });
    }
    if (!newCode) {
      return res.status(400).json({ success: false, message: 'Subject code cannot be empty.' });
    }
    if (![9, 10, 11, 12].includes(newGrade)) {
      return res.status(400).json({ success: false, message: 'Invalid grade level (must be 9, 10, 11, or 12).' });
    }
    if (newCredits < 1 || newCredits > 10) {
      return res.status(400).json({ success: false, message: 'Credit hours must be between 1 and 10.' });
    }

    if (newGrade <= 10) {
      const generalStreamRes = await query("SELECT id FROM streams WHERE code = 'GENERAL' LIMIT 1");
      newStreamId = generalStreamRes.rows[0]?.id || 1;
    } else if (!newStreamId) {
      return res.status(400).json({ success: false, message: 'Stream is required for senior grades.' });
    }

    // Check code uniqueness across other subjects
    const codeConflict = await query('SELECT id, name FROM subjects WHERE UPPER(code) = $1 AND id != $2', [newCode, id]);
    if (codeConflict.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Another subject with code "${newCode}" already exists (${codeConflict.rows[0].name}).`,
      });
    }

    const updateRes = await query(
      `UPDATE subjects
       SET name = $1, code = $2, grade_level = $3, stream_id = $4, credit_hours = $5
       WHERE id = $6
       RETURNING *`,
      [newName, newCode, newGrade, newStreamId, newCredits, id]
    );

    const updatedSub = updateRes.rows[0];
    const streamInfo = await query('SELECT name, code FROM streams WHERE id = $1', [newStreamId]);
    updatedSub.stream_name = streamInfo.rows[0]?.name || '';
    updatedSub.stream_code = streamInfo.rows[0]?.code || '';

    await logAudit({
      userId: req.user.id,
      action: 'SUBJECT_UPDATED',
      entityType: 'SUBJECT',
      entityId: id,
      details: { name: newName, code: newCode, grade_level: newGrade, stream_id: newStreamId },
    });

    res.json({
      success: true,
      message: `Subject "${newName}" updated successfully.`,
      data: updatedSub,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Safely delete an academic subject (with dependency checks)
 */
const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subCheck = await query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (subCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    const subject = subCheck.rows[0];

    // Check teacher assignments
    const taCheck = await query('SELECT COUNT(*) FROM teacher_assignments WHERE subject_id = $1', [id]);
    const taCount = parseInt(taCheck.rows[0].count, 10);
    if (taCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject "${subject.name}" because it is currently assigned to ${taCount} teacher assignment(s). Please remove those teacher assignments first.`,
      });
    }

    // Check student grades records
    const grCheck = await query('SELECT COUNT(*) FROM grade_records WHERE subject_id = $1', [id]);
    const grCount = parseInt(grCheck.rows[0].count, 10);
    if (grCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject "${subject.name}" because it has ${grCount} official student grade record(s) attached.`,
      });
    }

    // Check study materials
    const matCheck = await query('SELECT COUNT(*) FROM study_materials WHERE subject_id = $1', [id]);
    const matCount = parseInt(matCheck.rows[0].count, 10);
    if (matCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject "${subject.name}" because ${matCount} study material(s) or textbook(s) are associated with it.`,
      });
    }

    await query('DELETE FROM subjects WHERE id = $1', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'SUBJECT_DELETED',
      entityType: 'SUBJECT',
      entityId: id,
      details: subject,
    });

    res.json({
      success: true,
      message: `Subject "${subject.name}" (${subject.code}) deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Admin Stream Criteria
 */
const updateStreamCriteria = async (req, res, next) => {
  try {
    const { criteriaId } = req.params;
    const { minOverallAverage, requiredSubjectsConfig } = req.body;

    const updateRes = await query(
      `UPDATE stream_criteria
       SET min_overall_average = COALESCE($1, min_overall_average),
           required_subjects_config = COALESCE($2, required_subjects_config),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [minOverallAverage, requiredSubjectsConfig, criteriaId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Stream criteria record not found.' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'STREAM_CRITERIA_UPDATED',
      entityType: 'STREAM_CRITERIA',
      entityId: criteriaId,
      details: { minOverallAverage, requiredSubjectsConfig },
    });

    res.json({ success: true, message: 'Stream criteria updated.', data: updateRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student applications with submitted Grade 8 official documents
 */
const getStudentDocuments = async (req, res, next) => {
  try {
    const { status } = req.query; // 'ALL', 'PENDING_ADMIN_VERIFICATION', 'APPROVED', 'REJECTED'
    let queryText = `
      SELECT s.id, s.student_id, s.date_of_birth, s.gender, s.phone, s.guardian_name, s.guardian_phone,
             s.grade8_document_name, s.grade8_document_data, s.grade8_document_type,
             s.document_status, s.document_submitted_at, s.admin_review_notes, s.admin_reviewed_at,
             s.prerequisite_verified, s.promotion_status,
             u.id as user_id, u.first_name, u.last_name, u.email, u.is_active,
             p.previous_school, p.total_score as prereq_total_score, p.average_score as prereq_average_score, p.status as prereq_status
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN prerequisites p ON s.student_id = p.student_id
    `;
    const params = [];
    if (status && status !== 'ALL') {
      queryText += ` WHERE s.document_status = $1`;
      params.push(status);
    }
    queryText += ` ORDER BY s.document_submitted_at DESC NULLS LAST, s.id DESC`;

    const result = await query(queryText, params);

    const rows = result.rows.map((row) => {
      let previewUrl = null;
      let signedUrl = null;

      if (row.grade8_document_data) {
        if (row.grade8_document_data.startsWith('data:image')) {
          previewUrl = row.grade8_document_data;
        } else if (row.grade8_document_data.includes('res.cloudinary.com')) {
          signedUrl = cloudinaryService.getSignedDownloadUrl(row.grade8_document_data);
          // For Cloudinary documents, page 1 JPG preview works universally with HTTP 200
          if (row.grade8_document_data.includes('/image/upload/')) {
            previewUrl = row.grade8_document_data
              .replace('/image/upload/', '/image/upload/pg_1/')
              .replace(/\.[^./]+$/i, '.jpg');
          }
        }
      }

      return {
        ...row,
        grade8_document_signed_url: signedUrl,
        grade8_document_preview_url: previewUrl,
        grade8_document_stream_url: `/api/admin/documents/${encodeURIComponent(row.student_id)}/view`,
      };
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream or download Grade 8 student document securely with administrative authorization
 */
const streamStudentDocument = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const isDownload = req.query.download === 'true' || req.query.download === '1';

    const result = await query(
      `SELECT s.grade8_document_name, s.grade8_document_data, s.grade8_document_type
       FROM students s
       WHERE LOWER(TRIM(s.student_id)) = LOWER(TRIM($1)) OR s.id::text = $1 OR s.user_id::text = $1`,
      [studentId]
    );

    if (!result.rows.length || !result.rows[0].grade8_document_data) {
      return res.status(404).json({ success: false, message: 'Grade 8 document not found for this student.' });
    }

    const doc = result.rows[0];
    const docData = doc.grade8_document_data;
    const docName = doc.grade8_document_name || 'Official_Grade8_Certificate.pdf';
    const docType = doc.grade8_document_type || 'application/pdf';

    // Base64 storage
    if (docData.startsWith('data:')) {
      const commaIdx = docData.indexOf(',');
      const base64Content = commaIdx !== -1 ? docData.slice(commaIdx + 1) : docData;
      const buffer = Buffer.from(base64Content, 'base64');
      const disposition = isDownload ? 'attachment' : 'inline';
      res.setHeader('Content-Type', docType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${docName.replace(/[^\w\s.-]/gi, '_')}"`);
      return res.send(buffer);
    }

    // Cloudinary or local disk file streaming
    return cloudinaryService.streamFileToResponse({
      fileUrl: docData,
      fileName: docName,
      mimeType: docType,
      isInline: !isDownload,
      res,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Administrator review (Approve or Reject) of student's official Grade 8 document
 */
const reviewStudentDocument = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { action, notes } = req.body; // 'APPROVE' or 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be 'APPROVE' or 'REJECT'." });
    }

    const isApproved = action === 'APPROVE';
    const newDocStatus = isApproved ? 'APPROVED' : 'REJECTED';

    const isNum = !isNaN(studentId);
    let updateRes;
    if (isNum) {
      updateRes = await query(
        `UPDATE students
         SET document_status = $1,
             prerequisite_verified = $2,
             admin_review_notes = $3,
             admin_reviewed_at = NOW(),
             admin_reviewer_id = $4
         WHERE id = $5
         RETURNING id, user_id, student_id, document_status, prerequisite_verified, admin_review_notes, admin_reviewed_at`,
        [newDocStatus, isApproved, notes || null, req.user.id, parseInt(studentId, 10)]
      );
    } else {
      updateRes = await query(
        `UPDATE students
         SET document_status = $1,
             prerequisite_verified = $2,
             admin_review_notes = $3,
             admin_reviewed_at = NOW(),
             admin_reviewer_id = $4
         WHERE student_id = $5
         RETURNING id, user_id, student_id, document_status, prerequisite_verified, admin_review_notes, admin_reviewed_at`,
        [newDocStatus, isApproved, notes || null, req.user.id, studentId]
      );
    }

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const updatedStudent = updateRes.rows[0];

    // Synchronize prerequisites table status and student account status
    if (isApproved) {
      // Upsert prerequisites to guarantee student has verified PASSED record
      await query(
        `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
         VALUES ($1, 'Applicant', 'Official Primary Record', EXTRACT(YEAR FROM NOW()), 560.0, 80.0, 'PASSED', TRUE)
         ON CONFLICT (student_id) DO UPDATE SET
           status = 'PASSED',
           verified = TRUE,
           average_score = CASE WHEN prerequisites.average_score < 50.0 THEN 80.0 ELSE prerequisites.average_score END,
           total_score = CASE WHEN prerequisites.total_score < 300.0 THEN 560.0 ELSE prerequisites.total_score END`,
        [updatedStudent.student_id]
      );

      // Ensure student account is active
      await query(
        `UPDATE users
         SET is_active = TRUE
         WHERE id = $1`,
        [updatedStudent.user_id]
      );

      // Notify student of approval
      try {
        await query(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            updatedStudent.user_id,
            'Grade 8 Document Approved',
            'Your Grade 8 certificate has been reviewed and approved by the Administrator. You are now cleared to choose your Grade 9 section and enroll in classes.',
            'DOCUMENT_APPROVED',
            '/student/enrollment',
          ]
        );
      } catch (notifErr) {
        console.warn('Student approval notification warning:', notifErr.message);
      }
    } else {
      // Upsert prerequisites to mark FAILED
      await query(
        `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
         VALUES ($1, 'Applicant', 'Official Primary Record', EXTRACT(YEAR FROM NOW()), 0.0, 0.0, 'FAILED', FALSE)
         ON CONFLICT (student_id) DO UPDATE SET
           status = 'FAILED',
           verified = FALSE`,
        [updatedStudent.student_id]
      );

      // CRITICAL: Deactivate the student account if they do not fulfill prerequisite
      await query(
        `UPDATE users
         SET is_active = FALSE
         WHERE id = $1`,
        [updatedStudent.user_id]
      );

      // Notify student of deactivation
      try {
        await query(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            updatedStudent.user_id,
            'Admission Application Rejected & Account Deactivated',
            `Your Grade 8 admission documents did not fulfill the requirements. Remarks: ${notes || 'Grade 8 prerequisite requirements not satisfied'}. Your student account has been deactivated.`,
            'ACCOUNT_DEACTIVATED',
            '/login',
          ]
        );
      } catch (notifErr) {
        console.warn('Student deactivation notification warning:', notifErr.message);
      }
    }

    await logAudit({
      userId: req.user.id,
      action: isApproved ? 'GRADE8_DOCUMENT_APPROVED' : 'GRADE8_DOCUMENT_REJECTED_DEACTIVATED',
      entityType: 'STUDENT_DOCUMENT',
      entityId: updatedStudent.id,
      details: {
        studentId: updatedStudent.student_id,
        status: newDocStatus,
        isStudentActive: isApproved,
        notes: notes || null,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: isApproved
        ? `Official Grade 8 document for student ${updatedStudent.student_id} approved. Student is now cleared for class enrollment.`
        : `Official Grade 8 document for student ${updatedStudent.student_id} rejected. Student account has been deactivated.`,
      data: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all official Ministry Grade 8 prerequisite examination records
 */
const getPrerequisites = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM prerequisites ORDER BY student_id ASC');
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a new official Ministry Grade 8 prerequisite examination record
 */
const createPrerequisite = async (req, res, next) => {
  try {
    const { studentId, fullName, previousSchool, completionYear, totalScore, averageScore, status } = req.body;
    if (!studentId || !fullName || !averageScore) {
      return res.status(400).json({ success: false, message: 'Student ID, full name, and average score are required.' });
    }
    const finalStatus = status || (parseFloat(averageScore) >= 50 ? 'PASSED' : 'FAILED');
    const result = await query(
      `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (student_id) DO UPDATE SET
         full_name = $2, previous_school = $3, completion_year = $4, total_score = $5, average_score = $6, status = $7
       RETURNING *`,
      [
        studentId.trim(),
        fullName.trim(),
        previousSchool || 'Primary School',
        completionYear || new Date().getFullYear(),
        totalScore || parseFloat(averageScore) * 7,
        parseFloat(averageScore),
        finalStatus,
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'PREREQUISITE_CREATED',
      entityType: 'PREREQUISITE',
      entityId: result.rows[0].id,
      details: { studentId: studentId.trim(), averageScore, status: finalStatus },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Official Grade 8 Ministry examination record for ${studentId} registered successfully.`,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user details (Name, Email) and sync student prerequisite full_name
 */
const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      bio,
      avatarUrl,
      // Teacher specific:
      qualification,
      specialization,
      // Student specific:
      address,
      currentGradeLevel,
      currentSectionId,
      currentStreamId,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'First name, last name, and email are required.' });
    }

    const updated = await query(
      `UPDATE users
       SET first_name = $1, last_name = $2, email = $3,
           phone = COALESCE($4, phone),
           bio = COALESCE($5, bio),
           avatar_url = COALESCE($6, avatar_url)
       WHERE id = $7
       RETURNING id, email, role, first_name, last_name, avatar_url, phone, bio`,
      [
        firstName.trim(),
        lastName.trim(),
        email.trim(),
        phone ? phone.trim() : null,
        bio ? bio.trim() : null,
        avatarUrl ? avatarUrl.trim() : null,
        userId,
      ]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = updated.rows[0];

    // If teacher, update teacher record
    if (user.role === 'teacher') {
      await query(
        `UPDATE teachers
         SET qualification = COALESCE($1, qualification),
             specialization = COALESCE($2, specialization),
             phone = COALESCE($3, phone)
         WHERE user_id = $4`,
        [
          qualification ? qualification.trim() : null,
          specialization ? specialization.trim() : null,
          phone ? phone.trim() : null,
          userId,
        ]
      );
    }

    // If student, update student record
    if (user.role === 'student') {
      let secGrade = currentGradeLevel ? parseInt(currentGradeLevel, 10) : null;
      let secStream = currentStreamId ? parseInt(currentStreamId, 10) : null;
      if (currentSectionId) {
        const secRes = await query('SELECT grade_level, stream_id FROM sections WHERE id = $1', [currentSectionId]);
        if (secRes.rows.length > 0) {
          secGrade = secRes.rows[0].grade_level;
          secStream = secRes.rows[0].stream_id;
        }
      }

      await query(
        `UPDATE students
         SET phone = COALESCE($1, phone),
             address = COALESCE($2, address),
             current_grade_level = COALESCE($3, current_grade_level),
             current_section_id = COALESCE($4, current_section_id),
             current_stream_id = COALESCE($5, current_stream_id)
         WHERE user_id = $6`,
        [
          phone ? phone.trim() : null,
          address ? address.trim() : null,
          secGrade,
          currentSectionId ? parseInt(currentSectionId, 10) : null,
          secStream,
          userId,
        ]
      );

      // If student name changed, sync prerequisites
      await query(
        `UPDATE prerequisites p
         SET full_name = $1
         FROM students s
         WHERE s.user_id = $2 AND p.student_id = s.student_id`,
        [`${firstName.trim()} ${lastName.trim()}`, userId]
      );
    }

    res.json({
      success: true,
      message: 'User profile and role assignments updated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete User (Strictly shields the Single Admin Account)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const uRes = await query('SELECT id, role, email, first_name, last_name FROM users WHERE id = $1', [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const targetUser = uRes.rows[0];

    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'The Primary System Administrator account cannot be deleted.',
      });
    }

    await query('DELETE FROM users WHERE id = $1', [userId]);

    await logAudit({
      userId: req.user.id,
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: userId,
      details: targetUser,
    });

    res.json({
      success: true,
      message: `User ${targetUser.first_name} ${targetUser.last_name} (${targetUser.email}) removed permanently.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get institutional settings and parameters
 */
const getSettings = async (req, res, next) => {
  try {
    const settingsRes = await query('SELECT key, value FROM system_settings');
    const settingsMap = {};
    for (const row of settingsRes.rows) {
      settingsMap[row.key] = row.value;
    }

    const yearRes = await query('SELECT id, year_name FROM academic_years WHERE is_current = TRUE LIMIT 1');
    const currentYear = yearRes.rows[0] || { id: 1, year_name: '2026-2027' };

    const schoolName = settingsMap['school_name']?.name || 'Addis International High School';
    const defaultCapacity = settingsMap['default_section_capacity']?.capacity !== undefined
      ? settingsMap['default_section_capacity'].capacity
      : 50;
    const minGrade8Gpa = settingsMap['prerequisite_min_pass_gpa']?.min_gpa !== undefined
      ? settingsMap['prerequisite_min_pass_gpa'].min_gpa
      : 50.0;
    const gradingPolicy = settingsMap['grading_policy'] || {
      quiz_weight: 10,
      midterm_weight: 30,
      assignment_weight: 20,
      final_weight: 40,
    };

    res.json({
      success: true,
      data: {
        schoolName,
        academicYear: currentYear.year_name,
        academicYearId: currentYear.id,
        defaultSectionCapacity: Number(defaultCapacity),
        minGrade8Gpa: Number(minGrade8Gpa),
        quizWeight: Number(gradingPolicy.quiz_weight),
        midtermWeight: Number(gradingPolicy.midterm_weight),
        assignmentWeight: Number(gradingPolicy.assignment_weight),
        finalWeight: Number(gradingPolicy.final_weight),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update institutional settings, academic parameters, section capacities, and grading policy
 */
const updateSettings = async (req, res, next) => {
  try {
    const {
      schoolName,
      academicYear,
      defaultSectionCapacity,
      minGrade8Gpa,
      quizWeight,
      midtermWeight,
      assignmentWeight,
      finalWeight,
    } = req.body;

    if (!schoolName || !schoolName.trim()) {
      return res.status(400).json({ success: false, message: 'Official school name is required.' });
    }
    if (!academicYear || !academicYear.trim()) {
      return res.status(400).json({ success: false, message: 'Academic year is required.' });
    }

    const capacityNum = parseInt(defaultSectionCapacity, 10);
    if (isNaN(capacityNum) || capacityNum < 10 || capacityNum > 150) {
      return res.status(400).json({ success: false, message: 'Section capacity must be between 10 and 150.' });
    }

    const gpaNum = parseFloat(minGrade8Gpa);
    if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 100) {
      return res.status(400).json({ success: false, message: 'Minimum GPA prerequisite must be between 0 and 100.' });
    }

    const qWeight = parseFloat(quizWeight);
    const mWeight = parseFloat(midtermWeight);
    const aWeight = parseFloat(assignmentWeight);
    const fWeight = parseFloat(finalWeight);

    if (isNaN(qWeight) || isNaN(mWeight) || isNaN(aWeight) || isNaN(fWeight)) {
      return res.status(400).json({ success: false, message: 'All assessment weights must be valid numbers.' });
    }
    if (qWeight < 0 || mWeight < 0 || aWeight < 0 || fWeight < 0) {
      return res.status(400).json({ success: false, message: 'Assessment weights cannot be negative.' });
    }

    const totalWeight = Math.round((qWeight + mWeight + aWeight + fWeight) * 100) / 100;
    if (totalWeight !== 100) {
      return res.status(400).json({
        success: false,
        message: `Assessment weights must total exactly 100%. Current total is ${totalWeight}%.`,
      });
    }

    const updatedData = await withTransaction(async (client) => {
      // 1. Update school name
      await client.query(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ('school_name', $1, 'Official School Name', NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ name: schoolName.trim() })]
      );

      // 2. Update default section capacity
      await client.query(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ('default_section_capacity', $1, 'Standard maximum student capacity per section', NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ capacity: capacityNum })]
      );

      // 3. Update prerequisite GPA
      await client.query(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ('prerequisite_min_pass_gpa', $1, 'Minimum Grade 8 GPA required for Grade 9 admission', NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ min_gpa: gpaNum })]
      );

      // 4. Update grading policy
      await client.query(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ('grading_policy', $1, 'Academic grading weights', NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({
          quiz_weight: qWeight,
          midterm_weight: mWeight,
          assignment_weight: aWeight,
          final_weight: fWeight,
        })]
      );

      // 5. Update academic year
      await client.query(
        `UPDATE academic_years SET year_name = $1 WHERE is_current = TRUE`,
        [academicYear.trim()]
      );

      return {
        schoolName: schoolName.trim(),
        academicYear: academicYear.trim(),
        defaultSectionCapacity: capacityNum,
        minGrade8Gpa: gpaNum,
        quizWeight: qWeight,
        midtermWeight: mWeight,
        assignmentWeight: aWeight,
        finalWeight: fWeight,
      };
    });

    await logAudit({
      userId: req.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entityType: 'SYSTEM_SETTINGS',
      entityId: 'global',
      details: updatedData,
    });

    res.json({
      success: true,
      message: 'System configuration and grading parameters saved successfully.',
      data: updatedData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics,
  getUsers,
  toggleUserStatus,
  updateUser,
  deleteUser,
  createSection,
  updateSection,
  deleteSection,
  updateSectionCapacity,
  getTeacherAssignments,
  createTeacherAssignment,
  updateTeacherAssignment,
  deleteTeacherAssignment,
  updateStreamCriteria,
  getStudentDocuments,
  reviewStudentDocument,
  getPrerequisites,
  createPrerequisite,
  getSettings,
  updateSettings,
  createSubject,
  updateSubject,
  deleteSubject,
  streamStudentDocument,
};
