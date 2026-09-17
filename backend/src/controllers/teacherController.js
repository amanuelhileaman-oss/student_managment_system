const { query, withTransaction } = require('../config/db');
const { propagateGroupScore, calculateLetterGrade } = require('../services/gradingService');
const { logAudit } = require('../services/auditService');

/**
 * Helper to get teacher ID from authenticated user ID
 */
const getTeacherByUserId = async (userId) => {
  let res = await query('SELECT * FROM teachers WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) {
    const userRes = await query("SELECT id, first_name, last_name FROM users WHERE id = $1 AND LOWER(role) = 'teacher'", [userId]);
    if (userRes.rows.length > 0) {
      const teacherCode = `TCH-${new Date().getFullYear()}-${String(userId).padStart(3, '0')}`;
      const insertRes = await query(
        `INSERT INTO teachers (user_id, teacher_id, qualification, specialization, years_of_experience, is_approved)
         VALUES ($1, $2, 'Faculty Member', 'Academic', 1, TRUE)
         ON CONFLICT (user_id) DO UPDATE SET is_approved = TRUE
         RETURNING *`,
        [userId, teacherCode]
      );
      return insertRes.rows[0];
    }
    return null;
  }
  return res.rows[0];
};

/**
 * Get assigned subjects and sections for teacher
 */
