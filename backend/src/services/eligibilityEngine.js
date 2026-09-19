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

  // Retrieve official Grade 10 results for student across all semesters
  const gradesRes = await query(
    `SELECT gr.total_score, gr.semester, s.id as subject_id, s.name as subject_name
     FROM grade_records gr
     JOIN subjects s ON gr.subject_id = s.id
     JOIN sections sec ON gr.section_id = sec.id
     WHERE gr.student_id = $1 AND sec.grade_level = 10 AND gr.total_score IS NOT NULL`,
    [studentDbId]
  );

  if (gradesRes.rows.length === 0) {
    return {
      eligible: false,
      message: 'You must fulfill the previous grade requirements before selecting this stream. No Grade 10 records found.',
      reasons: ['No official Grade 10 academic records found on file.'],
    };
  }

  // Group by subject to compute annual composite (Sem 1 + Sem 2) / 2
  const subjectAggMap = {};
  gradesRes.rows.forEach((r) => {
    if (!subjectAggMap[r.subject_id]) {
      subjectAggMap[r.subject_id] = {
        name: r.subject_name.trim().toLowerCase(),
        semesters: {},
      };
    }
    const sem = r.semester || 1;
    subjectAggMap[r.subject_id].semesters[sem] = parseFloat(r.total_score || 0);
  });

  const subjectAverages = Object.values(subjectAggMap).map((sub) => {
    const s1 = sub.semesters[1];
    const s2 = sub.semesters[2];
    let annual = 0;
    if (s1 !== undefined && s2 !== undefined) {
      annual = parseFloat(((s1 + s2) / 2).toFixed(2));
    } else if (s1 !== undefined) {
      annual = s1;
    } else if (s2 !== undefined) {
      annual = s2;
    }
    return { name: sub.name, score: annual };
  });

  // Calculate student Grade 10 overall composite average
  const totalSum = subjectAverages.reduce((acc, row) => acc + row.score, 0);
  const studentGpa = parseFloat((totalSum / subjectAverages.length).toFixed(2));

  const reasons = [];

  if (studentGpa < minAvg) {
    reasons.push(`Required overall average for ${stream.name} is ${minAvg}%, but student achieved ${studentGpa}%.`);
  }

  // Check required subject thresholds
  const studentSubjectScores = {};
  subjectAverages.forEach((sub) => {
    studentSubjectScores[sub.name] = sub.score;
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
      message: `You do not meet the qualification criteria for ${stream.name}.`,
      reasons,
      studentGpa,
      minRequiredGpa: minAvg,
      subjectScores: studentSubjectScores,
    };
  }

  return {
    eligible: true,
    message: `Qualified for ${stream.name} with an overall GPA of ${studentGpa}%.`,
    studentGpa,
    minRequiredGpa: minAvg,
    subjectScores: studentSubjectScores,
  };
};

/**
 * Verify linear grade progression (Grade 9 -> 10, 10 -> 11, 11 -> 12)
 */
const checkGradeProgression = (currentGradeLevel, targetGradeLevel) => {
  if (!currentGradeLevel) {
    if (targetGradeLevel === 9) return { allowed: true };
    return {
      allowed: false,
      message: 'New students must start by enrolling in Grade 9 with verified Grade 8 credentials.',
    };
  }

  if (targetGradeLevel <= currentGradeLevel) {
    return {
      allowed: false,
      message: `Cannot enroll in Grade ${targetGradeLevel}. You are already enrolled in or have completed Grade ${currentGradeLevel}.`,
    };
  }

  if (targetGradeLevel > currentGradeLevel + 1) {
    return {
      allowed: false,
      message: `Direct skip from Grade ${currentGradeLevel} to Grade ${targetGradeLevel} is not permitted. Academic progression must be sequential.`,
    };
  }

  return { allowed: true };
};

/**
 * Verify student's academic results for promotion to next grade level
 * Evaluates both Semester 1 and Semester 2 records
 * Annual Composite = (Semester 1 + Semester 2) / 2
 * Standard Promotion: Annual Composite Average >= 50.0% and <= 2 failed subjects (< 50%)
 * @param {number} studentDbId - Database primary key of the student
 * @param {number} sourceGradeLevel - 9, 10, 11, or 12
 * @param {object} options - Optional controls (e.g. allowSingleSemester)
 */
