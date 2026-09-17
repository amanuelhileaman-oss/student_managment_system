const { query } = require('../config/db');

/**
 * Get active high school grades (strictly 9, 10, 11, 12)
 */
const getGrades = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM grades ORDER BY level ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get high school streams (GENERAL, NATURAL, SOCIAL)
 */
const getStreams = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM streams ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subjects with optional filtering by grade level and stream
 */
const getSubjects = async (req, res, next) => {
  try {
    const { gradeLevel, streamId } = req.query;
    let sql = `
      SELECT s.*, st.name as stream_name, st.code as stream_code,
             COUNT(DISTINCT ta.teacher_id) as teacher_count,
             COUNT(DISTINCT ta.id) as assignment_count
      FROM subjects s
      LEFT JOIN streams st ON s.stream_id = st.id
      LEFT JOIN teacher_assignments ta ON s.id = ta.subject_id
      WHERE 1=1
    `;
    const params = [];

    if (gradeLevel) {
      params.push(parseInt(gradeLevel, 10));
      sql += ` AND s.grade_level = $${params.length}`;
    }
    if (streamId) {
      params.push(parseInt(streamId, 10));
      sql += ` AND s.stream_id = $${params.length}`;
    }

    sql += ' GROUP BY s.id, st.name, st.code ORDER BY s.grade_level ASC, s.name ASC';
    const result = await query(sql, params);

    const formatted = result.rows.map((row) => ({
      ...row,
      teacher_count: parseInt(row.teacher_count || 0, 10),
      assignment_count: parseInt(row.assignment_count || 0, 10),
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sections with live capacity calculations and enrolled counts
 */
const getSections = async (req, res, next) => {
  try {
    const { gradeLevel, streamId } = req.query;
    let sql = `
      SELECT sec.id, sec.grade_level, sec.stream_id, sec.section_name, sec.capacity, sec.academic_year_id, sec.is_active,
             st.name as stream_name, st.code as stream_code,
             COUNT(e.id) as enrolled_count,
             (sec.capacity - COUNT(e.id)) as remaining_seats,
             CASE WHEN COUNT(e.id) >= sec.capacity THEN TRUE ELSE FALSE END as is_full
      FROM sections sec
      JOIN streams st ON sec.stream_id = st.id
      LEFT JOIN enrollments e ON sec.id = e.section_id AND e.status = 'ENROLLED'
      WHERE sec.is_active = TRUE
    `;
    const params = [];

    if (gradeLevel) {
      params.push(parseInt(gradeLevel, 10));
      sql += ` AND sec.grade_level = $${params.length}`;
    }
    if (streamId) {
      params.push(parseInt(streamId, 10));
      sql += ` AND sec.stream_id = $${params.length}`;
    }

    sql += ` GROUP BY sec.id, st.name, st.code ORDER BY sec.grade_level ASC, sec.section_name ASC`;
    const result = await query(sql, params);

    const formatted = result.rows.map((row) => ({
      ...row,
      enrolled_count: parseInt(row.enrolled_count, 10),
      remaining_seats: parseInt(row.remaining_seats, 10),
      is_full: row.is_full === true || parseInt(row.remaining_seats, 10) <= 0,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active academic years
 */
const getAcademicYears = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM academic_years ORDER BY start_date DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Admin-configured Stream Criteria
 */
const getStreamCriteria = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT sc.*, st.name as stream_name, st.code as stream_code
      FROM stream_criteria sc
      JOIN streams st ON sc.stream_id = st.id
      ORDER BY sc.target_grade_level ASC, st.code ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGrades,
  getStreams,
  getSubjects,
  getSections,
  getAcademicYears,
  getStreamCriteria,
};
