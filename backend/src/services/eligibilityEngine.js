const { query } = require('../config/db');

/**
 * Verify Grade 8 prerequisite requirement from PostgreSQL prerequisites table
 * @param {string} studentId
 */
const verifyGrade8Prerequisite = async (studentId) => {
  const res = await query('SELECT * FROM prerequisites WHERE student_id = $1', [studentId]);
  if (res.rows.length === 0) {
    return {
      eligible: false,
      notFound: true,
      message: 'Please fulfill the Grade 8 prerequisite requirement before continuing. No official Grade 8 record found for this Student ID.',
    };
  }

  const record = res.rows[0];
  const avg = parseFloat(record.average_score);
  if (record.status === 'FAILED' || avg < 50.0) {
    return {
      eligible: false,
      failed: true,
      message: `Please fulfill the Grade 8 prerequisite requirement before continuing. Grade 8 status is ${record.status} with an average of ${avg}% (minimum 50% required).`,
      record,
    };
  }

  if (record.status === 'REJECTED') {
    return {
      eligible: false,
      failed: true,
      message: 'Grade 8 prerequisite document was rejected by administration. Please contact the admissions office.',
      record,
    };
  }

  if (record.status === 'PENDING_VERIFICATION' || !record.verified) {
    return {
      eligible: false,
      pending: true,
      message: 'Grade 8 prerequisite document is currently awaiting Administrator review and approval.',
      record,
    };
  }

  return {
    eligible: true,
    message: 'Grade 8 prerequisite verified successfully.',
    record,
  };
};

/**
 * Evaluate student stream eligibility based on official Grade 10 results and Admin-configured stream criteria
 * @param {number} studentDbId - Database primary key of the student
 * @param {number} targetGradeLevel - 11 or 12
 * @param {string} streamCode - 'NATURAL' | 'SOCIAL' | 'GENERAL'
 */
const checkStreamEligibility = async (studentDbId, targetGradeLevel, streamCode) => {
  const normalizedStream = (streamCode || '').toUpperCase();

  if (targetGradeLevel < 11) {
    if (normalizedStream && normalizedStream !== 'GENERAL') {
      return {
        eligible: false,
        message: 'Grades 9 and 10 only support the General Stream. Natural and Social Science streams are not available for Grade 9 or 10.',
        reasons: ['Natural and Social Science streams are only available for Grades 11 and 12.'],
      };
    }
    // Grades 9 and 10 are General Stream
    return {
      eligible: true,
      message: 'General Stream is standard for Grade 9 and 10.',
    };
  }

  if (normalizedStream === 'GENERAL') {
    return {
      eligible: false,
      message: 'General Stream is not available for Grades 11 and 12. Students must select Natural Science or Social Science stream.',
      reasons: ['Grades 11 and 12 require specialization in Natural Science or Social Science.'],
    };
  }

  // For Grade 11 & 12, fetch stream details and stream criteria
  const streamRes = await query('SELECT id, code, name FROM streams WHERE code = $1', [normalizedStream]);
  if (streamRes.rows.length === 0) {
    return { eligible: false, message: `Invalid stream code: ${streamCode}` };
  }
  const stream = streamRes.rows[0];

  const criteriaRes = await query(
    'SELECT min_overall_average, required_subjects_config FROM stream_criteria WHERE stream_id = $1 AND target_grade_level = 11',
    [stream.id]
  );
  if (criteriaRes.rows.length === 0) {
    return { eligible: true, message: 'No specific criteria set for this stream.' };
  }

  const { min_overall_average, required_subjects_config } = criteriaRes.rows[0];
  const minAvg = parseFloat(min_overall_average);
  const requiredSubjects = required_subjects_config.subjects || {};

  // Retrieve official Grade 10 results for student
  const gradesRes = await query(
    `SELECT gr.total_score, s.name as subject_name
     FROM grade_records gr
     JOIN subjects s ON gr.subject_id = s.id
     JOIN sections sec ON gr.section_id = sec.id
     WHERE gr.student_id = $1 AND sec.grade_level = 10`,
    [studentDbId]
  );

  if (gradesRes.rows.length === 0) {
    return {
      eligible: false,
      message: 'You must fulfill the previous grade requirements before selecting this stream. No Grade 10 records found.',
      reasons: ['No official Grade 10 academic records found on file.'],
    };
  }

  // Calculate student Grade 10 overall GPA
  const totalSum = gradesRes.rows.reduce((acc, row) => acc + parseFloat(row.total_score || 0), 0);
  const studentGpa = parseFloat((totalSum / gradesRes.rows.length).toFixed(2));

  const reasons = [];

  if (studentGpa < minAvg) {
    reasons.push(`Required overall average for ${stream.name} is ${minAvg}%, but student achieved ${studentGpa}%.`);
  }

  // Check required subject thresholds
  const studentSubjectScores = {};
  gradesRes.rows.forEach((r) => {
    studentSubjectScores[r.subject_name.trim().toLowerCase()] = parseFloat(r.total_score);
  });

  for (const [reqSubject, reqMinScore] of Object.entries(requiredSubjects)) {
    const matchedScore = studentSubjectScores[reqSubject.trim().toLowerCase()];
    if (matchedScore === undefined) {
      reasons.push(`Required subject "${reqSubject}" has not been completed.`);
    } else if (matchedScore < reqMinScore) {
      reasons.push(`Score in "${reqSubject}" is ${matchedScore}%, which does not meet the minimum required ${reqMinScore}%.`);
    }
  }

  if (reasons.length > 0) {
    return {
      eligible: false,
      message: 'You must fulfill the previous grade requirements before selecting this stream.',
      reasons,
      studentGpa,
      minRequiredGpa: minAvg,
    };
  }

  return {
    eligible: true,
    message: `Qualified for ${stream.name}.`,
    studentGpa,
    streamName: stream.name,
  };
};

