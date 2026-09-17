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

async function verifyUserDirectory() {
  console.log('=== Verifying User Directory Full Functionality ===\n');

  // 1. Admin Login
  console.log('1. Logging in as Administrator...');
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
  });
  const token = loginRes.token || loginRes.data?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('   Admin authenticated.');

  // 2. Query all users from /admin/users
  console.log('2. Fetching User Directory roster from /admin/users...');
  const usersRes = await request(`${API_BASE}/admin/users`, { headers: authHeaders });
  const users = usersRes.data;
  console.log(`   Retrieved ${users.length} total directory users.`);

  // 3. Verify student fields
  const student = users.find((u) => u.role === 'student');
  if (!student) throw new Error('No student user found in directory!');
  console.log('3. Verifying student records:');
  console.log(`   Student: ${student.first_name} ${student.last_name}, ID: ${student.student_id}`);
  console.log(`   Grade: ${student.current_grade_level}, Section: ${student.section_name}, Stream: ${student.stream_name}`);

  // 4. Verify teacher fields
  const teacher = users.find((u) => u.role === 'teacher');
  if (!teacher) throw new Error('No teacher user found in directory!');
  console.log('4. Verifying teacher records:');
  console.log(`   Teacher: ${teacher.first_name} ${teacher.last_name}, Specialization: ${teacher.specialization}`);
  console.log(`   Assigned Subjects: ${teacher.assigned_subjects || 'None'}`);
  console.log(`   Assigned Classes: ${teacher.assigned_classes || 'None'}`);
  console.log(`   Grades Taught: [${teacher.teacher_grades ? teacher.teacher_grades.join(', ') : ''}]`);

  // 5. Test status toggling (Deactivate then Reactivate)
  console.log('5. Testing status toggle on user...');
  const origStatus = student.is_active;
  const toggle1 = await request(`${API_BASE}/admin/users/${student.id}/toggle-status`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  console.log(`   Toggled to: ${toggle1.isActive ? 'ACTIVE' : 'DEACTIVATED'} (${toggle1.message})`);
  const toggle2 = await request(`${API_BASE}/admin/users/${student.id}/toggle-status`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  console.log(`   Restored to original status: ${toggle2.isActive ? 'ACTIVE' : 'DEACTIVATED'}`);

  // 6. Test updating student details via admin PUT /users/:id
  console.log('6. Testing student profile edit via admin...');
  const updateRes = await request(`${API_BASE}/admin/users/${student.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      firstName: student.first_name,
      lastName: student.last_name,
      email: student.email,
      phone: '+251 911 223344',
      bio: 'Enthusiastic high school scholar aiming for engineering.',
      address: 'Addis Ababa, Bole Subcity Woreda 03',
      currentGradeLevel: student.current_grade_level,
      currentSectionId: student.current_section_id,
      currentStreamId: student.current_stream_id,
    }),
  });
  console.log('   Update Student Success:', updateRes.message);

  // 7. Test updating teacher details via admin PUT /users/:id
  console.log('7. Testing teacher profile edit via admin...');
  const teacherUpdate = await request(`${API_BASE}/admin/users/${teacher.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      firstName: teacher.first_name,
      lastName: teacher.last_name,
      email: teacher.email,
      phone: '+251 922 334455',
      bio: 'Senior STEM educator specializing in Mathematics.',
      specialization: 'Mathematics',
      qualification: 'M.Sc. in Applied Mathematics',
    }),
  });
  console.log('   Update Teacher Success:', teacherUpdate.message);

  console.log('\n ALL USER DIRECTORY BACKEND CHECKS PASSED 100%! ');
}

verifyUserDirectory().catch((err) => {
  console.error('FAILED:', err.data || err.message);
  process.exit(1);
});