const getAssignedClasses = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const result = await query(
      `SELECT ta.id as assignment_id, ta.teacher_id, ta.subject_id, ta.section_id, ta.academic_year_id,
              s.name as subject_name, s.code as subject_code, s.grade_level,
              sec.section_name, sec.capacity,
              st.name as stream_name, st.code as stream_code,
              ay.year_name,
              COUNT(e.id) as student_count
       FROM teacher_assignments ta
       JOIN subjects s ON ta.subject_id = s.id
       JOIN sections sec ON ta.section_id = sec.id
       JOIN streams st ON sec.stream_id = st.id
       JOIN academic_years ay ON ta.academic_year_id = ay.id
       LEFT JOIN enrollments e ON sec.id = e.section_id AND e.status = 'ENROLLED'
       WHERE (ta.teacher_id = $1 OR ta.teacher_id = $2)
       GROUP BY ta.id, s.name, s.code, s.grade_level, sec.section_name, sec.capacity, st.name, st.code, ay.year_name
       ORDER BY s.grade_level ASC, sec.section_name ASC`,
      [teacher.id, req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get enrolled students in an assigned section
 */
const getClassStudents = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { sectionId } = req.params;

    // Verify teacher is assigned to this section
    const authCheck = await query(
      'SELECT id FROM teacher_assignments WHERE (teacher_id = $1 OR teacher_id = $3) AND section_id = $2',
      [teacher.id, parseInt(sectionId, 10), req.user.id]
    );
    if (authCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view students for this section.',
      });
    }

    const result = await query(
      `SELECT s.id as student_id, s.student_id as student_code, s.phone, s.gender,
              u.first_name, u.last_name, u.email,
              e.enrolled_at, e.status
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE e.section_id = $1 AND e.status = 'ENROLLED'
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [parseInt(sectionId, 10)]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get grade records for an assigned subject & section
 */
const getGradeRecords = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { subjectId, sectionId } = req.query;
    if (!subjectId || !sectionId) {
      return res.status(400).json({ success: false, message: 'subjectId and sectionId are required.' });
    }

    // Verify authorization
    const authCheck = await query(
      'SELECT id, academic_year_id FROM teacher_assignments WHERE (teacher_id = $1 OR teacher_id = $4) AND subject_id = $2 AND section_id = $3',
      [teacher.id, parseInt(subjectId, 10), parseInt(sectionId, 10), req.user.id]
    );
    if (authCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to enter or view results for this class.',
      });
    }

    // Retrieve roster and matching grades
    const result = await query(
      `SELECT s.id as student_id, s.student_id as student_code,
              u.first_name, u.last_name,
              gr.id as grade_id, gr.quiz_score, gr.midterm_score, gr.assignment_score, gr.final_score,
              gr.total_score, gr.letter_grade, gr.remarks,
              lg.group_code, lg.group_name, lg.group_score as evaluated_group_score,
              lg.group_status, lg.assignment_title, lg.max_score as assignment_max_score
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN grade_records gr ON s.id = gr.student_id AND gr.subject_id = $1 AND gr.section_id = $2
       LEFT JOIN LATERAL (
         SELECT ag.group_code, ag.group_name, ag.group_score, ag.status as group_status,
                a.title as assignment_title, a.max_score
         FROM assignment_group_members agm
         JOIN assignment_groups ag ON agm.group_id = ag.id
         JOIN assignments a ON ag.assignment_id = a.id
         JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
         WHERE agm.student_id = s.id AND ta.subject_id = $1 AND ta.section_id = $2
         ORDER BY ag.created_at DESC
         LIMIT 1
       ) lg ON true
       WHERE e.section_id = $2 AND e.status = 'ENROLLED'
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [parseInt(subjectId, 10), parseInt(sectionId, 10)]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Update individual student grade record (Quiz, Midterm, Final)
 */
const updateStudentGrade = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { studentId, subjectId, sectionId, quizScore = 0, midtermScore = 0, assignmentScore = 0, finalScore = 0, remarks = '' } = req.body;

    // Verify authorization
    const authCheck = await query(
      'SELECT academic_year_id FROM teacher_assignments WHERE (teacher_id = $1 OR teacher_id = $4) AND subject_id = $2 AND section_id = $3',
      [teacher.id, parseInt(subjectId, 10), parseInt(sectionId, 10), req.user.id]
    );
    if (authCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to enter results for this section.',
      });
    }
    const yearId = authCheck.rows[0].academic_year_id;

    // Validate score ranges dynamically against active grading policy
    const q = parseFloat(quizScore);
    const m = parseFloat(midtermScore);
    const a = parseFloat(assignmentScore);
    const f = parseFloat(finalScore);

    let maxQ = 10, maxM = 30, maxA = 20, maxF = 40;
    try {
      const policyRes = await query("SELECT value FROM system_settings WHERE key = 'grading_policy' LIMIT 1");
      if (policyRes.rows.length > 0 && policyRes.rows[0].value) {
        const pol = policyRes.rows[0].value;
        if (pol.quiz_weight !== undefined) maxQ = Number(pol.quiz_weight);
        if (pol.midterm_weight !== undefined) maxM = Number(pol.midterm_weight);
        if (pol.assignment_weight !== undefined) maxA = Number(pol.assignment_weight);
        if (pol.final_weight !== undefined) maxF = Number(pol.final_weight);
      }
    } catch (e) {
      // Fallback to default weights
    }

    if (q < 0 || q > maxQ || m < 0 || m > maxM || a < 0 || a > maxA || f < 0 || f > maxF) {
      return res.status(400).json({
        success: false,
        message: `Score limits exceeded for current grading policy: Quiz (0-${maxQ}), Midterm (0-${maxM}), Assignment (0-${maxA}), Final (0-${maxF}).`,
      });
    }

    const total = q + m + a + f;
    const letter = calculateLetterGrade(total);

    // Resolve student integer ID whether numeric PK or student_code (e.g. STU-2026-001) is passed
    let resolvedStudentId = parseInt(studentId, 10);
    if (isNaN(resolvedStudentId)) {
      const sRes = await query('SELECT id FROM students WHERE student_id = $1', [studentId]);
      if (sRes.rows.length > 0) {
        resolvedStudentId = sRes.rows[0].id;
      } else {
        return res.status(404).json({ success: false, message: 'Student record not found.' });
      }
    }

    const gradeRes = await query(
      `INSERT INTO grade_records
        (student_id, subject_id, section_id, academic_year_id, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (student_id, subject_id, academic_year_id)
       DO UPDATE SET
         quiz_score = $5,
         midterm_score = $6,
         assignment_score = $7,
         final_score = $8,
         total_score = $9,
         letter_grade = $10,
         remarks = $11,
         updated_by = $12,
         updated_at = NOW()
       RETURNING *`,
      [resolvedStudentId, parseInt(subjectId, 10), parseInt(sectionId, 10), yearId, q, m, a, f, total, letter, remarks, req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'GRADE_ENTRY_UPDATE',
      entityType: 'GRADE_RECORD',
      entityId: gradeRes.rows[0].id,
      details: { studentId, subjectId, total, letter },
    });

    res.json({
      success: true,
      message: 'Grade recorded successfully.',
      data: gradeRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get assignments created by teacher
 */
const getAssignments = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const result = await query(
      `SELECT a.id, a.title, a.description, a.assignment_type, a.max_score, a.due_date, a.instructions, a.created_at,
              a.file_url, a.file_name, a.file_size, a.file_type,
              s.name as subject_name, sec.section_name, sec.grade_level,
              COUNT(DISTINCT ag.id) as group_count
       FROM assignments a
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN sections sec ON ta.section_id = sec.id
       LEFT JOIN assignment_groups ag ON a.id = ag.assignment_id
       WHERE ta.teacher_id = $1 OR ta.teacher_id = $2 OR (ta.subject_id, ta.section_id) IN (
         SELECT subject_id, section_id FROM teacher_assignments WHERE teacher_id = $1 OR teacher_id = $2
       )
       GROUP BY a.id, s.name, sec.section_name, sec.grade_level, a.file_url, a.file_name, a.file_size, a.file_type
       ORDER BY a.created_at DESC`,
      [teacher.id, req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Create an individual or group assignment (with optional file / document attachment)
 */
const createAssignment = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { teacherAssignmentId, title, description, assignmentType = 'INDIVIDUAL', maxScore = 20, dueDate, instructions } = req.body;

    if (!teacherAssignmentId) {
      return res.status(400).json({ success: false, message: 'Please select a designated class.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Assignment title is required.' });
    }
    if (!dueDate) {
      return res.status(400).json({ success: false, message: 'Submission due date is required.' });
    }

    // Verify teacher owns the assignment
    const authCheck = await query('SELECT id FROM teacher_assignments WHERE id = $1 AND (teacher_id = $2 OR teacher_id = $3)', [teacherAssignmentId, teacher.id, req.user.id]);
    if (authCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class.' });
    }

    const finalDesc = (description && description.trim()) || (instructions && instructions.trim()) || '';
    const finalInst = (instructions && instructions.trim()) || (description && description.trim()) || '';

    // File attachment (PDF, Word, Doc, PPT, TXT, etc.)
    const fileUrl = req.file ? `/uploads/assignments/${req.file.filename}` : null;
    const fileName = req.file ? req.file.originalname : null;
    const fileSize = req.file ? req.file.size : 0;
    const fileType = req.file ? req.file.mimetype : null;

    const insRes = await query(
      `INSERT INTO assignments (teacher_assignment_id, title, description, assignment_type, max_score, due_date, instructions, file_url, file_name, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [teacherAssignmentId, title.trim(), finalDesc, assignmentType, parseFloat(maxScore) || 20, dueDate, finalInst, fileUrl, fileName, fileSize, fileType]
    );

    await logAudit({
      userId: req.user.id,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'ASSIGNMENT',
      entityId: insRes.rows[0].id,
      details: { title: title.trim(), type: assignmentType, fileName },
    });

    res.status(201).json({ success: true, message: 'Assignment created successfully.', data: insRes.rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an assignment
 */
const deleteAssignment = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { id } = req.params;
    const authCheck = await query(
      `SELECT a.id, a.title FROM assignments a
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       WHERE a.id = $1 AND (
         ta.teacher_id = $2 OR ta.teacher_id = $3 OR (ta.subject_id, ta.section_id) IN (
           SELECT subject_id, section_id FROM teacher_assignments WHERE teacher_id = $2 OR teacher_id = $3
         )
       )`,
      [id, teacher.id, req.user.id]
    );
    if (authCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this assignment.' });
    }

    await query('DELETE FROM assignments WHERE id = $1', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'ASSIGNMENT_DELETED',
      entityType: 'ASSIGNMENT',
      entityId: id,
      details: { title: authCheck.rows[0].title },
    });

    res.json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get groups for a specific assignment, including submission status and student roster
 */
const getAssignmentGroups = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { id } = req.params;
    const result = await query(
      `SELECT ag.id, ag.assignment_id, ag.group_code, ag.group_name, ag.group_score, ag.evaluated_at,
              ag.submission_content, ag.submission_file_url, ag.submission_file_name, ag.submission_file_size, ag.submission_file_type,
              ag.submitted_at, ag.submitted_by, ag.status,
              sub_u.first_name as submitter_first_name, sub_u.last_name as submitter_last_name,
              a.due_date, (NOW() > a.due_date) as is_overdue,
              COALESCE(
                json_agg(
                  json_build_object(
                    'student_id', s.id,
                    'student_code', s.student_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name
                  )
                ) FILTER (WHERE s.id IS NOT NULL), '[]'
              ) as members
       FROM assignment_groups ag
       JOIN assignments a ON ag.assignment_id = a.id
       LEFT JOIN assignment_group_members agm ON ag.id = agm.group_id
       LEFT JOIN students s ON agm.student_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN students sub_s ON ag.submitted_by = sub_s.id
       LEFT JOIN users sub_u ON sub_s.user_id = sub_u.id
       WHERE ag.assignment_id = $1
       GROUP BY ag.id, sub_u.first_name, sub_u.last_name, a.due_date
       ORDER BY ag.created_at ASC`,
      [id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all students enrolled in the section for an assignment,
 * along with their current group status so the teacher can pick members.
 */
const getAssignmentSectionStudents = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { id } = req.params;

    // Verify teacher authorization for this assignment
    const assignCheck = await query(
      `SELECT a.id, a.title, a.assignment_type, a.max_score, a.due_date,
              ta.section_id, ta.subject_id, sec.section_name, s.name as subject_name
       FROM assignments a
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       JOIN sections sec ON ta.section_id = sec.id
       JOIN subjects s ON ta.subject_id = s.id
       WHERE a.id = $1 AND (
         ta.teacher_id = $2 OR ta.teacher_id = $3 OR (ta.subject_id, ta.section_id) IN (
           SELECT subject_id, section_id FROM teacher_assignments WHERE teacher_id = $2 OR teacher_id = $3
         )
       )`,
      [id, teacher.id, req.user.id]
    );

    if (assignCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to assignment section.' });
    }

    const assignInfo = assignCheck.rows[0];

    // Fetch students enrolled in this section and identify any existing group assignment
    const studentsRes = await query(
      `SELECT s.id as student_id, s.student_id as student_code, s.gender,
              u.first_name, u.last_name, u.email,
              ag.id as current_group_id,
              ag.group_code as current_group_code,
              ag.group_name as current_group_name
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN assignment_group_members agm ON agm.student_id = s.id
       LEFT JOIN assignment_groups ag ON agm.group_id = ag.id AND ag.assignment_id = $1
       WHERE e.section_id = $2 AND e.status = 'ENROLLED'
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [id, assignInfo.section_id]
    );

    res.json({
      success: true,
      data: {
        assignment: assignInfo,
        students: studentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a group with unique Group Code and assigned student members
 */
const createAssignmentGroup = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { assignmentId, groupName, studentIds = [] } = req.body;

    const assignCheck = await query(
      `SELECT a.id, s.code as subject_code, sec.section_name, sec.grade_level
       FROM assignments a
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN sections sec ON ta.section_id = sec.id
       WHERE a.id = $1 AND (
         ta.teacher_id = $2 OR ta.teacher_id = $3 OR (ta.subject_id, ta.section_id) IN (
           SELECT subject_id, section_id FROM teacher_assignments WHERE teacher_id = $2 OR teacher_id = $3
         )
       )`,
      [assignmentId, teacher.id, req.user.id]
    );
    if (assignCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized assignment group creation.' });
    }

    const info = assignCheck.rows[0];
    const groupCode = `GROUP-${info.subject_code.replace(/[^A-Z0-9]/gi, '')}-${info.section_name}-${Date.now().toString().slice(-4)}`;

    const groupResult = await withTransaction(async (client) => {
      const gRes = await client.query(
        `INSERT INTO assignment_groups (assignment_id, group_code, group_name, status)
         VALUES ($1, $2, $3, 'PENDING')
         RETURNING *`,
        [assignmentId, groupCode, groupName]
      );
      const group = gRes.rows[0];

      for (const sId of studentIds) {
        await client.query(
          `INSERT INTO assignment_group_members (group_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (group_id, student_id) DO NOTHING`,
          [group.id, sId]
        );
      }

      return group;
    });

    res.status(201).json({
      success: true,
      message: `Group created with Group Code: ${groupCode}`,
      data: groupResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit Group Score and automatically propagate to all group members
 */
const submitGroupScore = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { groupCode, groupScore } = req.body;
    if (!groupCode || groupScore === undefined) {
      return res.status(400).json({ success: false, message: 'Group code and group score are required.' });
    }

    const result = await propagateGroupScore({
      groupCode: groupCode.trim(),
      groupScore: parseFloat(groupScore),
      teacherDbId: teacher.id,
      userId: req.user.id,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Synchronize / Auto-propagate group assignment scores into the grade records.
 * Supports syncing by groupCode, by assignmentId, or across the whole subject/section class.
 */
const syncSectionGroupScores = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { groupCode, subjectId, sectionId, assignmentId } = req.body;

    if (groupCode) {
      const result = await propagateGroupScore({
        groupCode: groupCode.trim(),
        groupScore: req.body.groupScore !== undefined ? parseFloat(req.body.groupScore) : undefined,
        teacherDbId: teacher.id,
        userId: req.user.id,
      });
      return res.json(result);
    }

    // Otherwise, find all evaluated groups
    let groupsQuery = `
      SELECT ag.group_code, ag.group_score
      FROM assignment_groups ag
      JOIN assignments a ON ag.assignment_id = a.id
      JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
      WHERE (ta.teacher_id = $1 OR ta.teacher_id = $2 OR (ta.subject_id, ta.section_id) IN (
        SELECT subject_id, section_id FROM teacher_assignments WHERE teacher_id = $1 OR teacher_id = $2
      ))
        AND ag.group_score IS NOT NULL
    `;
    const params = [teacher.id, req.user.id];

    if (assignmentId) {
      params.push(assignmentId);
      groupsQuery += ` AND a.id = $${params.length}`;
    } else if (subjectId && sectionId) {
      params.push(parseInt(subjectId, 10), parseInt(sectionId, 10));
      groupsQuery += ` AND ta.subject_id = $${params.length - 1} AND ta.section_id = $${params.length}`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide groupCode, or subjectId & sectionId, or assignmentId to sync scores.',
      });
    }

    const groupsRes = await query(groupsQuery, params);
    let totalPropagated = 0;
    const syncedGroups = [];

    for (const row of groupsRes.rows) {
      try {
        const propRes = await propagateGroupScore({
          groupCode: row.group_code,
          groupScore: parseFloat(row.group_score),
          teacherDbId: teacher.id,
          userId: req.user.id,
        });
        totalPropagated += propRes.updatedMembersCount || 0;
        syncedGroups.push(row.group_code);
      } catch (err) {
        console.warn(`Could not sync group ${row.group_code}:`, err.message);
      }
    }

    return res.json({
      success: true,
      message: `Synchronized ${syncedGroups.length} project group(s) with ${totalPropagated} student grade record(s) updated.`,
      syncedGroups,
      totalStudentsUpdated: totalPropagated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get teacher's schedule timetable
 */
const getTeacherSchedule = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const result = await query(
      `WITH ordered_sections AS (
         SELECT id,
                ROW_NUMBER() OVER (
                  ORDER BY grade_level ASC, 
                           COALESCE(stream_id, 1) ASC, 
                           section_name ASC, 
                           id ASC
                ) as row_num
         FROM sections
         WHERE is_active = TRUE AND section_name NOT LIKE 'T-%'
       )
       SELECT sch.id, sch.day_of_week, sch.start_time, sch.end_time, sch.period_number,
              COALESCE('Room ' || LPAD(os.row_num::text, 2, '0'), sch.room_number) as room_number,
              s.name as subject_name, s.code as subject_code, s.grade_level,
              sec.section_name, sec.grade_level as section_grade_level,
              COALESCE(st.name, 'General Stream') as stream_name
       FROM schedules sch
       JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN sections sec ON ta.section_id = sec.id
       LEFT JOIN ordered_sections os ON os.id = sec.id
       LEFT JOIN streams st ON sec.stream_id = st.id
       WHERE ta.teacher_id = $1 OR ta.teacher_id IN (SELECT id FROM teachers WHERE user_id = $2)
       ORDER BY
         CASE sch.day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
         END,
         sch.period_number ASC`,
      [teacher.id, req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Look up a group by its group_code to retrieve its evaluated group score, members, and details
 */
const getGroupByCode = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Group code is required.' });
    }

    const result = await query(
      `SELECT ag.id, ag.group_code, ag.group_name, ag.group_score, ag.evaluated_at, ag.status,
              ag.submission_content, ag.submission_file_url, ag.submission_file_name, ag.submission_file_size, ag.submission_file_type, ag.submitted_at,
              a.id as assignment_id, a.title as assignment_title, a.max_score,
              ta.subject_id, ta.section_id,
              s.name as subject_name, sec.section_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'student_id', st.id,
                    'student_code', st.student_id,
                    'first_name', u.first_name,
                    'last_name', u.last_name
                  )
                ) FILTER (WHERE st.id IS NOT NULL), '[]'
              ) as members
       FROM assignment_groups ag
       JOIN assignments a ON ag.assignment_id = a.id
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN sections sec ON ta.section_id = sec.id
       LEFT JOIN assignment_group_members agm ON ag.id = agm.group_id
       LEFT JOIN students st ON agm.student_id = st.id
       LEFT JOIN users u ON st.user_id = u.id
       WHERE UPPER(TRIM(ag.group_code)) = UPPER(TRIM($1)) AND (
         ta.teacher_id = $2 OR ta.teacher_id = $3 OR (ta.subject_id, ta.section_id) IN (
           SELECT subject_id, section_id FROM teacher_assignments WHERE teacher_id = $2 OR teacher_id = $3
         )
       )
       GROUP BY ag.id, a.id, ta.subject_id, ta.section_id, s.name, sec.section_name`,
      [code.trim(), teacher.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No group found with code "${code}" assigned to your classes.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssignedClasses,
  getClassStudents,
  getGradeRecords,
  updateStudentGrade,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getAssignmentGroups,
  getAssignmentSectionStudents,
  createAssignmentGroup,
  submitGroupScore,
  syncSectionGroupScores,
  getGroupByCode,
  getTeacherSchedule,
};