/**
 * Check linear grade progression and prohibit grade jumping
 * @param {number} currentGradeLevel - Current student grade level in database (e.g. 9)
 * @param {number} targetGradeLevel - Target grade level student is attempting to enroll into (e.g. 10)
 */
const checkGradeProgression = (currentGradeLevel, targetGradeLevel) => {
  if (!currentGradeLevel) {
    // New enrollment must enter Grade 9
    if (targetGradeLevel !== 9) {
      return {
        allowed: false,
        message: 'New high school students must enroll in Grade 9.',
      };
    }
    return { allowed: true };
  }

  if (targetGradeLevel <= currentGradeLevel) {
    return {
      allowed: false,
      message: `You are already enrolled or completed Grade ${currentGradeLevel}. You cannot enroll into Grade ${targetGradeLevel}.`,
    };
  }

  if (targetGradeLevel !== currentGradeLevel + 1) {
    return {
      allowed: false,
      message: `Please fulfill the previous grade requirements before proceeding to Grade ${targetGradeLevel}. Grade jumping is strictly prohibited. You must complete Grade ${currentGradeLevel + 1} first.`,
    };
  }

  return { allowed: true };
};

/**
 * Verify student's academic results for promotion to next grade level
 * Supports Grade 9 -> 10, Grade 10 -> 11, and Grade 11 -> 12
 * Computes average across all delivered subjects from teachers: (sub_1 + sub_2 + ... + sub_n) / total subjects
 * @param {number} studentDbId - Database primary key of the student
 * @param {number} sourceGradeLevel - 9, 10, or 11
 */
const verifyGradeResultsForPromotion = async (studentDbId, sourceGradeLevel) => {
  const targetGradeLevel = sourceGradeLevel + 1;

  const res = await query(
    `SELECT gr.id, gr.quiz_score, gr.midterm_score, gr.assignment_score, gr.final_score,
            gr.total_score, gr.letter_grade, gr.remarks,
            s.name as subject_name, s.code as subject_code, s.credit_hours,
            COALESCE(u_up.first_name || ' ' || u_up.last_name, 'Subject Instructor') as teacher_name
     FROM grade_records gr
     JOIN subjects s ON gr.subject_id = s.id
     JOIN sections sec ON gr.section_id = sec.id
     LEFT JOIN users u_up ON gr.updated_by = u_up.id
     WHERE gr.student_id = $1 AND sec.grade_level = $2 AND gr.total_score IS NOT NULL
     ORDER BY s.name ASC`,
    [studentDbId, sourceGradeLevel]
  );

  if (res.rows.length === 0) {
    return {
      eligible: false,
      reason: 'NO_RESULTS',
      sourceGradeLevel,
      targetGradeLevel,
      message: `Official Grade ${sourceGradeLevel} academic results have not yet been recorded. Please await your final grades before proceeding to Grade ${targetGradeLevel}.`,
      average: 0,
      totalScoreSum: 0,
      subjectCount: 0,
      formula: 'No evaluated subjects found',
      minRequired: 50.0,
      subjects: [],
    };
  }

  const scores = res.rows.map((r) => parseFloat(r.total_score || 0));
  const sum = scores.reduce((acc, val) => acc + val, 0);
  const average = parseFloat((sum / scores.length).toFixed(2));
  const minPassingScore = 50.0;

  const formulaComponents = res.rows.map((r) => `${r.subject_name} (${parseFloat(r.total_score).toFixed(1)})`);
  const formula = `(${formulaComponents.join(' + ')}) / ${scores.length} = ${average}%`;

  if (average < minPassingScore) {
    return {
      eligible: false,
      reason: 'BELOW_CRITERIA',
      sourceGradeLevel,
      targetGradeLevel,
      message: `Grade ${sourceGradeLevel} result is below the criteria. Please perform your qualification before proceed. (Calculated average: ${average}%, minimum required: ${minPassingScore}%).`,
      average,
      totalScoreSum: parseFloat(sum.toFixed(2)),
      subjectCount: scores.length,
      formula,
      minRequired: minPassingScore,
      subjects: res.rows,
    };
  }

  // If advancing to Grade 11, evaluate both Natural and Social stream criteria for student comparison
  let streamEvaluation = null;
  if (targetGradeLevel === 11) {
    const naturalEval = await checkStreamEligibility(studentDbId, 11, 'NATURAL');
    const socialEval = await checkStreamEligibility(studentDbId, 11, 'SOCIAL');
    streamEvaluation = {
      NATURAL: naturalEval,
      SOCIAL: socialEval,
    };
  }

  return {
    eligible: true,
    reason: 'PASSED',
    sourceGradeLevel,
    targetGradeLevel,
    message: `Grade ${sourceGradeLevel} academic criteria fulfilled with an average of ${average}%. Qualified to proceed to Grade ${targetGradeLevel}.`,
    average,
    totalScoreSum: parseFloat(sum.toFixed(2)),
    subjectCount: scores.length,
    formula,
    minRequired: minPassingScore,
    subjects: res.rows,
    streamEvaluation,
  };
};

/**
 * Backwards-compatible wrapper for Grade 9 results
 */
const verifyGrade9ResultsForPromotion = async (studentDbId) => {
  return await verifyGradeResultsForPromotion(studentDbId, 9);
};

module.exports = {
  verifyGrade8Prerequisite,
  checkStreamEligibility,
  checkGradeProgression,
  verifyGradeResultsForPromotion,
  verifyGrade9ResultsForPromotion,
};
