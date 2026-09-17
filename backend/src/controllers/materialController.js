const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { logAudit } = require('../services/auditService');

/**
 * Helper to get teacher record by user ID
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
 * Helper to get student record by user ID
 */
const getStudentByUserId = async (userId) => {
  const res = await query(
    `SELECT s.*, u.first_name, u.last_name, u.email,
            sec.section_name, sec.capacity as section_capacity,
            st.name as stream_name, st.code as stream_code
     FROM students s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN sections sec ON s.current_section_id = sec.id
     LEFT JOIN streams st ON s.current_stream_id = st.id
     WHERE s.user_id = $1`,
    [userId]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
};

// ==========================================
// TEACHER CONTROLLERS
// ==========================================

/**
 * Get upload options for teacher: assigned classes, subjects, and sections
 */
const getTeacherUploadOptions = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    // 1. Teacher assigned subjects & sections
    const assignedRes = await query(
      `SELECT ta.id as assignment_id, ta.subject_id, ta.section_id,
              s.name as subject_name, s.code as subject_code, s.grade_level,
              sec.section_name
       FROM teacher_assignments ta
       JOIN subjects s ON ta.subject_id = s.id
       JOIN sections sec ON ta.section_id = sec.id
       WHERE ta.teacher_id = $1 OR ta.teacher_id = $2
       ORDER BY s.grade_level ASC, sec.section_name ASC`,
      [teacher.id, req.user.id]
    );

    // 2. All subjects (in case teacher wants to upload general reference books or curriculum textbooks)
    const allSubjectsRes = await query(
      `SELECT id, name, code, grade_level FROM subjects ORDER BY grade_level ASC, name ASC`
    );

    // 3. All sections
    const allSectionsRes = await query(
      `SELECT id, section_name, grade_level FROM sections WHERE is_active = TRUE ORDER BY grade_level ASC, section_name ASC`
    );

    res.json({
      success: true,
      data: {
        assignedClasses: assignedRes.rows,
        allSubjects: allSubjectsRes.rows,
        allSections: allSectionsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get materials uploaded by the logged-in teacher
 */
const getTeacherMaterials = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const result = await query(
      `SELECT sm.*,
              s.name as subject_name, s.code as subject_code, s.grade_level as subject_grade_level,
              sec.section_name,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name
       FROM study_materials sm
       JOIN subjects s ON sm.subject_id = s.id
       JOIN teachers t ON sm.teacher_id = t.id
       JOIN users u ON t.user_id = u.id
       LEFT JOIN sections sec ON sm.section_id = sec.id
       WHERE sm.teacher_id = $1
       ORDER BY sm.created_at DESC`,
      [teacher.id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a new learning material / textbook / book / notes
 */
const uploadMaterial = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach a document, PDF, book, or worksheet file.' });
    }

    const {
      title,
      subjectId,
      gradeLevel,
      sectionId,
      author,
      edition,
      materialType = 'TEXTBOOK',
      description,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Material or book title is required.' });
    }

    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'Subject selection is required.' });
    }

    // Verify subject exists
    const subjectRes = await query('SELECT id, name, grade_level FROM subjects WHERE id = $1', [subjectId]);
    if (subjectRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected subject does not exist.' });
    }
    const subject = subjectRes.rows[0];

    // Determine target grade level: null means "General School Library (All Grades)"
    let parsedGrade = null;
    if (gradeLevel !== undefined && gradeLevel !== '' && gradeLevel !== 'null' && gradeLevel !== 'ALL') {
      parsedGrade = parseInt(gradeLevel, 10);
      if (isNaN(parsedGrade) || ![9, 10, 11, 12].includes(parsedGrade)) {
        parsedGrade = subject.grade_level;
      }
    } else if (gradeLevel === undefined || gradeLevel === '') {
      parsedGrade = subject.grade_level;
    }

    // Determine target section: null means "All Sections"
    let parsedSection = null;
    if (sectionId && sectionId !== '' && sectionId !== 'null' && sectionId !== 'ALL') {
      parsedSection = parseInt(sectionId, 10);
    }

    const fileUrl = `/uploads/materials/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype;

    const insertRes = await query(
      `INSERT INTO study_materials
        (teacher_id, subject_id, grade_level, section_id, title, author, edition, description, material_type, file_url, file_name, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        teacher.id,
        subject.id,
        parsedGrade,
        parsedSection,
        title.trim(),
        author ? author.trim() : null,
        edition ? edition.trim() : null,
        description ? description.trim() : null,
        materialType,
        fileUrl,
        fileName,
        fileSize,
        fileType,
      ]
    );

    const created = insertRes.rows[0];

    // Audit log
    await logAudit({
      userId: req.user.id,
      action: 'STUDY_MATERIAL_UPLOADED',
      entityType: 'STUDY_MATERIAL',
      entityId: created.id,
      details: {
        title: created.title,
        materialType: created.material_type,
        subjectId: created.subject_id,
        gradeLevel: created.grade_level,
        sectionId: created.section_id,
        fileName,
        fileSize,
      },
    });

    res.status(201).json({
      success: true,
      message: `"${created.title}" successfully uploaded and published to students!`,
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update material details (title, description, author, edition, category, section)
 */
const updateMaterial = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const materialId = parseInt(req.params.id, 10);
    const checkRes = await query('SELECT * FROM study_materials WHERE id = $1 AND teacher_id = $2', [materialId, teacher.id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found or unauthorized to edit.' });
    }

    const {
      title,
      author,
      edition,
      description,
      materialType,
      sectionId,
      gradeLevel,
    } = req.body;

    let parsedSection = null;
    if (sectionId && sectionId !== '' && sectionId !== 'null' && sectionId !== 'ALL') {
      parsedSection = parseInt(sectionId, 10);
    }

    let parsedGrade = checkRes.rows[0].grade_level;
    if (gradeLevel !== undefined) {
      if (gradeLevel === '' || gradeLevel === 'null' || gradeLevel === 'ALL') {
        parsedGrade = null;
      } else {
        const g = parseInt(gradeLevel, 10);
        if ([9, 10, 11, 12].includes(g)) parsedGrade = g;
      }
    }

    const updateRes = await query(
      `UPDATE study_materials
       SET title = COALESCE($1, title),
           author = COALESCE($2, author),
           edition = COALESCE($3, edition),
           description = COALESCE($4, description),
           material_type = COALESCE($5, material_type),
           section_id = $6,
           grade_level = $7,
           updated_at = NOW()
       WHERE id = $8 AND teacher_id = $9
       RETURNING *`,
      [
        title ? title.trim() : null,
        author !== undefined ? (author ? author.trim() : null) : null,
        edition !== undefined ? (edition ? edition.trim() : null) : null,
        description !== undefined ? (description ? description.trim() : null) : null,
        materialType || null,
        parsedSection,
        parsedGrade,
        materialId,
        teacher.id,
      ]
    );

    res.json({
      success: true,
      message: 'Material details successfully updated.',
      data: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete material (removes database record and deletes physical file)
 */
const deleteMaterial = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUserId(req.user.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found.' });

    const materialId = parseInt(req.params.id, 10);
    const checkRes = await query('SELECT * FROM study_materials WHERE id = $1 AND teacher_id = $2', [materialId, teacher.id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found or unauthorized to delete.' });
    }

    const material = checkRes.rows[0];

    // Delete record from database
    await query('DELETE FROM study_materials WHERE id = $1', [materialId]);

    // Attempt to remove physical file from disk
    if (material.file_url) {
      const fileName = path.basename(material.file_url);
      const filePath = path.join(__dirname, '../../uploads/materials', fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.warn('Could not delete physical file:', filePath, fileErr.message);
        }
      }
    }

    // Audit log
    await logAudit({
      userId: req.user.id,
      action: 'STUDY_MATERIAL_DELETED',
      entityType: 'STUDY_MATERIAL',
      entityId: materialId,
      details: { title: material.title, fileName: material.file_name },
    });

    res.json({
      success: true,
      message: `"${material.title}" has been permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// STUDENT CONTROLLERS
// ==========================================

/**
 * Get materials available to the logged-in student
 */
const getStudentMaterials = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    // Enrolled grade and section
    let gradeLevel = student.current_grade_level;
    let sectionId = student.current_section_id;

    // Fallback: check latest enrollment record
    if (!gradeLevel || !sectionId) {
      const enrollRes = await query(
        `SELECT grade_level, section_id FROM enrollments WHERE student_id = $1 AND status = 'ENROLLED' ORDER BY enrolled_at DESC LIMIT 1`,
        [student.id]
      );
      if (enrollRes.rows.length > 0) {
        if (!gradeLevel) gradeLevel = enrollRes.rows[0].grade_level;
        if (!sectionId) sectionId = enrollRes.rows[0].section_id;
      }
    }

    // Query filters from req.query
    const { subjectId, materialType, search } = req.query;

    let queryText = `
      SELECT sm.*,
             s.name as subject_name, s.code as subject_code, s.grade_level as subject_grade_level,
             sec.section_name,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name,
             t.teacher_id as teacher_code
      FROM study_materials sm
      JOIN subjects s ON sm.subject_id = s.id
      JOIN teachers t ON sm.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN sections sec ON sm.section_id = sec.id
      WHERE (
        -- General School Library books (available across all grades)
        sm.grade_level IS NULL
        -- OR materials specific to this student's grade
        OR sm.grade_level = $1
      )
      AND (
        -- Available to all sections in that grade
        sm.section_id IS NULL
        -- OR specifically assigned to this student's section
        OR sm.section_id = $2
      )
    `;

    const params = [gradeLevel || 9, sectionId || -1];
    let paramIndex = 3;

    if (subjectId && subjectId !== 'ALL') {
      queryText += ` AND sm.subject_id = $${paramIndex++}`;
      params.push(parseInt(subjectId, 10));
    }

    if (materialType && materialType !== 'ALL') {
      queryText += ` AND sm.material_type = $${paramIndex++}`;
      params.push(materialType);
    }

    if (search && search.trim()) {
      queryText += ` AND (
        sm.title ILIKE $${paramIndex} OR 
        COALESCE(sm.author, '') ILIKE $${paramIndex} OR 
        COALESCE(sm.description, '') ILIKE $${paramIndex} OR 
        s.name ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    queryText += ` ORDER BY sm.created_at DESC`;

    const result = await query(queryText, params);

    // Also get subjects list for student filter tabs
    const subjectsRes = await query(
      `SELECT DISTINCT s.id, s.name, s.code, s.grade_level
       FROM subjects s
       WHERE s.grade_level = $1 OR s.grade_level IS NULL
       ORDER BY s.name ASC`,
      [gradeLevel || 9]
    );

    // Summary counts for student quick stats
    const stats = {
      totalAvailable: result.rows.length,
      textbooks: result.rows.filter((r) => r.material_type === 'TEXTBOOK').length,
      referenceBooks: result.rows.filter((r) => r.material_type === 'REFERENCE_BOOK').length,
      lectureNotes: result.rows.filter((r) => r.material_type === 'LECTURE_NOTES').length,
      worksheets: result.rows.filter((r) => r.material_type === 'WORKSHEET').length,
      examPrep: result.rows.filter((r) => r.material_type === 'EXAM_PREP').length,
    };

    res.json({
      success: true,
      data: {
        materials: result.rows,
        subjects: subjectsRes.rows,
        stats,
        studentInfo: {
          gradeLevel,
          sectionId,
          sectionName: student.section_name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Track student download / increment counter
 */
const trackDownload = async (req, res, next) => {
  try {
    const materialId = parseInt(req.params.id, 10);
    const updateRes = await query(
      `UPDATE study_materials
       SET download_count = download_count + 1
       WHERE id = $1
       RETURNING id, download_count, file_url, file_name`,
      [materialId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    res.json({
      success: true,
      data: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Direct file download handler (forces browser download with original readable filename)
 */
const downloadMaterialFile = async (req, res, next) => {
  try {
    const materialId = parseInt(req.params.id, 10);
    const matRes = await query('SELECT * FROM study_materials WHERE id = $1', [materialId]);
    if (matRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const material = matRes.rows[0];

    // Increment download counter
    await query('UPDATE study_materials SET download_count = download_count + 1 WHERE id = $1', [materialId]);

    const diskFileName = path.basename(material.file_url);
    const filePath = path.join(__dirname, '../../uploads/materials', diskFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'The requested file was not found on the server.' });
    }

    // Send file with clean original name
    res.download(filePath, material.file_name);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeacherUploadOptions,
  getTeacherMaterials,
  uploadMaterial,
  updateMaterial,
  deleteMaterial,
  getStudentMaterials,
  trackDownload,
  downloadMaterialFile,
};
