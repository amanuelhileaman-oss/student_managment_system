const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const {
  verifyGrade8Prerequisite,
  checkStreamEligibility,
  checkGradeProgression,
  verifyGradeResultsForPromotion,
  verifyGrade9ResultsForPromotion,
} = require('../services/eligibilityEngine');
const { enrollStudent } = require('../services/enrollmentService');
const { logAudit } = require('../services/auditService');
const { processUploadedFile, getAttachmentUrl, streamFileToResponse, getMimeType } = require('../services/cloudinaryService');

/**
 * Helper to get the student record belonging to the authenticated user
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
  if (res.rows.length === 0) return null;
  const student = res.rows[0];

  // If current_section_id or current_grade_level is missing, resolve from enrollments table
  if (!student.current_section_id || !student.current_grade_level) {
    const enrollRes = await query(
      `SELECT e.section_id, e.grade_level, sec.section_name, sec.capacity as section_capacity
       FROM enrollments e
       LEFT JOIN sections sec ON e.section_id = sec.id
       WHERE e.student_id = $1 AND e.status = 'ENROLLED'
       ORDER BY e.enrolled_at DESC LIMIT 1`,
      [student.id]
    );
    if (enrollRes.rows.length > 0) {
      student.current_section_id = student.current_section_id || enrollRes.rows[0].section_id;
      student.current_grade_level = student.current_grade_level || enrollRes.rows[0].grade_level;
      student.section_name = student.section_name || enrollRes.rows[0].section_name;
      student.section_capacity = student.section_capacity || enrollRes.rows[0].section_capacity;

      // Persist back to students table to keep data synchronized
      await query(
        `UPDATE students
         SET current_section_id = COALESCE(current_section_id, $1),
             current_grade_level = COALESCE(current_grade_level, $2)
         WHERE id = $3`,
        [student.current_section_id, student.current_grade_level, student.id]
      ).catch(() => {});
    }
  }

  return student;
};

/**
 * Check authenticated student's Grade 8 prerequisite status
 */
