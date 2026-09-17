const API_BASE = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function verifyFullFlow() {
  console.log('=== Verifying Full Add Other Subject Workflow ===\n');

  // 1. Admin login
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
  });
  const token = loginRes.token || loginRes.data?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('1. Admin logged in successfully.');

  // 2. Clean up if previously created
  const allSubs = await request(`${API_BASE}/academic/subjects`);
  const existing = allSubs.data.find((s) => s.code === 'CIV-10-ETH');
  if (existing) {
    await request(`${API_BASE}/admin/subjects/${existing.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    console.log('   (Cleaned up previous CIV-10-ETH subject)');
  }

  // 3. Admin clicks "Add Other Subject" -> creates subject
  console.log('2. Admin creates "Civics & Ethical Education" (CIV-10-ETH)...');
  const createRes = await request(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Civics & Ethical Education',
      code: 'CIV-10-ETH',
      gradeLevel: 10,
      streamId: 1, // General stream
      creditHours: 3,
    }),
  });
  console.log('   Subject created:', createRes.data.name, `[${createRes.data.code}]`);
  const subjectId = createRes.data.id;

  // 4. Verify in curriculum subjects list
  console.log('3. Verifying subject presence in /academic/subjects query...');
  const verifyList = await request(`${API_BASE}/academic/subjects?gradeLevel=10`);
  const matched = verifyList.data.find((s) => s.id === subjectId);
  if (!matched) throw new Error('Subject not found in subjects list!');
  console.log(`   Found in curriculum: ${matched.name}, code: ${matched.code}, stream: ${matched.stream_name}, credits: ${matched.credit_hours}`);

  // 5. Verify teacher assignment with this new subject
  console.log('4. Assigning teacher to the new subject...');
  const teachers = await request(`${API_BASE}/admin/users?role=teacher`, { headers: authHeaders });
  const sections = await request(`${API_BASE}/academic/sections?gradeLevel=10`);
  const teacherId = teachers.data[0].teacher_record_id || teachers.data[0].id;
  const sectionId = sections.data[0].id;

  const assignRes = await request(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      teacherId,
      subjectId,
      sectionId,
    }),
  });
  console.log('   Teacher successfully assigned:', assignRes.message);
  const assignmentId = assignRes.data.id;

  // 6. Verify teacher assignment appears in assignments query with the new subject details
  console.log('5. Verifying teacher assignment details...');
  const assignmentsList = await request(`${API_BASE}/admin/teacher-assignments`, { headers: authHeaders });
  const matchedAssignment = assignmentsList.data.find((a) => a.id === assignmentId);
  if (!matchedAssignment) throw new Error('Assignment not found!');
  console.log(`   Assignment verified: Teacher ${matchedAssignment.first_name} ${matchedAssignment.last_name} -> Subject "${matchedAssignment.subject_name}" (${matchedAssignment.subject_code}) in Section ${matchedAssignment.section_name}`);

  // 7. Clean up assignment and subject
  console.log('6. Cleaning up test assignment and subject...');
  await request(`${API_BASE}/admin/teacher-assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  await request(`${API_BASE}/admin/subjects/${subjectId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  console.log('   Cleanup completed cleanly.');

  console.log('\n SUCCESS: All role relationships and subject operations verified 100%!');
}

verifyFullFlow().catch((err) => {
  console.error('FAILED:', err.data || err.message);
  process.exit(1);
});
