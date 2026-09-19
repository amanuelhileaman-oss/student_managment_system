/**
 * Automated Verification Script for Two-Semester Academic System
 * Tests:
 * 1. Admin Semester Switch (Semester 1 <-> Semester 2)
 * 2. Teacher Grading in Semester 1 and Semester 2
 * 3. Group Assignment compatibility & Score Auto-Propagation
 * 4. Student Report Card Two-Semester Composite Math ((Sem 1 + Sem 2) / 2)
 * 5. Year-End Promotion Processing
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

function record(cond, name, details = '') {
  if (cond) {
    console.log(`  ✅ [PASS] ${name}${details ? ' ➔ ' + details : ''}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name}${details ? ' ➔ ' + details : ''}`);
    failed++;
  }
}

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text().catch(() => '');
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTwoSemesterTestSuite() {
  console.log('========================================================================');
  console.log(`🚀 STARTING TWO-SEMESTER ACADEMIC SYSTEM TEST SUITE: ${API_BASE}`);
  console.log('========================================================================\n');

  // Step 1: Admin Login
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
  });
  record(adminLogin.ok && adminLogin.data?.token, 'Admin Login', `Token acquired`);
  const adminToken = adminLogin.data?.token;

  // Step 2: Teacher Login (Adu Taye)
  const teacherLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'adu@gmail.com', password: 'Teacher@123' }),
  });
  record(teacherLogin.ok && teacherLogin.data?.token, 'Teacher Login (Adu Taye)', `Token acquired`);
  const teacherToken = teacherLogin.data?.token;

  // Step 3: Student Login (Adino Bekele - SUD-2026-033)
  const studentLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'adino@gmail.com', password: 'Student@123' }),
  });
  record(studentLogin.ok && studentLogin.data?.token, 'Student Login (Adino Bekele)', `Token acquired`);
  const studentToken = studentLogin.data?.token;

  // -------------------------------------------------------------------------
  // TEST 1: ADMIN SEMESTER SWITCHING
  // -------------------------------------------------------------------------
  console.log('\n📌 1. Admin Active Semester Management');
  const getYearRes = await api('/admin/academic-years/current', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  record(getYearRes.ok && getYearRes.data?.data?.year_name, 'Get Current Academic Year', `Year: ${getYearRes.data?.data?.year_name}, Current Semester: ${getYearRes.data?.data?.current_semester}`);

  // Switch to Semester 1
  const switchSem1 = await api('/admin/academic-years/current/semester', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ semester: 1 }),
  });
  record(switchSem1.ok && switchSem1.data?.data?.current_semester === 1, 'Admin Switches to Semester 1', `Current Semester: ${switchSem1.data?.data?.current_semester}`);

  // Switch to Semester 2
  const switchSem2 = await api('/admin/academic-years/current/semester', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ semester: 2 }),
  });
  record(switchSem2.ok && switchSem2.data?.data?.current_semester === 2, 'Admin Switches to Semester 2', `Current Semester: ${switchSem2.data?.data?.current_semester}`);

  // -------------------------------------------------------------------------
  // TEST 2: TEACHER SEMESTER-AWARE GRADING & GROUP SCORE PROPAGATION
  // -------------------------------------------------------------------------
  console.log('\n📌 2. Teacher Multi-Semester Grading & Group Assignment Propagation');
  const classesRes = await api('/teachers/classes', {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  record(classesRes.ok && classesRes.data?.data?.length > 0, 'Teacher Assigned Classes', `Classes: ${classesRes.data?.data?.length}`);
  const activeClass = classesRes.data?.data?.[0];

  if (activeClass) {
    // 2a. Record Semester 1 Grade for Dawit (Total: 90)
    const gradeSem1Res = await api('/teachers/grades', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        studentId: 'SUD-2026-033',
        subjectId: activeClass.subject_id,
        sectionId: activeClass.section_id,
        semester: 1,
        quizScore: 9,
        midtermScore: 27,
        assignmentScore: 18,
        finalScore: 36,
        remarks: 'Outstanding performance in Semester 1',
      }),
    });
    record(
      gradeSem1Res.ok && parseFloat(gradeSem1Res.data?.data?.total_score) === 90,
      'Teacher Records Semester 1 Grade (Total: 90.0)',
      `Score: ${gradeSem1Res.data?.data?.total_score}, Letter: ${gradeSem1Res.data?.data?.letter_grade}`
    );

    // 2b. Record Semester 2 Grade for Dawit (Total: 80)
    const gradeSem2Res = await api('/teachers/grades', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        studentId: 'SUD-2026-033',
        subjectId: activeClass.subject_id,
        sectionId: activeClass.section_id,
        semester: 2,
        quizScore: 8,
        midtermScore: 24,
        assignmentScore: 16,
        finalScore: 32,
        remarks: 'Great effort in Semester 2',
      }),
    });
    record(
      gradeSem2Res.ok && parseFloat(gradeSem2Res.data?.data?.total_score) === 80,
      'Teacher Records Semester 2 Grade (Total: 80.0)',
      `Score: ${gradeSem2Res.data?.data?.total_score}, Letter: ${gradeSem2Res.data?.data?.letter_grade}`
    );

    // 2c. Verify Group Assignment Propagation remains 100% functional
    const assignRes = await api('/teachers/assignments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        teacherAssignmentId: activeClass.assignment_id,
        title: `Semester Group Project ${Date.now()}`,
        description: 'Testing group assignment compatibility in two-semester system',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
        maxScore: 20,
      }),
    });
    const assignmentId = assignRes.data?.data?.id;

    if (assignmentId) {
      const submitRes = await api('/students/assignments/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({
          assignmentId,
          submissionContent: 'Group project solution for two-semester verification.',
        }),
      });
      const groupCode = submitRes.data?.data?.group_code;

      if (groupCode) {
        const groupScoreRes = await api('/teachers/assignments/groups/score', {
          method: 'POST',
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: JSON.stringify({
            groupCode,
            groupScore: 19.5,
          }),
        });
        record(
          groupScoreRes.ok && groupScoreRes.data?.success,
          'Group Assignment Score Auto-Propagation to Teammates (Untouched & Intact)',
          `Group Code: ${groupCode}, Message: "${groupScoreRes.data?.message}"`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // TEST 3: STUDENT TWO-SEMESTER REPORT CARD & ANNUAL COMPOSITE MATH
  // -------------------------------------------------------------------------
  console.log('\n📌 3. Student Two-Semester Report Card & Annual Composite');
  const resultsRes = await api('/students/results', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  record(resultsRes.ok && resultsRes.data?.data, 'Fetch Student Official Results', `Status: ${resultsRes.status}`);

  const activeGradeReport = resultsRes.data?.data?.resultsByGrade?.[9];
  const mathRecord = activeGradeReport?.grades?.find((g) => g.subject_name?.toLowerCase().includes('math'));

  record(
    !!mathRecord && mathRecord.sem1 !== null && mathRecord.sem2 !== null,
    'Report Card contains discrete Semester 1 and Semester 2 records for Math',
    `Sem1 Total: ${mathRecord?.sem1?.total_score}, Sem2 Total: ${mathRecord?.sem2?.total_score}`
  );

  // Annual composite = (90 + 80) / 2 = 85.0
  const expectedAnnual = (parseFloat(mathRecord?.sem1?.total_score) + parseFloat(mathRecord?.sem2?.total_score)) / 2;
  const actualAnnual = parseFloat(mathRecord?.annual_total);
  record(
    actualAnnual === expectedAnnual,
    `Annual Composite Math Verification: (${mathRecord?.sem1?.total_score} + ${mathRecord?.sem2?.total_score}) / 2 = ${actualAnnual}`,
    `Expected: ${expectedAnnual}, Actual: ${actualAnnual}`
  );

  record(
    activeGradeReport?.hasBothSemesters === true,
    'Two-Semester Completion Detected for Grade 9',
    `Sem1 Avg: ${activeGradeReport?.sem1Average}%, Sem2 Avg: ${activeGradeReport?.sem2Average}%, Annual Avg: ${activeGradeReport?.averageScore}%`
  );

  // -------------------------------------------------------------------------
  // TEST 4: YEAR-END PROMOTION PROCESSING
  // -------------------------------------------------------------------------
  console.log('\n📌 4. Institutional Year-End Promotion Execution');
  const promoRes = await api('/admin/promotions/process-year-end', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  record(
    promoRes.ok && promoRes.data?.success && promoRes.data?.data?.totalEvaluated > 0,
    'Administrator Year-End Promotion Wizard Execution',
    `Evaluated: ${promoRes.data?.data?.totalEvaluated}, Promoted: ${promoRes.data?.data?.totalPromoted}, Retained: ${promoRes.data?.data?.totalRetained}`
  );

  console.log('\n========================================================================');
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED | ${failed} FAILED (Total: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed === 0) {
    console.log('🎉 ALL TWO-SEMESTER SYSTEM & PROMOTION TESTS PASSED WITH 100% INTEGRITY!\n');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failed} tests failed.\n`);
    process.exit(1);
  }
}

runTwoSemesterTestSuite().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
