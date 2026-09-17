const { query } = require('../config/db');

/**
 * Universal Global Search across all high school entities
 * Searches students, teachers, sections, grades, subjects, study materials
 */
const globalSearch = async (req, res, next) => {
  try {
    const rawQ = req.query.q || '';
    const q = rawQ.trim();

    if (!q) {
      // Return top quick sections and summary
      const topSecs = await query(
        `SELECT s.id, s.grade_level, s.section_name, s.capacity, st.name as stream_name,
                (SELECT COUNT(*) FROM students WHERE current_section_id = s.id) as student_count
         FROM sections s
         JOIN streams st ON s.stream_id = st.id
         WHERE s.is_active = TRUE
         ORDER BY s.grade_level, s.section_name
         LIMIT 6`
      );
      return res.json({
        success: true,
        data: {
          query: '',
          students: [],
          teachers: [],
          sections: topSecs.rows,
          materials: [],
          totalMatches: 0,
        },
      });
    }

    const searchParam = `%${q}%`;
    const gradeNum = parseInt(q.replace(/[^0-9]/g, ''), 10);

    // 1. Search Students by ID, Name, Email, Grade, Section, Stream
    const studentSql = `
      SELECT s.id as student_record_id, s.student_id, s.current_grade_level, s.document_status, s.promotion_status,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url, u.phone,
             sec.id as section_id, sec.section_name,
             st.name as stream_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sections sec ON s.current_section_id = sec.id
      LEFT JOIN streams st ON s.current_stream_id = st.id
      WHERE (
        s.student_id ILIKE $1 OR
        u.first_name ILIKE $1 OR
        u.last_name ILIKE $1 OR
        (u.first_name || ' ' || u.last_name) ILIKE $1 OR
        u.email ILIKE $1 OR
        sec.section_name ILIKE $1 OR
        ('Section ' || COALESCE(sec.section_name, '')) ILIKE $1 OR
        ('Sec ' || COALESCE(sec.section_name, '')) ILIKE $1 OR
        ('Grade ' || CAST(s.current_grade_level AS TEXT)) ILIKE $1 OR
        ('Grade ' || CAST(s.current_grade_level AS TEXT) || ' ' || COALESCE(sec.section_name, '')) ILIKE $1 OR
        (CAST(s.current_grade_level AS TEXT) || '-' || COALESCE(sec.section_name, '')) ILIKE $1 OR
        (CAST(s.current_grade_level AS TEXT) || COALESCE(sec.section_name, '')) ILIKE $1 OR
        st.name ILIKE $1
        ${!isNaN(gradeNum) && [9, 10, 11, 12].includes(gradeNum) ? `OR s.current_grade_level = ${gradeNum}` : ''}
      )
      ORDER BY s.current_grade_level ASC, u.first_name ASC
      LIMIT 12
    `;
    const studentRes = await query(studentSql, [searchParam]);

    // 2. Search Teachers by ID, Name, Email, Department/Specialization, Qualification
    const teacherSql = `
      SELECT t.id as teacher_record_id, t.teacher_id, t.qualification, t.specialization,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url, u.phone
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE (
        t.teacher_id ILIKE $1 OR
        u.first_name ILIKE $1 OR
        u.last_name ILIKE $1 OR
        (u.first_name || ' ' || u.last_name) ILIKE $1 OR
        u.email ILIKE $1 OR
        t.specialization ILIKE $1 OR
        t.qualification ILIKE $1
      )
      ORDER BY u.first_name ASC
      LIMIT 10
    `;
    const teacherRes = await query(teacherSql, [searchParam]);

    // 3. Search Sections & Grades (e.g. "Grade 10", "Section C", "Natural", "10-A")
    const sectionSql = `
      SELECT sec.id, sec.grade_level, sec.section_name, sec.capacity,
             st.name as stream_name, st.code as stream_code,
             (SELECT COUNT(*) FROM students WHERE current_section_id = sec.id) as student_count
      FROM sections sec
      JOIN streams st ON sec.stream_id = st.id
      WHERE (
        sec.section_name ILIKE $1 OR
        ('Section ' || sec.section_name) ILIKE $1 OR
        ('Sec ' || sec.section_name) ILIKE $1 OR
        st.name ILIKE $1 OR
        ('Grade ' || CAST(sec.grade_level AS TEXT)) ILIKE $1 OR
        ('Grade ' || CAST(sec.grade_level AS TEXT) || ' ' || sec.section_name) ILIKE $1 OR
        ('Grade ' || CAST(sec.grade_level AS TEXT) || ' - ' || sec.section_name) ILIKE $1 OR
        ('Grade ' || CAST(sec.grade_level AS TEXT) || '-' || sec.section_name) ILIKE $1 OR
        (CAST(sec.grade_level AS TEXT) || '-' || sec.section_name) ILIKE $1 OR
        (CAST(sec.grade_level AS TEXT) || sec.section_name) ILIKE $1
        ${!isNaN(gradeNum) && [9, 10, 11, 12].includes(gradeNum) ? `OR sec.grade_level = ${gradeNum}` : ''}
      )
      ORDER BY sec.grade_level, sec.section_name
      LIMIT 8
    `;
    const sectionRes = await query(sectionSql, [searchParam]);

    // 4. Search Subjects & Study Materials
    const materialSql = `
      SELECT m.id, m.title, m.author, m.edition, m.material_type, m.grade_level, m.file_name,
             sub.name as subject_name
      FROM study_materials m
      LEFT JOIN subjects sub ON m.subject_id = sub.id
      WHERE (
        m.title ILIKE $1 OR
        m.author ILIKE $1 OR
        sub.name ILIKE $1 OR
        m.material_type ILIKE $1
      )
      LIMIT 8
    `;
    const materialRes = await query(materialSql, [searchParam]);

    res.json({
      success: true,
      data: {
        query: q,
        students: studentRes.rows,
        teachers: teacherRes.rows,
        sections: sectionRes.rows,
        materials: materialRes.rows,
        totalMatches:
          studentRes.rows.length +
          teacherRes.rows.length +
          sectionRes.rows.length +
          materialRes.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  globalSearch,
};
