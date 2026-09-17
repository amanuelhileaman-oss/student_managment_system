const { withTransaction, query } = require('../config/db');
const { logAudit } = require('./auditService');

/**
 * Helper to calculate letter grade from total score (0-100)
 */
const calculateLetterGrade = (total) => {
  if (total >= 90) return 'A+';
  if (total >= 85) return 'A';
  if (total >= 80) return 'A-';
  if (total >= 75) return 'B+';
  if (total >= 70) return 'B';
  if (total >= 65) return 'B-';
  if (total >= 60) return 'C+';
  if (total >= 50) return 'C';
  return 'F';
};

/**
 * Propagate a group assignment score automatically to all members of the group
 * @param {string} groupCode - Standardized code e.g. 'GROUP-MATH9-A-001'
 * @param {number} groupScore - e.g. 18.5
 * @param {number} teacherDbId - Submitting teacher
 * @param {number} userId - Authenticated user ID for audit
 */
const propagateGroupScore = async ({ groupCode, groupScore, teacherDbId, userId = null }) => {
  return await withTransaction(async (client) => {
    // 1. Fetch group details and related assignment
    const groupRes = await client.query(
      `SELECT g.id, g.group_code, g.group_name, a.id as assignment_id, a.title, a.max_score,
              ta.teacher_id, ta.subject_id, ta.section_id, ta.academic_year_id
       FROM assignment_groups g
       JOIN assignments a ON g.assignment_id = a.id
       JOIN teacher_assignments ta ON a.teacher_assignment_id = ta.id
       WHERE g.group_code = $1 FOR UPDATE`,
      [groupCode]
    );

    if (groupRes.rows.length === 0) {
      throw { statusCode: 404, message: `Group with code "${groupCode}" not found.` };
    }

    const group = groupRes.rows[0];

    // Verify teacher authorization
    if (teacherDbId && group.teacher_id !== teacherDbId) {
      throw { statusCode: 403, message: 'You are not authorized to enter results for this section.' };
    }

    const targetScore = (groupScore !== undefined && groupScore !== null) ? groupScore : group.group_score;
    const scoreNum = parseFloat(targetScore);
    const maxScore = parseFloat(group.max_score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      throw {
        statusCode: 400,
        message: `Invalid score. Score must be between 0 and ${maxScore}.`,
      };
    }

    // 2. Update group record
    await client.query(
      `UPDATE assignment_groups
       SET group_score = $1, evaluated_at = NOW(), status = 'GRADED'
       WHERE id = $2`,
      [scoreNum, group.id]
    );

    // 3. Find all members of this group
    const membersRes = await client.query(
      `SELECT gm.student_id, s.student_id as student_code, u.first_name, u.last_name
       FROM assignment_group_members gm
       JOIN students s ON gm.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE gm.group_id = $1`,
      [group.id]
    );

    if (membersRes.rows.length === 0) {
      throw { statusCode: 400, message: `Group "${groupCode}" has no registered student members.` };
    }

    const updatedStudents = [];

    // 4. Update each member student's grade record atomically
    for (const member of membersRes.rows) {
      // Check existing grade record
      const existingGrade = await client.query(
        `SELECT id, quiz_score, midterm_score, assignment_score, final_score
         FROM grade_records
         WHERE student_id = $1 AND subject_id = $2 AND academic_year_id = $3`,
        [member.student_id, group.subject_id, group.academic_year_id]
      );

      let quiz = 0;
      let midterm = 0;
      let final = 0;

      if (existingGrade.rows.length > 0) {
        const row = existingGrade.rows[0];
        quiz = parseFloat(row.quiz_score || 0);
        midterm = parseFloat(row.midterm_score || 0);
        final = parseFloat(row.final_score || 0);
      }

      const total = quiz + midterm + scoreNum + final;
      const letter = calculateLetterGrade(total);

      await client.query(
        `INSERT INTO grade_records
          (student_id, subject_id, section_id, academic_year_id, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (student_id, subject_id, academic_year_id)
         DO UPDATE SET
           assignment_score = $7,
           total_score = $9,
           letter_grade = $10,
           remarks = $11,
           updated_by = $12,
           updated_at = NOW()`,
        [
          member.student_id,
          group.subject_id,
          group.section_id,
          group.academic_year_id,
          quiz,
          midterm,
          scoreNum,
          final,
          total,
          letter,
          `Group Score from ${groupCode}`,
          userId,
        ]
      );

      updatedStudents.push({
        studentId: member.student_code,
        name: `${member.first_name} ${member.last_name}`,
        assignmentScore: scoreNum,
        totalScore: total,
        letterGrade: letter,
      });
    }

    // 5. Audit logging
    await logAudit({
      userId,
      action: 'GROUP_SCORE_PROPAGATION',
      entityType: 'ASSIGNMENT_GROUP',
      entityId: group.id,
      details: {
        groupCode,
        score: scoreNum,
        membersCount: updatedStudents.length,
      },
    });

    return {
      success: true,
      message: `Score of ${scoreNum} successfully propagated to all ${updatedStudents.length} members of group ${groupCode}.`,
      groupCode,
      groupName: group.group_name,
      score: scoreNum,
      updatedMembersCount: updatedStudents.length,
      members: updatedStudents,
    };
  });
};

module.exports = {
  calculateLetterGrade,
  propagateGroupScore,
};
