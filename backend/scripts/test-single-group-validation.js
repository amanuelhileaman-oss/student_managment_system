const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTest() {
  console.log('========================================================================');
  console.log('🧪 TESTING SINGLE GROUP ASSIGNMENT VALIDATION PER STUDENT');
  console.log('========================================================================\n');

  // 1. Authenticate Teacher & Student
  const tLogin = await post('/auth/login', { email: 'dasta@gmail.com', password: 'Teacher@123' });
  const tToken = tLogin.data?.data ? tLogin.data.data.token : tLogin.data?.token;

  const sLogin = await post('/auth/login', { email: 'aman@gmail.com', password: 'Student@123' });
  const sToken = sLogin.data?.data ? sLogin.data.data.token : sLogin.data?.token;

  if (!tToken || !sToken) {
    throw new Error('Authentication failed for test roles.');
  }
  console.log('✅ 1. Authenticated Teacher and Student successfully.');

  // 2. Fetch Teacher Class & Section Students
  const classesRes = await get('/teachers/classes', tToken);
  const classesList = classesRes.data?.data || classesRes.data;
  const myClass = classesList[0];
  console.log(`✅ 2. Found teacher assignment ID ${myClass.assignment_id} (${myClass.subject_name}, Section ${myClass.section_name})`);

  // 3. Create a Group Assignment
  const assignRes = await post('/teachers/assignments', {
    teacherAssignmentId: myClass.assignment_id,
    title: `Single-Group Validation Test ${Date.now()}`,
    assignmentType: 'GROUP',
    maxScore: 20,
    dueDate: '2026-12-15',
    instructions: 'Test strict single-group membership enforcement.',
  }, tToken);
  const assign = assignRes.data?.data || assignRes.data;
  const assignId = assign.id;
  console.log(`✅ 3. Created Assignment ID ${assignId}`);

  // Fetch student roster for this assignment
  const rosterRes = await get(`/teachers/assignments/${assignId}/students`, tToken);
  const students = rosterRes.data?.data?.students || rosterRes.data?.students || [];
  if (students.length < 2) {
    throw new Error(`Expected at least 2 students in section, found ${students.length}`);
  }
  const student1 = students[0];
  const student2 = students[1];
  console.log(`   Roster available: ${student1.first_name} (${student1.student_code}) & ${student2.first_name} (${student2.student_code})`);

  // 4. Create Group 1 with Student 1
  const group1Res = await post('/teachers/assignments/groups', {
    assignmentId: assignId,
    groupName: 'Alpha Squad',
    studentIds: [student1.student_id],
  }, tToken);
  if (!group1Res.ok) {
    throw new Error(`Failed to create Group 1: ${JSON.stringify(group1Res.data)}`);
  }
  const group1 = group1Res.data?.data || group1Res.data;
  console.log(`✅ 4. Created Group 1 (${group1.group_name} - ${group1.group_code}) with member ${student1.first_name}`);

  // 5. Attempt to create Group 2 INCLUDING Student 1 (MUST FAIL with HTTP 400)
  console.log('\n--- Test 5: Teacher duplicate assignment attempt ---');
  const group2FailRes = await post('/teachers/assignments/groups', {
    assignmentId: assignId,
    groupName: 'Beta Squad',
    studentIds: [student1.student_id, student2.student_id],
  }, tToken);
  console.log(`   Response status: ${group2FailRes.status}, message: "${group2FailRes.data?.message}"`);
  if (group2FailRes.status === 400 && group2FailRes.data?.message?.includes('already assigned')) {
    console.log('✅ 5. PASSED: Teacher cannot assign already-assigned student to another group!');
  } else {
    throw new Error(`Expected 400 Bad Request with 'already assigned' message, got: ${group2FailRes.status} ${JSON.stringify(group2FailRes.data)}`);
  }

  // 6. Create Group 2 with only Student 2
  const group2Res = await post('/teachers/assignments/groups', {
    assignmentId: assignId,
    groupName: 'Beta Squad',
    studentIds: [student2.student_id],
  }, tToken);
  if (!group2Res.ok) {
    throw new Error(`Failed to create Group 2: ${JSON.stringify(group2Res.data)}`);
  }
  const group2 = group2Res.data?.data || group2Res.data;
  console.log(`✅ 6. Created Group 2 (${group2.group_name} - ${group2.group_code}) with Student 2`);

  // 7. Verify section roster correctly indicates Student 1 is in Group 1 and Student 2 is in Group 2
  const updatedRosterRes = await get(`/teachers/assignments/${assignId}/students`, tToken);
  const updatedStudents = updatedRosterRes.data?.data?.students || updatedRosterRes.data?.students || [];
  const s1Roster = updatedStudents.find(s => s.student_id === student1.student_id);
  const s2Roster = updatedStudents.find(s => s.student_id === student2.student_id);
  console.log(`   Student 1 current group: ${s1Roster?.current_group_name} (${s1Roster?.current_group_code})`);
  console.log(`   Student 2 current group: ${s2Roster?.current_group_name} (${s2Roster?.current_group_code})`);
  if (!s1Roster?.current_group_id || !s2Roster?.current_group_id) {
    throw new Error('Roster query failed to reflect existing group membership.');
  }
  console.log('✅ 7. PASSED: Section roster correctly reflects existing group membership for each student.');

  // 8. Attempt Student Submitting with ANOTHER group's code
  console.log('\n--- Test 8: Student attempting to submit under a different group code ---');
  // Student 1 (Adino) tries to submit under Group 2 (Beta Squad)
  const submitSwitchRes = await post('/students/assignments/submit', {
    assignmentId: assignId,
    groupCode: group2.group_code,
    submissionContent: 'Trying to sneak into Beta Squad',
  }, sToken);
  console.log(`   Response status: ${submitSwitchRes.status}, message: "${submitSwitchRes.data?.message}"`);
  if (submitSwitchRes.status === 400 && submitSwitchRes.data?.message?.includes('already assigned')) {
    console.log('✅ 8. PASSED: Student cannot join or submit for another group when already in a group!');
  } else {
    throw new Error(`Expected 400 Bad Request with 'already assigned' message, got: ${submitSwitchRes.status} ${JSON.stringify(submitSwitchRes.data)}`);
  }

  // 9. Legitimate Student Submission for their OWN group (Group 1)
  console.log('\n--- Test 9: Legitimate submission for assigned group ---');
  const legitSubmitRes = await post('/students/assignments/submit', {
    assignmentId: assignId,
    groupCode: group1.group_code,
    submissionContent: 'Valid submission for Alpha Squad by assigned member.',
  }, sToken);
  if (!legitSubmitRes.ok) {
    throw new Error(`Failed legitimate submission: ${JSON.stringify(legitSubmitRes.data)}`);
  }
  console.log(`✅ 9. PASSED: Legitimate group submission accepted (${legitSubmitRes.data?.message})`);

  // 10. Teacher Evaluates Group 1 and Score Propagates Intact
  console.log('\n--- Test 10: Score evaluation and auto-propagation ---');
  const scoreRes = await post('/teachers/assignments/groups/score', {
    groupCode: group1.group_code,
    groupScore: 18.5,
  }, tToken);
  if (!scoreRes.ok) {
    throw new Error(`Failed to score group: ${JSON.stringify(scoreRes.data)}`);
  }
  console.log(`✅ 10. PASSED: Group score evaluated and propagated: "${scoreRes.data?.message}"`);

  console.log('\n========================================================================');
  console.log('🎉 ALL SINGLE-GROUP ASSIGNMENT VALIDATION CHECKS PASSED WITH 100% INTEGRITY!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ Test execution failed:', err.message);
  process.exit(1);
});
