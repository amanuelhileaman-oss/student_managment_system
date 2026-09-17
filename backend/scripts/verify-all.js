/**
 * Automated Verification Suite for PERN Stack High School Management System
 * Tests all core domain rules, database source of truth, security boundaries,
 * stream eligibility, atomic section capacity, group score propagation, and CSV reporting.
 */

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, ok: res.ok, raw: text };
  }
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName} ${details ? '-> ' + details : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName} ${details ? '-> ' + details : ''}`);
    failed++;
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING FULL SYSTEM VERIFICATION SUITE');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // 1. HEALTH CHECK
  // ---------------------------------------------------------------
  const health = await request('/health');
  assert(health.ok && health.data.status === 'healthy', 'System Health Check', `Status: ${health.data.status}`);

  // ---------------------------------------------------------------
  // 2. ADMIN AUTHENTICATION & SINGLE ADMIN RULE
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 1: Admin Authentication & Security ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
  });
  assert(adminLogin.ok && adminLogin.data.user.role === 'admin', 'Admin Login with aman12@gmail.com', `Role: ${adminLogin.data?.user?.role}`);
  const adminToken = adminLogin.data?.token;

  // Attempt to register as Admin
  const fakeAdminReg = await request('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Hacker',
      lastName: 'Admin',
      email: 'hacker.admin@test.com',
      password: 'password123',
      studentId: 'STU-2026-004',
      role: 'admin',
    }),
  });
  assert(fakeAdminReg.status === 403, 'Block Student Registration with Admin Role', `Status: ${fakeAdminReg.status}`);

  // ---------------------------------------------------------------
  // 3. GRADE 8 PREREQUISITE REQUIREMENT (RULE A)
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Grade 8 Prerequisite Validation ---');
  // Missing record
  // Missing Grade 8 Document rejection test
  const missingDoc = await request('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'No',
      lastName: 'Document',
      email: 'no.doc@test.com',
      password: 'password123',
      studentId: 'STU-2026-001',
    }),
  });
  assert(
    missingDoc.status === 400 && missingDoc.data.message.includes('Official Grade 8 completion document/certificate is strictly required'),
    'Mandatory Grade 8 Document Requirement Rejection',
    missingDoc.data.message
  );

  const sampleDocData = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...';

  // Real-time Ministry Exam Prerequisite Verification Check
  const prereqCheckFailed = await request('/auth/check-prerequisite/STU-2026-003');
  assert(
    prereqCheckFailed.ok && prereqCheckFailed.data.status === 'FAILED',
    'Real-time Prerequisite Check: FAILED status detection',
    prereqCheckFailed.data.message
  );

  const prereqCheckPassed = await request('/auth/check-prerequisite/STU-2026-088');
  assert(
    prereqCheckPassed.ok && prereqCheckPassed.data.status === 'PASSED',
    'Real-time Prerequisite Check: PASSED status detection',
    prereqCheckPassed.data.message
  );

  // Failed prerequisite
  const failedPrereq = await request('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Yonatan',
      lastName: 'Alemu',
      email: 'yonatan.failed@test.com',
      password: 'password123',
      studentId: 'STU-2026-003', // Recorded as FAILED with 41.42%
      grade8Document: sampleDocData,
      documentName: 'Yonatan_Certificate.pdf',
    }),
  });
  assert(
    failedPrereq.status === 400 && failedPrereq.data.message.includes('Grade 8 status is FAILED'),
    'Failed Grade 8 Record Rejection',
    failedPrereq.data.message
  );

  // Valid passing student registration with Grade 8 document
  const { query } = require('../src/config/db');
  const testStudentId = `STU-REG-${Date.now().toString().slice(-5)}`;
  const testStudentEmail = `student.${testStudentId.toLowerCase()}@test.com`;

  await query(
    `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
     VALUES ($1, 'Test Passing Applicant', 'St. George Primary', 2026, 560, 80.0, 'PASSED', TRUE)
     ON CONFLICT DO NOTHING`,
    [testStudentId]
  );

  const validStudentReg = await request('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Applicant',
      lastName: 'Passed',
      email: testStudentEmail,
      password: 'Student@123',
      studentId: testStudentId,
      phone: '+251911556677',
      gender: 'Female',
      grade8Document: sampleDocData,
      documentName: 'Applicant_Passed_Certificate.pdf',
      documentType: 'application/pdf',
    }),
  });
  assert(validStudentReg.status === 201, 'Valid Student Self-Registration with Grade 8 Document & Prerequisite', validStudentReg.data?.message);

  // Admin Document Review Test: Fetch submitted documents & approve
  const adminDocs = await request('/admin/documents?status=PENDING_ADMIN_VERIFICATION', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminDocs.status === 200 && adminDocs.data.count > 0, 'Admin Fetches Pending Grade 8 Documents', `Found ${adminDocs.data.count} pending`);

  const studentToApprove = adminDocs.data.data.find((d) => d.student_id === testStudentId);
  if (studentToApprove) {
    const approveDoc = await request(`/admin/documents/${studentToApprove.id}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'APPROVE', notes: 'Verified and approved by Administrator.' }),
    });
    assert(approveDoc.status === 200 && approveDoc.data.data.document_status === 'APPROVED', 'Admin Approves Official Grade 8 Document', approveDoc.data?.message);
  }

  // Admin Document Rejection & Account Deactivation Verification
  const testRejectId = `STU-REJ-${Date.now().toString().slice(-5)}`;
  const testRejectEmail = `student.${testRejectId.toLowerCase()}@test.com`;

  await query(
    `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
     VALUES ($1, 'Applicant To Reject', 'Sample Primary', 2026, 400, 57.0, 'PASSED', TRUE)
     ON CONFLICT DO NOTHING`,
    [testRejectId]
  );

  const rejectReg = await request('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Applicant',
      lastName: 'Unqualified',
      email: testRejectEmail,
      password: 'Student@123',
      studentId: testRejectId,
      phone: '+251911998877',
      gender: 'Male',
      grade8Document: sampleDocData,
      documentName: 'Unqualified_Certificate.pdf',
      documentType: 'application/pdf',
      previousSchool: 'Sample Primary',
      grade8AverageScore: 57.0,
    }),
  });
  assert(rejectReg.status === 201, 'Student Registering for Deactivation Test', rejectReg.data?.message);

  const adminDocsAfter = await request('/admin/documents?status=PENDING_ADMIN_VERIFICATION', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const studentToReject = adminDocsAfter.data?.data?.find((d) => d.student_id === testRejectId);
  assert(studentToReject, 'Admin Finds Candidate in Grade 8 Review Queue', `Found candidate ID: ${testRejectId}`);

  const rejectDoc = await request(`/admin/documents/${studentToReject.id}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      action: 'REJECT',
      notes: 'Grade 8 document verification failed. Official seal invalid and prerequisite unfulfilled.',
    }),
  });
  assert(
    rejectDoc.status === 200 && rejectDoc.data?.message?.includes('Student account has been deactivated'),
    'Admin Rejects Grade 8 Document and Deactivates Account',
    rejectDoc.data?.message
  );

  // Verify deactivated student login is strictly blocked with HTTP 403
  const blockedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testRejectEmail,
      password: 'Student@123',
    }),
  });
  assert(
    blockedLogin.status === 403 && blockedLogin.data?.message?.includes('Account is deactivated'),
    'Deactivated Student Login Strictly Blocked (HTTP 403 Forbidden)',
    blockedLogin.data?.message
  );

  // ---------------------------------------------------------------
  // 4. TEACHER AUTHENTICATION & ROLE ISOLATION
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Teacher Authentication & Access Control ---');
  const teacherLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'teacher.math@highschool.edu', password: 'Teacher@123' }),
  });
  assert(teacherLogin.ok && teacherLogin.data.user.role === 'teacher', 'Teacher Login', `Teacher ID: ${teacherLogin.data?.user?.teacher?.teacher_id}`);
  const teacherToken = teacherLogin.data?.token;

  // Student login
  const studentLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student.g9@highschool.edu', password: 'Student@123' }),
  });
  assert(studentLogin.ok && studentLogin.data.user.role === 'student', 'Student Login', `Student: ${studentLogin.data?.user?.firstName}`);
  const studentToken = studentLogin.data?.token;

  // Security Boundaries (RBAC)
  const studentAuditAttempt = await request('/audit', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentAuditAttempt.status === 403, 'Student blocked from Admin Audit Logs (403)', `Status: ${studentAuditAttempt.status}`);

  const teacherAuditAttempt = await request('/audit', {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  assert(teacherAuditAttempt.status === 403, 'Teacher blocked from Admin Audit Logs (403)', `Status: ${teacherAuditAttempt.status}`);

  // ---------------------------------------------------------------
  // 5. STREAM ELIGIBILITY ENGINE (RULE E)
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Stream Eligibility Engine ---');
  // Login as Natnael Desta (High Science in Grade 10)
  const natnaelLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student.g10.natural@highschool.edu', password: 'Student@123' }),
  });
  const natnaelToken = natnaelLogin.data?.token;

  const natnaelEligibility = await request('/students/stream-eligibility?targetGradeLevel=11&streamCode=NATURAL', {
    headers: { Authorization: `Bearer ${natnaelToken}` },
  });
  assert(
    natnaelEligibility.ok && natnaelEligibility.data.data.eligible === true,
    'High Science Student qualifies for Natural Stream',
    `GPA: ${natnaelEligibility.data.data.studentGpa}% - ${natnaelEligibility.data.data.message}`
  );

  // Login as Bethlehem Girma (Low Science in Grade 10)
  const bethLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student.g10.social@highschool.edu', password: 'Student@123' }),
  });
  const bethToken = bethLogin.data?.token;

  const bethNatEligibility = await request('/students/stream-eligibility?targetGradeLevel=11&streamCode=NATURAL', {
    headers: { Authorization: `Bearer ${bethToken}` },
  });
  assert(
    bethNatEligibility.ok && bethNatEligibility.data.data.eligible === false,
    'Low Science Student rejected for Natural Stream with detailed reasons',
    `Reasons count: ${bethNatEligibility.data.data.reasons?.length}`
  );

  const bethSocEligibility = await request('/students/stream-eligibility?targetGradeLevel=11&streamCode=SOCIAL', {
    headers: { Authorization: `Bearer ${bethToken}` },
  });
  assert(
    bethSocEligibility.ok && bethSocEligibility.data.data.eligible === true,
    'Social Science Student qualifies for Social Stream',
    `GPA: ${bethSocEligibility.data.data.studentGpa}% - ${bethSocEligibility.data.data.message}`
  );

  // ---------------------------------------------------------------
  // 6. SECTION CAPACITY & RACE CONDITION PROTECTION (RULES B & C)
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Section Capacity & Admin "Create Other Section" ---');
  // Fetch available sections
  const secList = await request('/academic/sections?gradeLevel=9');
  const sectionsArray = secList.data?.data || secList.data || [];
  assert(secList.ok && sectionsArray.length > 0, 'Query Grade 9 Sections with Live Capacities', `Found ${sectionsArray.length} sections`);

  // Admin creates Section E ("Create Other Section")
  const secName = `E-${Date.now().toString().slice(-4)}`;
  const createSecE = await request('/admin/sections', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      gradeLevel: 9,
      streamId: 1, // General
      sectionName: secName,
      capacity: 50,
    }),
  });
  assert(createSecE.status === 201, `Admin "+ Create Other Section" (Section ${secName})`, createSecE.data?.message);

  // Student immediately sees newly created Section E
  const secListAfter = await request('/students/available-sections?gradeLevel=9', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const afterArray = secListAfter.data?.data || secListAfter.data || [];
  const foundE = afterArray.find((s) => s.section_name === secName);
  assert(foundE && foundE.capacity === 50, `Newly Created Section ${secName} is instantly visible to students`, `Section ${secName} Capacity: ${foundE?.capacity}`);

  // Test full section capacity rejection
  // Create a temporary section with capacity 1 and fill it
  const tinySecName = `T-${Date.now().toString().slice(-4)}`;
  const createTinySec = await request('/admin/sections', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      gradeLevel: 9,
      streamId: 1,
      sectionName: tinySecName,
      capacity: 1,
    }),
  });
  const tinySecId = createTinySec.data?.data?.id;

  // Enroll newly registered student into tiny section
  const meronLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testStudentEmail, password: 'Student@123' }),
  });
  const meronToken = meronLogin.data?.token;

  const meronEnroll = await request('/students/enroll', {
    method: 'POST',
    headers: { Authorization: `Bearer ${meronToken}` },
    body: JSON.stringify({
      sectionId: tinySecId,
      targetGradeLevel: 9,
      targetStreamId: 1,
    }),
  });
  assert(meronEnroll.ok, 'Student 1 fills tiny section (1/1)', meronEnroll.data?.message);

  // Register another student and attempt to enroll in the full section
  // Add a prerequisite for student 5
  const fullTestStuId = `STU-FULL-${Date.now().toString().slice(-5)}`;
  const fullTestEmail = `student.${fullTestStuId.toLowerCase()}@test.com`;
  await query(
    `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
     VALUES ($1, 'Kaleb Haile', 'St. Joseph', 2026, 600, 85.0, 'PASSED', TRUE)
     ON CONFLICT DO NOTHING`,
    [fullTestStuId]
  );
  await request('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Kaleb',
      lastName: 'Haile',
      email: fullTestEmail,
      password: 'Student@123',
      studentId: fullTestStuId,
      grade8Document: sampleDocData,
      documentName: 'Kaleb_Grade8_Cert.pdf',
    }),
  });

  // Admin approves Kaleb's document so he reaches the section capacity check
  await request(`/admin/documents/${fullTestStuId}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'APPROVE', notes: 'Pre-approved for test' }),
  });

  const kalebLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: fullTestEmail, password: 'Student@123' }),
  });
  const kalebToken = kalebLogin.data?.token;

  const kalebEnrollAttempt = await request('/students/enroll', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kalebToken}` },
    body: JSON.stringify({
      sectionId: tinySecId,
      targetGradeLevel: 9,
      targetStreamId: 1,
    }),
  });
  assert(
    kalebEnrollAttempt.status === 400 && kalebEnrollAttempt.data.message.includes('is full. Please select another section'),
    'Full Section Capacity strictly blocks enrollment (50/50 rule)',
    kalebEnrollAttempt.data?.message
  );

  // ---------------------------------------------------------------
  // 7. LINEAR GRADE PROGRESSION (RULE D)
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Linear Progression & Grade Jumping Prevention ---');
  const gradeJumpAttempt = await request('/students/enroll', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` }, // Student currently in Grade 9
    body: JSON.stringify({
      sectionId: 7, // Grade 11 Section
      targetGradeLevel: 11, // Skipping Grade 10!
      targetStreamId: 2,
    }),
  });
  assert(
    gradeJumpAttempt.status === 400 && gradeJumpAttempt.data.message.includes('Grade jumping is strictly prohibited'),
    'Grade jumping from Grade 9 to Grade 11 strictly blocked',
    gradeJumpAttempt.data?.message
  );

  // ---------------------------------------------------------------
  // 8. GROUP ASSIGNMENTS & AUTOMATIC SCORE PROPAGATION (RULE F)
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Group Assignment & Automatic Score Propagation ---');
  const groupScoreSubmission = await request('/teachers/assignments/groups/score', {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      groupCode: 'GROUP-MATH9-A-001',
      groupScore: 19.5, // 19.5 out of 20
    }),
  });
  assert(
    groupScoreSubmission.ok && groupScoreSubmission.data.updatedMembersCount > 0,
    'Teacher submits Group Score (19.5/20) for GROUP-MATH9-A-001',
    groupScoreSubmission.data?.message
  );

  // Verify that Dawit Bekele's grade report automatically received the 19.5 assignment score
  const studentResults = await request('/students/results', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const mathGrade = studentResults.data?.data?.grades?.find((g) => g.subject_code === 'MATH-9');
  assert(
    mathGrade && parseFloat(mathGrade.assignment_score) === 19.5,
    'Group Score automatically propagated to student report card',
    `Subject: ${mathGrade?.subject_name}, Assignment Score: ${mathGrade?.assignment_score}, Total: ${mathGrade?.total_score}, Letter: ${mathGrade?.letter_grade}`
  );

  // ---------------------------------------------------------------
  // 9. REPORTS & CSV EXPORT
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Reporting & CSV Exports ---');
  const capReport = await request('/reports/capacity', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const capData = capReport.data?.data || capReport.data || [];
  assert(capReport.ok && capData.length > 0, 'Section Capacity Analytics Report', `Sections tracked: ${capData.length}`);

  const capCsv = await request('/reports/capacity/csv', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(capCsv.ok && capCsv.raw.includes('Grade,Section,Stream,Capacity'), 'Downloadable Section Capacity CSV Export', 'Headers verified');

  const promoCsv = await request('/reports/promotion/csv', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(promoCsv.ok && promoCsv.raw.includes('Student ID,First Name,Last Name'), 'Downloadable Student Promotion CSV Export', 'Headers verified');

  // ---------------------------------------------------------------
  // 10. COMMUNICATIONS & AUDIT LOGS
  // ---------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Communications & Audit Logs ---');
  const newAnnouncement = await request('/communications/announcements', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: 'Midterm Exam Schedule Announced',
      content: 'Exams begin next Monday at 08:30 AM.',
      targetAudience: 'ALL',
    }),
  });
  assert(newAnnouncement.ok, 'Admin creates broadcast announcement', newAnnouncement.data?.message);

  const studentAnnouncements = await request('/communications/announcements', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const annList = studentAnnouncements.data?.data || studentAnnouncements.data || [];
  const foundAnnouncement = annList.find((a) => a.title === 'Midterm Exam Schedule Announced');
  assert(!!foundAnnouncement, 'Student successfully receives broadcast announcement');

  const auditLogs = await request('/audit', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(auditLogs.ok && auditLogs.data.data.length > 0, 'Admin queries Chronological Audit Trail', `Total audit entries: ${auditLogs.data?.totalCount}`);

  // ---------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log('VERIFICATION SUITE COMPLETE');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('====================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
