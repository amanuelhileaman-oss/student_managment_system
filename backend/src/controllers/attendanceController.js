const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../services/auditService');

/**
 * Helper to get teacher record by user ID
 */
const getTeacherByUserId = async (userId) => {
  let res = await query('SELECT * FROM teachers WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) {
    const userRes = await query(
      "SELECT id, first_name, last_name FROM users WHERE id = $1 AND LOWER(role) = 'teacher'",
      [userId]
    );
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
 * Helper to get student record by user ID
 */
const getStudentByUserId = async (userId) => {
  const res = await query('SELECT * FROM students WHERE user_id = $1', [userId]);
  return res.rows.length > 0 ? res.rows[0] : null;
};

/**
 * Get enrolled students and attendance roster for an assigned class on a specific date
 * GET /api/teachers/attendance?sectionId=X&subjectId=Y&date=YYYY-MM-DD
 */
const getSectionAttendance = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    const { sectionId, subjectId, date } = req.query;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'Section ID is required.' });
    }

    const secId = parseInt(sectionId, 10);
    const subId = subjectId ? parseInt(subjectId, 10) : null;
    const targetDate = date ? String(date).trim() : new Date().toISOString().slice(0, 10);

    // Validate that the teacher is assigned to this section (and subject if provided)
    let authQuery = 'SELECT id FROM teacher_assignments WHERE (teacher_id = $1 OR teacher_id = $2) AND section_id = $3';
    const authParams = [teacher.id, req.user.id, secId];
    if (subId) {
      authQuery += ' AND subject_id = $4';
      authParams.push(subId);
    }

    const authCheck = await query(authQuery, authParams);
    if (authCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view or manage attendance for this section.',
      });
    }

    // Get section and subject metadata
    const metaRes = await query(
      `SELECT sec.id as section_id, sec.section_name, sec.grade_level, sec.capacity,
              st.name as stream_name, st.code as stream_code,
              s.id as subject_id, s.name as subject_name, s.code as subject_code
       FROM sections sec
       JOIN streams st ON sec.stream_id = st.id
       LEFT JOIN subjects s ON s.id = $2
       WHERE sec.id = $1`,
      [secId, subId]
    );

    const classInfo = metaRes.rows.length > 0 ? metaRes.rows[0] : {};

    // Get all enrolled students in this section along with their attendance record on targetDate
    const studentsRes = await query(
      `SELECT s.id as student_id, s.student_id as student_code, s.gender, s.phone,
              u.first_name, u.last_name, u.email, u.avatar_url,
              att.id as attendance_id, att.status, att.remarks, att.date, att.updated_at,
              -- Historical attendance percentage for this student in this section
              (
                SELECT ROUND(
                  (COUNT(CASE WHEN past_a.status = 'PRESENT' THEN 1 END) * 100.0) /
                  NULLIF(COUNT(*), 0), 1
                )
                FROM attendance past_a
                WHERE past_a.student_id = s.id AND past_a.section_id = $1
              ) as past_attendance_rate,
              -- Total historical absences for this student in this section
              (
                SELECT COUNT(*)
                FROM attendance past_a
                WHERE past_a.student_id = s.id AND past_a.section_id = $1 AND past_a.status = 'ABSENT'
              ) as past_absence_count
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN attendance att ON att.student_id = s.id 
                               AND att.section_id = $1 
                               AND (att.subject_id = $2 OR ($2 IS NULL AND att.subject_id IS NULL))
                               AND att.date = $3
       WHERE e.section_id = $1 AND e.status = 'ENROLLED'
       ORDER BY u.first_name ASC, u.last_name ASC`,
      [secId, subId, targetDate]
    );

    const students = studentsRes.rows;

    // Compute live stats for targetDate
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let unmarkedCount = 0;

    students.forEach((s) => {
      if (s.status === 'PRESENT') presentCount++;
      else if (s.status === 'ABSENT') absentCount++;
      else if (s.status === 'LATE') lateCount++;
      else if (s.status === 'EXCUSED') excusedCount++;
      else unmarkedCount++;
    });

    const totalStudents = students.length;
    const markedCount = totalStudents - unmarkedCount;
    const isRecorded = markedCount > 0;

    // Calculate daily attendance percentage
    const validDenom = totalStudents - excusedCount;
    const attendanceRate =
      validDenom > 0 ? Math.round((presentCount / validDenom) * 100) : 0;

    res.json({
      success: true,
      data: {
        classInfo,
        date: targetDate,
        isRecorded,
        stats: {
          totalStudents,
          markedCount,
          unmarkedCount,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          attendanceRate,
        },
        students,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk save/update attendance for an entire class on a specific date
 * POST /api/teachers/attendance
 * Body: { sectionId, subjectId, date, records: [{ studentId, status, remarks }] }
 */
const saveSectionAttendance = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    const { sectionId, subjectId, date, records } = req.body;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'Section ID is required.' });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Attendance records array is required.' });
    }

    const secId = parseInt(sectionId, 10);
    const subId = subjectId ? parseInt(subjectId, 10) : null;
    const targetDate = date ? String(date).trim() : new Date().toISOString().slice(0, 10);

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Verify teacher assignment authorization
    let authQuery = 'SELECT id FROM teacher_assignments WHERE (teacher_id = $1 OR teacher_id = $2) AND section_id = $3';
    const authParams = [teacher.id, req.user.id, secId];
    if (subId) {
      authQuery += ' AND subject_id = $4';
      authParams.push(subId);
    }

    const authCheck = await query(authQuery, authParams);
    if (authCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to record attendance for this section.',
      });
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

    // Perform atomic transaction to upsert all attendance entries
    const savedRecords = await withTransaction(async (client) => {
      const results = [];

      for (const rec of records) {
        const studentId = parseInt(rec.studentId, 10);
        if (isNaN(studentId)) continue;

        const status = String(rec.status || 'PRESENT').toUpperCase();
        if (!validStatuses.includes(status)) {
          throw new Error(`Invalid status "${rec.status}" for student ID ${studentId}. Valid: ${validStatuses.join(', ')}`);
        }

        const remarks = rec.remarks ? String(rec.remarks).trim() : null;

        const upsertRes = await client.query(
          `INSERT INTO attendance (student_id, section_id, subject_id, teacher_id, date, status, remarks, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (student_id, section_id, COALESCE(subject_id, -1), date)
           DO UPDATE SET
             status = EXCLUDED.status,
             remarks = EXCLUDED.remarks,
             teacher_id = EXCLUDED.teacher_id,
             updated_at = NOW()
           RETURNING *`,
          [studentId, secId, subId, teacher.id, targetDate, status, remarks]
        );

        results.push(upsertRes.rows[0]);
      }

      return results;
    });

    // Record audit log
    await logAudit({
      userId: req.user.id,
      action: 'ATTENDANCE_RECORDED',
      entityType: 'ATTENDANCE',
      entityId: secId,
      details: {
        sectionId: secId,
        subjectId: subId,
        date: targetDate,
        totalMarked: savedRecords.length,
      },
    });

    res.json({
      success: true,
      message: `Successfully recorded attendance for ${savedRecords.length} students on ${targetDate}.`,
      data: {
        date: targetDate,
        totalSaved: savedRecords.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance history logs and at-risk students for a class
 * GET /api/teachers/attendance/history?sectionId=X&subjectId=Y
 */
const getAttendanceHistory = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    const { sectionId, subjectId } = req.query;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'Section ID is required.' });
    }

    const secId = parseInt(sectionId, 10);
    const subId = subjectId ? parseInt(subjectId, 10) : null;

    // 1. Daily logs history
    const historyRes = await query(
      `SELECT a.date,
              COUNT(a.id) as total_students,
              COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_count,
              COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as late_count,
              COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) as absent_count,
              COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END) as excused_count,
              ROUND(
                (COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) * 100.0) /
                NULLIF(COUNT(CASE WHEN a.status != 'EXCUSED' THEN 1 END), 0),
                1
              ) as attendance_rate
       FROM attendance a
       WHERE a.section_id = $1 AND (a.subject_id = $2 OR ($2 IS NULL AND a.subject_id IS NULL))
       GROUP BY a.date
       ORDER BY a.date DESC
       LIMIT 30`,
      [secId, subId]
    );

    // 2. Identify students with low attendance (< 75%) or high absences (>= 3 absences)
    const atRiskRes = await query(
      `SELECT s.id as student_id, s.student_id as student_code,
              u.first_name, u.last_name, u.email,
              COUNT(a.id) as total_recorded_days,
              COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_days,
              COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as late_days,
              COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) as absent_days,
              COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END) as excused_days,
              ROUND(
                (COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) * 100.0) /
                NULLIF(COUNT(a.id), 0),
                1
              ) as attendance_percentage
       FROM enrollments e
       JOIN students s ON e.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN attendance a ON a.student_id = s.id AND a.section_id = e.section_id
       WHERE e.section_id = $1 AND e.status = 'ENROLLED'
         AND (a.subject_id = $2 OR ($2 IS NULL AND a.subject_id IS NULL))
       GROUP BY s.id, s.student_id, u.first_name, u.last_name, u.email
       HAVING (
         (COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) * 100.0) / NULLIF(COUNT(a.id), 0) < 75.0
         OR COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) >= 3
       )
       ORDER BY absent_days DESC, attendance_percentage ASC`,
      [secId, subId]
    );

    res.json({
      success: true,
      data: {
        history: historyRes.rows,
        atRiskStudents: atRiskRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get personal attendance summary and history for the logged-in student
 * GET /api/students/attendance
 */
const getMyStudentAttendance = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    // Overall summary metrics
    const statsRes = await query(
      `SELECT COUNT(a.id) as total_sessions,
              COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_count,
              COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as late_count,
              COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) as absent_count,
              COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END) as excused_count,
              ROUND(
                (COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) * 100.0) /
                NULLIF(COUNT(a.id), 0),
                1
              ) as overall_attendance_rate
       FROM attendance a
       WHERE a.student_id = $1`,
      [student.id]
    );

    const stats = statsRes.rows[0] || {
      total_sessions: 0,
      present_count: 0,
      late_count: 0,
      absent_count: 0,
      excused_count: 0,
      overall_attendance_rate: 100,
    };

    // Detailed recent records log
    const recordsRes = await query(
      `SELECT a.id, a.date, a.status, a.remarks, a.created_at,
              COALESCE(s.name, 'General Class Attendance') as subject_name,
              s.code as subject_code,
              u.first_name as teacher_first_name,
              u.last_name as teacher_last_name
       FROM attendance a
       LEFT JOIN subjects s ON a.subject_id = s.id
       JOIN teachers t ON a.teacher_id = t.id
       JOIN users u ON t.user_id = u.id
       WHERE a.student_id = $1
       ORDER BY a.date DESC, a.created_at DESC
       LIMIT 50`,
      [student.id]
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalSessions: parseInt(stats.total_sessions || 0, 10),
          presentCount: parseInt(stats.present_count || 0, 10),
          lateCount: parseInt(stats.late_count || 0, 10),
          absentCount: parseInt(stats.absent_count || 0, 10),
          excusedCount: parseInt(stats.excused_count || 0, 10),
          overallAttendanceRate: parseFloat(stats.overall_attendance_rate || 100),
        },
        records: recordsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSectionAttendance,
  saveSectionAttendance,
  getAttendanceHistory,
  getMyStudentAttendance,
};
