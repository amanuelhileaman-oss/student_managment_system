const { query } = require('../config/db');

/**
 * Section Capacity Report
 */
const getCapacityReport = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT sec.id, sec.grade_level, sec.section_name, sec.capacity,
             st.name as stream_name, st.code as stream_code,
             ay.year_name,
             COUNT(e.id) as enrolled_count,
             (sec.capacity - COUNT(e.id)) as remaining_seats,
             ROUND((COUNT(e.id)::NUMERIC / sec.capacity::NUMERIC) * 100, 1) as utilization_pct,
             CASE WHEN COUNT(e.id) >= sec.capacity THEN 'FULL' ELSE 'AVAILABLE' END as status
      FROM sections sec
      JOIN streams st ON sec.stream_id = st.id
      JOIN academic_years ay ON sec.academic_year_id = ay.id
      LEFT JOIN enrollments e ON sec.id = e.section_id AND e.status = 'ENROLLED'
      WHERE sec.is_active = TRUE
      GROUP BY sec.id, st.name, st.code, ay.year_name
      ORDER BY sec.grade_level ASC, sec.section_name ASC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Student Academic & Promotion Report
 */
const getPromotionReport = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT s.id, s.student_id, s.current_grade_level,
             u.first_name, u.last_name, u.email,
             sec.section_name, st.name as stream_name,
             COUNT(gr.id) as total_subjects,
             ROUND(AVG(gr.total_score), 2) as average_score,
             CASE
               WHEN AVG(gr.total_score) >= 50.0 THEN 'PROMOTED'
               ELSE 'RETAINED'
             END as academic_promotion_status
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sections sec ON s.current_section_id = sec.id
      LEFT JOIN streams st ON s.current_stream_id = st.id
      LEFT JOIN grade_records gr ON s.id = gr.student_id AND gr.section_id = s.current_section_id
      GROUP BY s.id, s.student_id, s.current_grade_level, u.first_name, u.last_name, u.email, sec.section_name, st.name
      ORDER BY s.current_grade_level ASC, u.last_name ASC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Downloadable CSV Export for Section Capacities
 */
const exportCapacityCSV = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT sec.grade_level, sec.section_name, st.name as stream_name,
             sec.capacity, COUNT(e.id) as enrolled_count,
             (sec.capacity - COUNT(e.id)) as remaining_seats,
             ROUND((COUNT(e.id)::NUMERIC / sec.capacity::NUMERIC) * 100, 1) as utilization_pct
      FROM sections sec
      JOIN streams st ON sec.stream_id = st.id
      LEFT JOIN enrollments e ON sec.id = e.section_id AND e.status = 'ENROLLED'
      WHERE sec.is_active = TRUE
      GROUP BY sec.id, st.name
      ORDER BY sec.grade_level ASC, sec.section_name ASC
    `);

    let csv = 'Grade,Section,Stream,Capacity,Enrolled,Remaining Seats,Utilization (%)\n';
    result.rows.forEach((r) => {
      csv += `Grade ${r.grade_level},Section ${r.section_name},"${r.stream_name}",${r.capacity},${r.enrolled_count},${r.remaining_seats},${r.utilization_pct}%\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="section-capacity-report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Downloadable CSV Export for Student Promotion Status
 */
const exportPromotionCSV = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT s.student_id, u.first_name, u.last_name, s.current_grade_level,
             sec.section_name, st.name as stream_name,
             ROUND(AVG(gr.total_score), 2) as average_score,
             CASE WHEN AVG(gr.total_score) >= 50.0 THEN 'PROMOTED' ELSE 'RETAINED' END as promotion_status
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sections sec ON s.current_section_id = sec.id
      LEFT JOIN streams st ON s.current_stream_id = st.id
      LEFT JOIN grade_records gr ON s.id = gr.student_id AND gr.section_id = s.current_section_id
      GROUP BY s.id, s.student_id, u.first_name, u.last_name, s.current_grade_level, sec.section_name, st.name
      ORDER BY s.current_grade_level ASC, s.student_id ASC
    `);

    let csv = 'Student ID,First Name,Last Name,Grade,Section,Stream,Average Score (%),Promotion Status\n';
    result.rows.forEach((r) => {
      csv += `"${r.student_id}","${r.first_name}","${r.last_name}",Grade ${r.current_grade_level || 'N/A'},"${r.section_name || 'N/A'}","${r.stream_name || 'N/A'}",${r.average_score || 0},${r.promotion_status}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student-promotion-report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCapacityReport,
  getPromotionReport,
  exportCapacityCSV,
  exportPromotionCSV,
};