const verifyGradeResultsForPromotion = async (studentDbId, sourceGradeLevel, options = {}) => {
  const targetGradeLevel = sourceGradeLevel + 1;

  const res = await query(
    `SELECT gr.id, gr.quiz_score, gr.midterm_score, gr.assignment_score, gr.final_score,
            gr.total_score, gr.letter_grade, gr.remarks, gr.semester,
            s.id as subject_id, s.name as subject_name, s.code as subject_code, s.credit_hours,
            COALESCE(u_up.first_name || ' ' || u_up.last_name, 'Subject Instructor') as teacher_name
     FROM grade_records gr
     JOIN subjects s ON gr.subject_id = s.id
     JOIN sections sec ON gr.section_id = sec.id
     LEFT JOIN users u_up ON gr.updated_by = u_up.id
     WHERE gr.student_id = $1 AND sec.grade_level = $2 AND gr.total_score IS NOT NULL
     ORDER BY s.name ASC, gr.semester ASC`,
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

  // Group by subject_id to align Semester 1 and Semester 2 records
  const subjectMap = {};
  res.rows.forEach((r) => {
    if (!subjectMap[r.subject_id]) {
      subjectMap[r.subject_id] = {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        subject_code: r.subject_code,
        credit_hours: r.credit_hours,
        teacher_name: r.teacher_name,
        sem1: null,
        sem2: null,
      };
    }
    const sem = r.semester || 1;
    if (sem === 1) subjectMap[r.subject_id].sem1 = r;
    if (sem === 2) subjectMap[r.subject_id].sem2 = r;
  });

  const subjects = Object.values(subjectMap).map((sub) => {
    const s1 = sub.sem1?.total_score != null ? parseFloat(sub.sem1.total_score) : null;
    const s2 = sub.sem2?.total_score != null ? parseFloat(sub.sem2.total_score) : null;
    let annualScore = null;
    if (s1 !== null && s2 !== null) {
      annualScore = parseFloat(((s1 + s2) / 2).toFixed(2));
    } else if (s1 !== null) {
      annualScore = s1;
    } else if (s2 !== null) {
      annualScore = s2;
    }
    return {
      ...sub,
      annualScore,
      isPassed: annualScore !== null && annualScore >= 50.0,
    };
  });

  const sem1Subjects = subjects.filter((s) => s.sem1?.total_score != null);
  const sem2Subjects = subjects.filter((s) => s.sem2?.total_score != null);
  const sem1Scores = sem1Subjects.map((s) => parseFloat(s.sem1.total_score));
  const sem2Scores = sem2Subjects.map((s) => parseFloat(s.sem2.total_score));

  const sem1Average = sem1Scores.length > 0 ? parseFloat((sem1Scores.reduce((a, b) => a + b, 0) / sem1Scores.length).toFixed(2)) : null;
  const sem2Average = sem2Scores.length > 0 ? parseFloat((sem2Scores.reduce((a, b) => a + b, 0) / sem2Scores.length).toFixed(2)) : null;

  const hasBothSemesters = sem1Average !== null && sem2Average !== null;

  // Check if system requires both semesters
  if (!hasBothSemesters && !options.allowSingleSemester) {
    if (sem1Average !== null && sem2Average === null) {
      return {
        eligible: false,
        reason: 'SEMESTER_2_PENDING',
        sourceGradeLevel,
        targetGradeLevel,
        message: `Grade ${sourceGradeLevel} requires completion of both Semester 1 and Semester 2 before promotion. Current Semester 1 average: ${sem1Average}%. Awaiting Semester 2 completion.`,
        average: sem1Average,
        sem1Average,
        sem2Average: null,
        totalScoreSum: parseFloat(sem1Scores.reduce((a, b) => a + b, 0).toFixed(2)),
        subjectCount: subjects.length,
        formula: `Semester 1 Average: ${sem1Average}% (Semester 2 In Progress)`,
        minRequired: 50.0,
        subjects,
      };
    }
  }

  // Calculate annual composite average
  let annualAverage = null;
  if (hasBothSemesters) {
    annualAverage = parseFloat(((sem1Average + sem2Average) / 2).toFixed(2));
  } else if (sem1Average !== null) {
    annualAverage = sem1Average;
  } else if (sem2Average !== null) {
    annualAverage = sem2Average;
  }

  const failedSubjects = subjects.filter((s) => s.annualScore !== null && s.annualScore < 50.0);
  const failedSubjectsCount = failedSubjects.length;
  const minPassingScore = 50.0;
  const maxAllowedFailures = 2;

  const formula = hasBothSemesters
    ? `(Semester 1 Average: ${sem1Average}% + Semester 2 Average: ${sem2Average}%) / 2 = ${annualAverage}%`
    : `Average: ${annualAverage}%`;

  if (annualAverage < minPassingScore) {
    return {
      eligible: false,
      reason: 'BELOW_CRITERIA',
      sourceGradeLevel,
      targetGradeLevel,
      message: `Grade ${sourceGradeLevel} annual composite average (${annualAverage}%) is below the minimum required passing average of ${minPassingScore}%.`,
      average: annualAverage,
      sem1Average,
      sem2Average,
      failedSubjectsCount,
      totalScoreSum: parseFloat(subjects.reduce((acc, s) => acc + (s.annualScore || 0), 0).toFixed(2)),
      subjectCount: subjects.length,
      formula,
      minRequired: minPassingScore,
      subjects,
    };
  }

  if (failedSubjectsCount > maxAllowedFailures) {
    const failedNames = failedSubjects.map((s) => s.subject_name).join(', ');
    return {
      eligible: false,
      reason: 'TOO_MANY_FAILED_SUBJECTS',
      sourceGradeLevel,
      targetGradeLevel,
      message: `Grade ${sourceGradeLevel} promotion denied: Student failed ${failedSubjectsCount} subjects (${failedNames}). Maximum allowed failed subjects is ${maxAllowedFailures}.`,
      average: annualAverage,
      sem1Average,
      sem2Average,
      failedSubjectsCount,
      totalScoreSum: parseFloat(subjects.reduce((acc, s) => acc + (s.annualScore || 0), 0).toFixed(2)),
      subjectCount: subjects.length,
      formula,
      minRequired: minPassingScore,
      subjects,
    };
  }

  // If advancing to Grade 11, evaluate both Natural and Social stream criteria for comparison
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
    message: `Grade ${sourceGradeLevel} academic criteria fulfilled with an annual composite average of ${annualAverage}% across both semesters. Qualified to proceed to Grade ${targetGradeLevel}.`,
    average: annualAverage,
    sem1Average,
    sem2Average,
    failedSubjectsCount,
    totalScoreSum: parseFloat(subjects.reduce((acc, s) => acc + (s.annualScore || 0), 0).toFixed(2)),
    subjectCount: subjects.length,
    formula,
    minRequired: minPassingScore,
    subjects,
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