const getPrerequisiteStatus = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const result = await verifyGrade8Prerequisite(student.student_id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Check academic progression eligibility (Grade 9 -> 10, Grade 10 -> 11, Grade 11 -> 12)
 */
const getProgressionEligibility = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const targetGrade = parseInt(
      req.query.targetGradeLevel || (student.current_grade_level ? student.current_grade_level + 1 : 9),
      10
    );
    const currentGrade = student.current_grade_level;

    // For Grade 9 entry: requires Grade 8 certificate
    if (targetGrade === 9) {
      const prereq = await verifyGrade8Prerequisite(student.student_id);
      return res.json({
        success: true,
        data: {
          currentGradeLevel: currentGrade,
          targetGradeLevel: targetGrade,
          isNewRegistration: !currentGrade,
          evaluation: prereq,
        },
      });
    }

    // For Grade 10 progression: checks Grade 9 stored results
    if (targetGrade === 10) {
      const g9Eval = await verifyGradeResultsForPromotion(student.id, 9);
      return res.json({
        success: true,
        data: {
          currentGradeLevel: currentGrade,
          targetGradeLevel: targetGrade,
          isNewRegistration: false,
          evaluation: g9Eval,
        },
      });
    }

    // For Grade 11 progression: checks Grade 10 stored results and evaluates streams
    if (targetGrade === 11) {
      const g10Eval = await verifyGradeResultsForPromotion(student.id, 10);
      return res.json({
        success: true,
        data: {
          currentGradeLevel: currentGrade,
          targetGradeLevel: targetGrade,
          isNewRegistration: false,
          currentStreamId: student.current_stream_id,
          currentStreamCode: student.stream_code,
          evaluation: g10Eval,
        },
      });
    }

    // For Grade 12 progression: checks Grade 11 stored results in their chosen stream
    if (targetGrade === 12) {
      const g11Eval = await verifyGradeResultsForPromotion(student.id, 11);
      return res.json({
        success: true,
        data: {
          currentGradeLevel: currentGrade,
          targetGradeLevel: targetGrade,
          isNewRegistration: false,
          currentStreamId: student.current_stream_id,
          currentStreamCode: student.stream_code,
          evaluation: g11Eval,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        currentGradeLevel: currentGrade,
        targetGradeLevel: targetGrade,
        isNewRegistration: false,
        evaluation: { eligible: true, message: 'Standard progression' },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check stream eligibility for target grade (11 or 12)
 */
const getStreamEligibility = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const { targetGradeLevel = 11, streamCode = 'NATURAL' } = req.query;
    const result = await checkStreamEligibility(student.id, parseInt(targetGradeLevel, 10), streamCode);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available sections for student's enrollment
 */
const getAvailableSections = async (req, res, next) => {
  try {
    const { gradeLevel = 9, streamId } = req.query;

    const gLevel = parseInt(gradeLevel, 10);
    let resolvedStreamId = streamId ? parseInt(streamId, 10) : null;
    if (gLevel <= 10) {
      resolvedStreamId = 1; // General Stream only for Grades 9 & 10
    }

    let sql = `
      SELECT sec.id, sec.grade_level, sec.stream_id, sec.section_name, sec.capacity, sec.academic_year_id,
             st.name as stream_name, st.code as stream_code,
             COUNT(e.id) as enrolled_count,
             (sec.capacity - COUNT(e.id)) as remaining_seats,
             CASE WHEN COUNT(e.id) >= sec.capacity THEN TRUE ELSE FALSE END as is_full
      FROM sections sec
      JOIN streams st ON sec.stream_id = st.id
      LEFT JOIN enrollments e ON sec.id = e.section_id AND e.status = 'ENROLLED'
      WHERE sec.is_active = TRUE AND sec.grade_level = $1
    `;
    const params = [gLevel];

    if (resolvedStreamId) {
      params.push(resolvedStreamId);
      sql += ` AND sec.stream_id = $${params.length}`;
    }

    sql += ` GROUP BY sec.id, st.name, st.code ORDER BY sec.section_name ASC`;
    const result = await query(sql, params);

    const formatted = result.rows.map((row) => ({
      ...row,
      enrolled_count: parseInt(row.enrolled_count, 10),
      remaining_seats: parseInt(row.remaining_seats, 10),
      is_full: parseInt(row.remaining_seats, 10) <= 0,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * Enroll student into a chosen section
 */
const enroll = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const { sectionId, targetGradeLevel, targetStreamId, academicYearId } = req.body;

    if (!sectionId || !targetGradeLevel || !targetStreamId) {
      return res.status(400).json({
        success: false,
        message: 'Section ID, target grade level, and stream ID are required.',
      });
    }

    // Resolve current academic year if not passed
    let yearId = academicYearId;
    if (!yearId) {
      const yRes = await query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
      yearId = yRes.rows.length > 0 ? yRes.rows[0].id : 1;
    }

    const enrollmentResult = await enrollStudent({
      studentDbId: student.id,
      sectionId: parseInt(sectionId, 10),
      targetGradeLevel: parseInt(targetGradeLevel, 10),
      targetStreamId: parseInt(targetStreamId, 10),
      academicYearId: yearId,
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: enrollmentResult.message,
      data: enrollmentResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get authenticated student's academic report card (Strictly isolated to current student)
 */
const getMyResults = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    // Fetch all grade records for this student
    const result = await query(
      `SELECT gr.id, gr.quiz_score, gr.midterm_score, gr.assignment_score, gr.final_score,
              gr.total_score, gr.letter_grade, gr.remarks, gr.updated_at,
              s.name as subject_name, s.code as subject_code, s.credit_hours,
              sec.section_name, sec.grade_level,
              ay.year_name,
              COALESCE(u_up.first_name || ' ' || u_up.last_name, 'Subject Instructor') as teacher_name
       FROM grade_records gr
       JOIN subjects s ON gr.subject_id = s.id
       JOIN sections sec ON gr.section_id = sec.id
       JOIN academic_years ay ON gr.academic_year_id = ay.id
       LEFT JOIN users u_up ON gr.updated_by = u_up.id
       WHERE gr.student_id = $1
       ORDER BY sec.grade_level DESC, s.name ASC`,
      [student.id]
    );

    // Fetch all enrollments for this student
    const enrollmentsRes = await query(
      `SELECT e.id as enrollment_id, e.grade_level, e.section_id, e.status as enrollment_status,
              sec.section_name, ay.year_name, st.name as stream_name
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.id
       JOIN academic_years ay ON e.academic_year_id = ay.id
       LEFT JOIN streams st ON e.stream_id = st.id
       WHERE e.student_id = $1
       ORDER BY e.grade_level ASC`,
      [student.id]
    );

    // Gather all distinct grade levels this student has been associated with
    const allGradesSet = new Set();
    if (student.current_grade_level) allGradesSet.add(student.current_grade_level);
    enrollmentsRes.rows.forEach((e) => allGradesSet.add(e.grade_level));
    result.rows.forEach((g) => allGradesSet.add(g.grade_level));
    const distinctGradeLevels = Array.from(allGradesSet).sort((a, b) => a - b);

    // Compute metrics per grade level
    const resultsByGrade = {};
    distinctGradeLevels.forEach((gl) => {
      const glEnrollment = enrollmentsRes.rows.find((e) => e.grade_level === gl);
      const glGrades = result.rows.filter((g) => g.grade_level === gl);
      const evaluated = glGrades.filter((r) => r.total_score !== null && r.total_score !== undefined);
      const subjectCount = evaluated.length;

      let totalScoreSum = 0;
      evaluated.forEach((r) => {
        totalScoreSum += parseFloat(r.total_score || 0);
      });

      const averageScore = subjectCount > 0 ? parseFloat((totalScoreSum / subjectCount).toFixed(2)) : null;
      const formulaComponents = evaluated.map(
        (r) => `${r.subject_name} (${parseFloat(r.total_score).toFixed(1)})`
      );
      const formula =
        subjectCount > 0
          ? `(${formulaComponents.join(' + ')}) / ${subjectCount} = ${averageScore}%`
          : 'Awaiting teacher submissions';

      const isCurrent = (gl === student.current_grade_level);
      const isQualified = averageScore !== null && averageScore >= 50.0 && subjectCount > 0;
      const promotionStatus =
        isQualified
          ? 'ELIGIBLE_FOR_PROMOTION'
          : subjectCount > 0
          ? 'BELOW_CRITERIA'
          : isCurrent
          ? 'EVALUATIONS_PENDING'
          : 'NO_EVALUATIONS';

      resultsByGrade[gl] = {
        gradeLevel: gl,
        sectionName: glEnrollment?.section_name || (isCurrent ? student.section_name : 'A'),
        streamName: glEnrollment?.stream_name || student.stream_name || 'General Stream',
        enrollmentStatus: glEnrollment?.enrollment_status || (isCurrent ? 'ENROLLED' : 'COMPLETED'),
        isCurrent,
        subjectCount,
        totalScoreSum: parseFloat(totalScoreSum.toFixed(2)),
        averageScore,
        formula,
        promotionStatus,
        isQualified,
        grades: glGrades,
      };
    });

    // Determine which grade to view:
    // 1. If explicit query parameter ?gradeLevel=X is provided, use X.
    // 2. Otherwise default to current grade level (or most recent grade level).
    let targetGrade = req.query.gradeLevel ? parseInt(req.query.gradeLevel, 10) : null;
    if (!targetGrade || !resultsByGrade[targetGrade]) {
      targetGrade = student.current_grade_level || distinctGradeLevels[distinctGradeLevels.length - 1] || 9;
    }

    const activeData = resultsByGrade[targetGrade] || {
      gradeLevel: targetGrade,
      sectionName: student.section_name || 'A',
      streamName: student.stream_name || 'General Stream',
      enrollmentStatus: 'ENROLLED',
      isCurrent: true,
      subjectCount: 0,
      totalScoreSum: 0,
      averageScore: null,
      formula: 'Awaiting teacher submissions',
      promotionStatus: 'EVALUATIONS_PENDING',
      isQualified: false,
      grades: [],
    };

    const currentGradeData = resultsByGrade[student.current_grade_level] || activeData;

    res.json({
      success: true,
      data: {
        student: {
          studentId: student.student_id,
          name: `${student.first_name} ${student.last_name}`,
          currentGrade: student.current_grade_level,
          currentSection: student.section_name,
          selectedGrade: activeData.gradeLevel,
          section: activeData.sectionName,
          stream: activeData.streamName,
          documentStatus: student.document_status,
          prerequisiteVerified: student.prerequisite_verified,
          averageScore: activeData.averageScore,
          totalScoreSum: activeData.totalScoreSum,
          subjectCount: activeData.subjectCount,
          calculationFormula: activeData.formula,
          promotionStatus: activeData.promotionStatus,
          isQualifiedForPromotion: activeData.isQualified,
        },
        currentGradeSummary: {
          gradeLevel: student.current_grade_level,
          sectionName: student.section_name,
          averageScore: currentGradeData.averageScore,
          totalScoreSum: currentGradeData.totalScoreSum,
          subjectCount: currentGradeData.subjectCount,
          calculationFormula: currentGradeData.formula,
          promotionStatus: currentGradeData.promotionStatus,
          isQualified: currentGradeData.isQualified,
        },
        calculation: {
          totalScoreSum: activeData.totalScoreSum,
          subjectCount: activeData.subjectCount,
          averageScore: activeData.averageScore,
          formula: activeData.formula,
          minRequired: 50.0,
          isQualified: activeData.isQualified,
        },
        grades: activeData.grades,
        availableGrades: distinctGradeLevels.map((gl) => ({
          gradeLevel: gl,
          sectionName: resultsByGrade[gl]?.sectionName || 'A',
          status: resultsByGrade[gl]?.enrollmentStatus || (gl === student.current_grade_level ? 'ENROLLED' : 'COMPLETED'),
          isCurrent: gl === student.current_grade_level,
          subjectCount: resultsByGrade[gl]?.subjectCount || 0,
          averageScore: resultsByGrade[gl]?.averageScore,
          isQualified: resultsByGrade[gl]?.isQualified || false,
          promotionStatus: resultsByGrade[gl]?.promotionStatus,
        })),
        resultsByGrade,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student's assignments (individual & group) with group code, teammates, and submission status
 */
const getMyAssignments = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student || !student.current_section_id) {
      return res.json({ success: true, data: [] });
    }

    const result = await query(
      `SELECT a.id, a.title, a.description, a.assignment_type, a.max_score, a.due_date, a.instructions, a.created_at,
              a.file_url, a.file_name, a.file_size, a.file_type,
              (NOW() > a.due_date) as is_past_due,
              s.name as subject_name, s.code as subject_code,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name,
              ag.id as group_id, ag.group_code, ag.group_name, ag.group_score,
              ag.submission_content, ag.submission_file_url, ag.submission_file_name, ag.submission_file_size, ag.submission_file_type,
              ag.submitted_at, ag.submitted_by,
              ag.status as group_status,
              sub_u.first_name as submitter_first_name, sub_u.last_name as submitter_last_name,
              COALESCE(
                (SELECT json_agg(
                   json_build_object(
                     'student_id', tm_s.id,
                     'student_code', tm_s.student_id,
                     'first_name', tm_u.first_name,
                     'last_name', tm_u.last_name
                   )
                 )
                 FROM assignment_group_members tm_agm
                 JOIN students tm_s ON tm_agm.student_id = tm_s.id
                 JOIN users tm_u ON tm_s.user_id = tm_u.id
                 WHERE tm_agm.group_id = ag.id),
                '[]'::json
              ) as teammates
       FROM assignments a
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN teachers t ON ta.teacher_id = t.id
       JOIN users u ON t.user_id = u.id
       LEFT JOIN assignment_groups ag ON ag.assignment_id = a.id AND ag.id IN (
         SELECT group_id FROM assignment_group_members WHERE student_id = $1
       )
       LEFT JOIN students sub_s ON ag.submitted_by = sub_s.id
       LEFT JOIN users sub_u ON sub_s.user_id = sub_u.id
       WHERE ta.section_id = $2
          OR ta.section_id IN (SELECT section_id FROM enrollments WHERE student_id = $1 AND status = 'ENROLLED')
       ORDER BY a.due_date ASC`,
      [student.id, student.current_section_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit work for a group assignment before the deadline (supports Word, PDF, Docs, and text)
 */
const submitGroupAssignment = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const { groupCode, assignmentId, submissionContent } = req.body;
    const file = req.file;

    const trimmedContent = (submissionContent || '').trim();
    if (!trimmedContent && !file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide submission comments or upload an assignment document (Word, PDF, Docs).',
      });
    }

    // 1. Locate the group either by groupCode or by assignmentId
    let group = null;

    if (groupCode && groupCode.trim()) {
      const gRes = await query(
        `SELECT ag.id, ag.group_code, ag.group_name, ag.status, ag.group_score,
                a.id as assignment_id, a.title, a.due_date, a.max_score, a.assignment_type
         FROM assignment_groups ag
         JOIN assignments a ON ag.assignment_id = a.id
         JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
         WHERE UPPER(TRIM(ag.group_code)) = UPPER(TRIM($1))
           AND (ta.section_id = $2 OR ta.section_id IN (SELECT section_id FROM enrollments WHERE student_id = $3 AND status = 'ENROLLED'))`,
        [groupCode.trim(), student.current_section_id, student.id]
      );
      if (gRes.rows.length > 0) {
        group = gRes.rows[0];
        // Ensure student is registered as group member
        await query(
          `INSERT INTO assignment_group_members (group_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (group_id, student_id) DO NOTHING`,
          [group.id, student.id]
        );
      }
    }

    if (!group && assignmentId) {
      const mRes = await query(
        `SELECT ag.id, ag.group_code, ag.group_name, ag.status, ag.group_score,
                a.id as assignment_id, a.title, a.due_date, a.max_score, a.assignment_type
         FROM assignment_groups ag
         JOIN assignments a ON ag.assignment_id = a.id
         JOIN assignment_group_members agm ON ag.id = agm.group_id
         WHERE a.id = $1 AND agm.student_id = $2`,
        [parseInt(assignmentId, 10), student.id]
      );
      if (mRes.rows.length > 0) {
        group = mRes.rows[0];
      } else {
        // If no submission/group record exists yet, verify the assignment belongs to student's section or enrollment
        const aRes = await query(
          `SELECT a.id, a.title, a.due_date, a.max_score, a.assignment_type, ta.section_id
           FROM assignments a
           JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
           WHERE a.id = $1 AND (
             ta.section_id = $2
             OR ta.section_id IN (SELECT section_id FROM enrollments WHERE student_id = $3 AND status = 'ENROLLED')
           )`,
          [parseInt(assignmentId, 10), student.current_section_id, student.id]
        );

        if (aRes.rows.length > 0) {
          const assign = aRes.rows[0];
          const studentCode = student.student_id || `S${student.id}`;
          const cleanInputCode = (groupCode || '').trim().toUpperCase();
          const generatedCode = cleanInputCode || (assign.assignment_type === 'GROUP' ? `GRP-${assign.id}-${studentCode}` : `IND-${assign.id}-${studentCode}`);
          const studentFullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student ${studentCode}`;
          const groupName = assign.assignment_type === 'GROUP'
            ? (cleanInputCode ? `Team ${cleanInputCode}` : `${studentFullName}'s Team`)
            : `${studentFullName} (Individual)`;

          // Create group submission record
          const insRes = await query(
            `INSERT INTO assignment_groups (assignment_id, group_code, group_name, status)
             VALUES ($1, $2, $3, 'PENDING')
             ON CONFLICT (group_code) DO UPDATE SET group_name = EXCLUDED.group_name
             RETURNING id, group_code, group_name, status, assignment_id`,
            [assign.id, generatedCode, groupName]
          );

          const newGroup = insRes.rows[0];
          await query(
            `INSERT INTO assignment_group_members (group_id, student_id)
             VALUES ($1, $2)
             ON CONFLICT (group_id, student_id) DO NOTHING`,
            [newGroup.id, student.id]
          );

          group = {
            ...newGroup,
            title: assign.title,
            due_date: assign.due_date,
            max_score: assign.max_score,
            assignment_type: assign.assignment_type,
          };
        }
      }
    }

    if (!group) {
      return res.status(403).json({
        success: false,
        message: 'This assignment was not found for your class section, or the Group Code is invalid.',
      });
    }

    // 2. Prevent re-submission if already graded
    if (group.status === 'GRADED') {
      return res.status(400).json({
        success: false,
        message: `This coursework has already been evaluated and graded (${group.group_score ?? ''} pts). Modifications are closed.`,
      });
    }

    // 3. Check submission deadline
    const now = new Date();
    const dueDate = new Date(group.due_date);
    if (now > dueDate) {
      return res.status(400).json({
        success: false,
        message: `Submission closed. The deadline for "${group.title}" was ${dueDate.toLocaleString()}. Work cannot be submitted after the due date.`,
      });
    }

    // 4. Save submission (Word / PDF / text / PPT)
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let fileType = null;

    if (file) {
      const processed = await processUploadedFile(file, {
        folder: 'ethio_highhub/submissions',
        localDir: 'assignments',
      });
      fileUrl = processed.fileUrl;
      fileName = processed.fileName;
      fileSize = processed.fileSize;
      fileType = processed.fileType;
    }

    const updateRes = await query(
      `UPDATE assignment_groups
       SET submission_content = CASE WHEN $1 != '' THEN $1 ELSE submission_content END,
           submission_file_url = COALESCE($2, submission_file_url),
           submission_file_name = COALESCE($3, submission_file_name),
           submission_file_size = COALESCE($4, submission_file_size),
           submission_file_type = COALESCE($5, submission_file_type),
           submitted_at = NOW(),
           submitted_by = $6,
           status = 'SUBMITTED'
       WHERE id = $7
       RETURNING id, group_code, group_name, submission_content, submission_file_url, submission_file_name, submission_file_size, submission_file_type, submitted_at, status`,
      [trimmedContent, fileUrl, fileName, fileSize, fileType, student.id, group.id]
    );

    // 5. Audit log
    await logAudit({
      userId: req.user.id,
      action: 'GROUP_ASSIGNMENT_SUBMITTED',
      entityType: 'ASSIGNMENT_GROUP',
      entityId: group.id,
      details: {
        groupCode: group.group_code,
        assignmentId: group.assignment_id,
        submittedByStudentId: student.id,
        fileName,
      },
    });

    res.json({
      success: true,
      message: `Assignment successfully turned in for ${group.group_name} (${group.group_code})!`,
      data: updateRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student's weekly timetable
 */
const getMySchedule = async (req, res, next) => {
  try {
    const student = await getStudentByUserId(req.user.id);
    if (!student || !student.current_section_id) {
      return res.json({ success: true, data: [] });
    }

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
              s.name as subject_name, s.code as subject_code,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name,
              sec.section_name, sec.grade_level,
              st.name as stream_name
       FROM schedules sch
       JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
       JOIN subjects s ON ta.subject_id = s.id
       JOIN teachers t ON ta.teacher_id = t.id
       JOIN users u ON t.user_id = u.id
       JOIN sections sec ON ta.section_id = sec.id
       LEFT JOIN ordered_sections os ON os.id = sec.id
       LEFT JOIN streams st ON sec.stream_id = st.id
       WHERE ta.section_id = $1
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
      [student.current_section_id]
    );

    res.json({
      success: true,
      sectionId: student.current_section_id,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download assignment question document for student
 */
const downloadAssignmentFile = async (req, res, next) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const aRes = await query('SELECT * FROM assignments WHERE id = $1', [assignmentId]);
    if (aRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const assignment = aRes.rows[0];
    if (!assignment.file_url) {
      return res.status(404).json({ success: false, message: 'No file attached to this assignment.' });
    }

    await streamFileToResponse({
      fileUrl: assignment.file_url,
      fileName: assignment.file_name || 'assignment-document',
      mimeType: assignment.file_type || getMimeType(assignment.file_name),
      isInline: false,
      res,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * View assignment question document inline
 */
const viewAssignmentFile = async (req, res, next) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const aRes = await query('SELECT * FROM assignments WHERE id = $1', [assignmentId]);
    if (aRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const assignment = aRes.rows[0];
    if (!assignment.file_url) {
      return res.status(404).json({ success: false, message: 'No file attached to this assignment.' });
    }

    const ext = path.extname(assignment.file_name || '').toLowerCase();
    const isOffice = ['.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.zip', '.rar'].includes(ext);

    await streamFileToResponse({
      fileUrl: assignment.file_url,
      fileName: assignment.file_name || 'assignment-document',
      mimeType: assignment.file_type || getMimeType(assignment.file_name),
      isInline: !isOffice,
      res,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download student's submitted document
 */
const downloadSubmissionFile = async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const gRes = await query('SELECT * FROM assignment_groups WHERE id = $1', [groupId]);
    if (gRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment group submission not found.' });
    }

    const group = gRes.rows[0];
    if (!group.submission_file_url) {
      return res.status(404).json({ success: false, message: 'No document attached to this submission.' });
    }

    await streamFileToResponse({
      fileUrl: group.submission_file_url,
      fileName: group.submission_file_name || 'submission-document',
      mimeType: group.submission_file_type || getMimeType(group.submission_file_name),
      isInline: false,
      res,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * View student's submitted document inline
 */
const viewSubmissionFile = async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const gRes = await query('SELECT * FROM assignment_groups WHERE id = $1', [groupId]);
    if (gRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment group submission not found.' });
    }

    const group = gRes.rows[0];
    if (!group.submission_file_url) {
      return res.status(404).json({ success: false, message: 'No document attached to this submission.' });
    }

    const ext = path.extname(group.submission_file_name || '').toLowerCase();
    const isOffice = ['.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.zip', '.rar'].includes(ext);

    await streamFileToResponse({
      fileUrl: group.submission_file_url,
      fileName: group.submission_file_name || 'submission-document',
      mimeType: group.submission_file_type || getMimeType(group.submission_file_name),
      isInline: !isOffice,
      res,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrerequisiteStatus,
  getProgressionEligibility,
  getStreamEligibility,
  getAvailableSections,
  enroll,
  getMyResults,
  getMyAssignments,
  submitGroupAssignment,
  getMySchedule,
  downloadAssignmentFile,
  viewAssignmentFile,
  downloadSubmissionFile,
  viewSubmissionFile,
};

