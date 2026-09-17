const { withTransaction, query } = require('../config/db');
const { logAudit } = require('./auditService');
const {
  checkGradeProgression,
  checkStreamEligibility,
  verifyGrade8Prerequisite,
  verifyGradeResultsForPromotion,
  verifyGrade9ResultsForPromotion,
} = require('./eligibilityEngine');
const { sendNotification } = require('./notificationService');

/**
 * Concurrency-safe section enrollment using PostgreSQL row-level locks
 */
const enrollStudent = async ({ studentDbId, sectionId, targetGradeLevel, targetStreamId, academicYearId, userId = null }) => {
  return await withTransaction(async (client) => {
    // 1. Fetch student info
    const stuRes = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [studentDbId]);
    if (stuRes.rows.length === 0) {
      throw { statusCode: 404, message: 'Student record not found.' };
    }
    const student = stuRes.rows[0];

    // 2. Grade-Specific Prerequisite and Results Verification
    // 2. Verify linear progression
    const progCheck = checkGradeProgression(student.current_grade_level, targetGradeLevel);
    if (!progCheck.allowed) {
      throw { statusCode: 400, message: progCheck.message };
    }

    if (targetGradeLevel === 9) {
      // Entry to Grade 9 requires Grade 8 certificate verification
      if (student.document_status === 'PENDING_ADMIN_VERIFICATION') {
        throw {
          statusCode: 400,
          message: 'Your official Grade 8 document is currently awaiting Administrator review. Enrollment into sections is locked until administration reviews and approves your submitted credentials.',
        };
      }
      if (student.document_status === 'REJECTED') {
        throw {
          statusCode: 400,
          message: `Your Grade 8 document was rejected by administration: ${student.admin_review_notes || 'Documentation does not meet admission criteria'}. Please re-submit valid documentation before enrolling.`,
        };
      }
      if (student.document_status !== 'APPROVED') {
        throw {
          statusCode: 400,
          message: 'Your Grade 8 document has not yet been approved by the school administrator. Please wait for administrative verification.',
        };
      }

      const prereqCheck = await verifyGrade8Prerequisite(student.student_id);
      if (!prereqCheck.eligible) {
        throw { statusCode: 400, message: prereqCheck.message };
      }
    } else if (targetGradeLevel === 10) {
      // Progression to Grade 10: Re-registration is NOT mandatory, but student must have passed Grade 9
      const g9Check = await verifyGradeResultsForPromotion(studentDbId, 9);
      if (!g9Check.eligible) {
        throw {
          statusCode: 400,
          message: g9Check.message,
          data: g9Check,
        };
      }
    } else if (targetGradeLevel === 11) {
      // Progression to Grade 11: Student must have completed and passed Grade 10
      const g10Check = await verifyGradeResultsForPromotion(studentDbId, 10);
      if (!g10Check.eligible) {
        throw {
          statusCode: 400,
          message: g10Check.message,
          data: g10Check,
        };
      }
    } else if (targetGradeLevel === 12) {
      // Progression to Grade 12: Student must have completed and passed Grade 11
      const g11Check = await verifyGradeResultsForPromotion(studentDbId, 11);
      if (!g11Check.eligible) {
        throw {
          statusCode: 400,
          message: g11Check.message,
          data: g11Check,
        };
      }
    }

    // 4. Verify Stream Eligibility
    const streamRes = await client.query('SELECT id, code, name FROM streams WHERE id = $1', [targetStreamId]);
    if (streamRes.rows.length === 0) {
      throw { statusCode: 400, message: 'Invalid target stream specified.' };
    }
    const streamCode = streamRes.rows[0].code;

    if (targetGradeLevel <= 10) {
      if (streamCode !== 'GENERAL') {
        throw {
          statusCode: 400,
          message: `Grades 9 and 10 must be enrolled in the General Stream. Natural and Social Science streams are not permitted for Grade ${targetGradeLevel}.`,
        };
      }
    } else {
      if (streamCode === 'GENERAL' || !['NATURAL', 'SOCIAL'].includes(streamCode)) {
        throw {
          statusCode: 400,
          message: 'Grades 11 and 12 require specialization in either Natural Science or Social Science stream.',
        };
      }

      // For Grade 12, student must continue their chosen stream from Grade 11
      if (targetGradeLevel === 12 && student.current_stream_id && student.current_stream_id !== targetStreamId) {
        throw {
          statusCode: 400,
          message: 'Grade 12 enrollment must continue in your declared Grade 11 academic stream.',
        };
      }
    }

    // 5. Check if student is already enrolled in this specific target grade level
    const existingEnroll = await client.query(
      'SELECT id, section_id, grade_level FROM enrollments WHERE student_id = $1 AND academic_year_id = $2 AND grade_level = $3',
      [studentDbId, academicYearId, targetGradeLevel]
    );
    if (existingEnroll.rows.length > 0) {
      throw {
        statusCode: 400,
        message: `This student is already enrolled in Grade ${targetGradeLevel}.`,
      };
    }

    // 6. Lock the section row with FOR UPDATE to prevent race conditions
    const secRes = await client.query(
      'SELECT id, section_name, capacity, grade_level, stream_id FROM sections WHERE id = $1 FOR UPDATE',
      [sectionId]
    );
    if (secRes.rows.length === 0) {
      throw { statusCode: 404, message: 'Section not found.' };
    }
    const section = secRes.rows[0];

    // Check grade & stream alignment
    if (section.grade_level !== targetGradeLevel || section.stream_id !== targetStreamId) {
      throw {
        statusCode: 400,
        message: 'The selected section does not match the target grade level and stream.',
      };
    }

    // 7. Count currently enrolled students in this section
    const countRes = await client.query(
      'SELECT COUNT(*) as enrolled_count FROM enrollments WHERE section_id = $1 AND status = $2',
      [sectionId, 'ENROLLED']
    );
    const enrolledCount = parseInt(countRes.rows[0].enrolled_count, 10);

    // Strict Capacity Enforcement (50/50 -> Reject)
    if (enrolledCount >= section.capacity) {
      throw {
        statusCode: 400,
        message: `Section ${section.section_name} is full. Please select another section.`,
      };
    }

    // 8. Archive previous lower grade active enrollment as COMPLETED
    if (student.current_grade_level && student.current_grade_level < targetGradeLevel) {
      await client.query(
        `UPDATE enrollments SET status = 'COMPLETED' WHERE student_id = $1 AND grade_level = $2 AND status = 'ENROLLED'`,
        [studentDbId, student.current_grade_level]
      );
    }

    // 9. Insert new enrollment record
    const newEnrollRes = await client.query(
      `INSERT INTO enrollments (student_id, section_id, grade_level, stream_id, academic_year_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ENROLLED')
       RETURNING id, enrolled_at`,
      [studentDbId, sectionId, targetGradeLevel, targetStreamId, academicYearId]
    );

    // 10. Update student record with new grade, stream, section, and promotion status
    const newPromotionStatus = targetGradeLevel > 9 ? 'PROMOTED' : 'ACTIVE';
    await client.query(
      `UPDATE students
       SET current_grade_level = $1, current_stream_id = $2, current_section_id = $3, prerequisite_verified = TRUE, promotion_status = $4
       WHERE id = $5`,
      [targetGradeLevel, targetStreamId, sectionId, newPromotionStatus, studentDbId]
    );

    // 11. Send in-app notification to the student
    try {
      await sendNotification({
        userId: student.user_id,
        title: targetGradeLevel === 10 ? 'Grade 10 Promotion Confirmed' : `Enrolled into Grade ${targetGradeLevel}`,
        message: `You have successfully enrolled into Grade ${targetGradeLevel} (Section ${section.section_name}). Your academic schedule is now available.`,
        type: 'ENROLLMENT',
        link: '/student/schedule',
      });
    } catch (notifErr) {
      console.warn('Enrollment notification warning:', notifErr.message);
    }

    // 12. Audit log
    await logAudit({
      userId,
      action: targetGradeLevel > 9 ? 'GRADE_PROMOTION_ENROLLMENT' : 'SECTION_ENROLLMENT',
      entityType: 'ENROLLMENT',
      entityId: newEnrollRes.rows[0].id,
      details: {
        studentId: student.student_id,
        section: section.section_name,
        grade: targetGradeLevel,
        newEnrolledCount: enrolledCount + 1,
        capacity: section.capacity,
      },
    });

    return {
      success: true,
      message: `Successfully enrolled into Section ${section.section_name}.`,
      enrollment: newEnrollRes.rows[0],
      section: {
        name: section.section_name,
        enrolled: enrolledCount + 1,
        capacity: section.capacity,
      },
    };
  });
};

module.exports = {
  enrollStudent,
};
