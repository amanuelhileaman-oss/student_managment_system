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
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function testSubjectManagement() {
  console.log('--- Starting Admin Subject Creation & Management Tests ---');

  // 1. Admin Login
  console.log('\n1. Logging in as Administrator...');
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'aman12@gmail.com',
      password: 'aman1221',
    }),
  });
  const token = loginRes.token || loginRes.data?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(' Admin authenticated successfully.');

  // Pre-cleanup any previous test subjects
  const preCheck = await request(`${API_BASE}/academic/subjects`);
  const leftover = preCheck.data.filter((s) => ['IT-10', 'ICT-10'].includes(s.code));
  for (const s of leftover) {
    try {
      await request(`${API_BASE}/admin/subjects/${s.id}`, { method: 'DELETE', headers: authHeaders });
    } catch (e) {}
  }

  // 2. Fetch existing subjects
  console.log('\n2. Fetching existing subjects list...');
  const subRes = await request(`${API_BASE}/academic/subjects`);
  console.log(` Retrieved ${subRes.data.length} current subjects.`);

  // 3. Create a new custom subject: "Information Technology" (IT-10) for Grade 10
  console.log('\n3. Admin creates new subject: "Information Technology" (IT-10)...');
  const createRes = await request(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Information Technology',
      code: 'IT-10',
      gradeLevel: 10,
      streamId: 1, // General stream
      creditHours: 3,
    }),
  });
  console.log(' Create Subject Success:', createRes.message);
  const createdSub = createRes.data;
  console.log(`   ID: ${createdSub.id}, Code: ${createdSub.code}, Name: ${createdSub.name}, Stream: ${createdSub.stream_name}`);

  // 4. Test duplicate code rejection
  console.log('\n4. Testing duplicate subject code rejection (IT-10)...');
  try {
    await request(`${API_BASE}/admin/subjects`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Another IT Course',
        code: 'it-10', // case-insensitive check
        gradeLevel: 10,
        streamId: 1,
      }),
    });
    throw new Error('FAILED: Duplicate code was allowed!');
  } catch (err) {
    if (err.status === 400) {
      console.log(' Duplicate code properly blocked:', err.data?.message || err.message);
    } else {
      throw err;
    }
  }

  // 5. Test invalid grade rejection (e.g. Grade 8)
  console.log('\n5. Testing invalid grade level rejection (Grade 8)...');
  try {
    await request(`${API_BASE}/admin/subjects`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Middle School Math',
        code: 'MATH-8',
        gradeLevel: 8,
      }),
    });
    throw new Error('FAILED: Invalid grade level 8 was allowed!');
  } catch (err) {
    if (err.status === 400) {
      console.log(' Invalid grade properly blocked:', err.data?.message || err.message);
    } else {
      throw err;
    }
  }

  // 6. Test updating subject
  console.log('\n6. Updating subject details...');
  const updateRes = await request(`${API_BASE}/admin/subjects/${createdSub.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Information & Communication Technology',
      code: 'ICT-10',
      gradeLevel: 10,
      creditHours: 4,
    }),
  });
  console.log(' Update Subject Success:', updateRes.message);
  console.log(`   New Name: ${updateRes.data.name}, New Code: ${updateRes.data.code}, Credits: ${updateRes.data.credit_hours}`);

  // 7. Verify subject is now available in GET /academic/subjects
  console.log('\n7. Verifying subject presence in /academic/subjects query...');
  const verifyList = await request(`${API_BASE}/academic/subjects?gradeLevel=10`);
  const found = verifyList.data.find((s) => s.id === createdSub.id);
  if (!found) {
    throw new Error('FAILED: Newly added subject not found in academic subjects list!');
  }
  console.log(` Found subject in Grade 10 list: ${found.name} (${found.code})`);

  // 8. Test assigning a teacher to this newly created subject
  console.log('\n8. Testing teacher assignment with the new subject...');
  const teachersRes = await request(`${API_BASE}/admin/users?role=teacher`, { headers: authHeaders });
  const sectionsRes = await request(`${API_BASE}/academic/sections?gradeLevel=10`);
  const teacher = teachersRes.data[0];
  const section = sectionsRes.data[0];
  const teacherId = teacher.teacher_record_id || teacher.id;

  const assignRes = await request(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      teacherId,
      subjectId: createdSub.id,
      sectionId: section.id,
    }),
  });
  console.log(' Teacher Assignment Success:', assignRes.message);
  const assignmentId = assignRes.data.id;

  // 9. Verify deletion protection while assigned to a teacher
  console.log('\n9. Testing deletion safety check (should prevent deletion while assigned)...');
  try {
    await request(`${API_BASE}/admin/subjects/${createdSub.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    throw new Error('FAILED: Subject was deleted while assigned to a teacher!');
  } catch (err) {
    if (err.status === 400) {
      console.log(' Deletion safety properly triggered:', err.data?.message || err.message);
    } else {
      throw err;
    }
  }

  // 10. Clean up: Delete assignment, then delete subject
  console.log('\n10. Cleaning up: Removing assignment and deleting test subject...');
  await request(`${API_BASE}/admin/teacher-assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  console.log(' Removed test teacher assignment.');

  const delRes = await request(`${API_BASE}/admin/subjects/${createdSub.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  console.log(' Cleaned up test subject:', delRes.message);

  console.log('\n ALL SUBJECT MANAGEMENT BACKEND TESTS PASSED PERFECTLY! ');
}

testSubjectManagement().catch((err) => {
  console.error('Test failed:', err.data || err.message);
  process.exit(1);
});
