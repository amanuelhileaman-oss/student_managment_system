const BASE_URL = 'http://localhost:5000/api';

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with ${res.status}`);
  }
  return data;
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with ${res.status}`);
  }
  return data;
}

async function testSemesterGroupCodes() {
  console.log('--- Testing Semester Group Code Differentiation ---');

  // Teacher login
  const teacherLogin = await post('/auth/login', {
    email: 'adu@gmail.com',
    password: 'Teacher@123',
  });
  const tToken = teacherLogin.data ? teacherLogin.data.token : teacherLogin.token;

  // Student login
  const studentLogin = await post('/auth/login', {
    email: 'adino@gmail.com',
    password: 'Student@123',
  });
  const sToken = studentLogin.data ? studentLogin.data.token : studentLogin.token;

  // 1. Fetch teacher classes
  const taRes = await get('/teachers/classes', tToken);
  const classesList = taRes.data || taRes;
  console.log('Classes list item 0:', JSON.stringify(classesList[0]));
  const myClass = classesList[0];
  const teacherAssignmentId = myClass.assignment_id;
  console.log(`Teacher assigned class ID: ${teacherAssignmentId}, Section: ${myClass.section_name}, Subject: ${myClass.code || myClass.subject_code}`);

  // 2. Create Semester 1 Assignment
  const sem1AssignRes = await post('/teachers/assignments', {
    teacherAssignmentId: teacherAssignmentId,
    title: `Semester 1 Science Project ${Date.now()}`,
    assignmentType: 'GROUP',
    maxScore: 20,
    dueDate: '2026-11-30',
    semester: 1,
    instructions: 'Collaborate in teams for Semester 1',
  }, tToken);
  const sem1Assign = sem1AssignRes.data || sem1AssignRes;
  const sem1AssignId = sem1Assign.id;
  console.log(`Created Semester 1 Assignment ID: ${sem1AssignId}, Semester: ${sem1Assign.semester}`);

  // 3. Create Group for Semester 1 Assignment
  const sem1GroupRes = await post('/teachers/assignments/groups', {
    assignmentId: sem1AssignId,
    groupName: 'Quantum Pioneers S1',
    studentIds: [],
  }, tToken);
  const sem1Group = sem1GroupRes.data || sem1GroupRes;
  const sem1GroupCode = sem1Group.group_code;
  console.log(`Generated Semester 1 Group Code: ${sem1GroupCode}`);
  if (!sem1GroupCode.includes('GROUP-S1-')) {
    throw new Error(`Expected Semester 1 group code to contain 'GROUP-S1-', got: ${sem1GroupCode}`);
  }
  console.log('✅ Semester 1 Group Code Format Validated:', sem1GroupCode);

  // 4. Create Semester 2 Assignment
  const sem2AssignRes = await post('/teachers/assignments', {
    teacherAssignmentId: teacherAssignmentId,
    title: `Semester 2 Robotics Project ${Date.now()}`,
    assignmentType: 'GROUP',
    maxScore: 20,
    dueDate: '2027-05-30',
    semester: 2,
    instructions: 'Collaborate in teams for Semester 2',
  }, tToken);
  const sem2Assign = sem2AssignRes.data || sem2AssignRes;
  const sem2AssignId = sem2Assign.id;
  console.log(`Created Semester 2 Assignment ID: ${sem2AssignId}, Semester: ${sem2Assign.semester}`);

  // 5. Create Group for Semester 2 Assignment
  const sem2GroupRes = await post('/teachers/assignments/groups', {
    assignmentId: sem2AssignId,
    groupName: 'Apex Robotics S2',
    studentIds: [],
  }, tToken);
  const sem2Group = sem2GroupRes.data || sem2GroupRes;
  const sem2GroupCode = sem2Group.group_code;
  console.log(`Generated Semester 2 Group Code: ${sem2GroupCode}`);
  if (!sem2GroupCode.includes('GROUP-S2-')) {
    throw new Error(`Expected Semester 2 group code to contain 'GROUP-S2-', got: ${sem2GroupCode}`);
  }
  console.log('✅ Semester 2 Group Code Format Validated:', sem2GroupCode);

  // 6. Test Student Fallback Group Codes
  const sSubmitRes1 = await post('/students/assignments/submit', {
    assignmentId: sem1AssignId,
    submissionContent: 'Here is our Semester 1 draft submission',
  }, sToken);
  const studentS1Code = (sSubmitRes1.data || sSubmitRes1)?.group_code;
  console.log(`Student S1 Fallback Code: ${studentS1Code}`);
  if (!studentS1Code.includes('-S1-')) {
    throw new Error(`Expected student fallback code to contain '-S1-', got: ${studentS1Code}`);
  }
  console.log('✅ Student S1 Group Code Format Validated:', studentS1Code);

  const sSubmitRes2 = await post('/students/assignments/submit', {
    assignmentId: sem2AssignId,
    submissionContent: 'Here is our Semester 2 final project',
  }, sToken);
  const studentS2Code = (sSubmitRes2.data || sSubmitRes2)?.group_code;
  console.log(`Student S2 Fallback Code: ${studentS2Code}`);
  if (!studentS2Code.includes('-S2-')) {
    throw new Error(`Expected student fallback code to contain '-S2-', got: ${studentS2Code}`);
  }
  console.log('✅ Student S2 Group Code Format Validated:', studentS2Code);

  // 7. Verify Grade Record score propagation for both semesters
  console.log('\n--- Testing Independent Semester Score Propagation ---');
  // Score Sem 1 group
  const scoreSem1Res = await post('/teachers/assignments/groups/score', {
    groupCode: studentS1Code,
    groupScore: 19,
  }, tToken);
  console.log('Sem 1 Propagation Result:', scoreSem1Res.message);

  // Score Sem 2 group
  const scoreSem2Res = await post('/teachers/assignments/groups/score', {
    groupCode: studentS2Code,
    groupScore: 17.5,
  }, tToken);
  console.log('Sem 2 Propagation Result:', scoreSem2Res.message);

  // 8. Fetch student results to verify both semester records
  const resultsRes = await get('/students/results', sToken);
  const myResults = resultsRes.data || resultsRes;
  const mathGrade = myResults.grades?.find(g => (g.subject_code || '').includes('MAT'));
  console.log(`Semester 1 Math Assignment Score: ${mathGrade?.sem1?.assignment_score}`);
  console.log(`Semester 2 Math Assignment Score: ${mathGrade?.sem2?.assignment_score}`);
  if (parseFloat(mathGrade?.sem1?.assignment_score) !== 19) {
    throw new Error(`Expected Sem 1 assignment score 19, got ${mathGrade?.sem1?.assignment_score}`);
  }
  if (parseFloat(mathGrade?.sem2?.assignment_score) !== 17.5) {
    throw new Error(`Expected Sem 2 assignment score 17.5, got ${mathGrade?.sem2?.assignment_score}`);
  }
  console.log('✅ Verified discrete semester assignment scores in student grade records!');

  console.log('\n🎉 ALL SEMESTER GROUP CODE AND MULTI-SEMESTER PROPAGATION CHECKS PASSED WITH 100% SUCCESS!');
}

testSemesterGroupCodes().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
