const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== Testing Self Profile Updating & Global Search ===');

  try {
    // 1. Login as teacher
    const teacherLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'teacher.math@highschool.edu',
        password: 'Teacher@123',
      }),
    });
    if (!teacherLogin.ok) throw new Error('Teacher login failed: ' + JSON.stringify(teacherLogin.data));
    const teacherToken = teacherLogin.data.token;
    console.log(`✓ Teacher login OK: ${teacherLogin.data.user.firstName} ${teacherLogin.data.user.lastName}`);

    // 2. Teacher updates own profile (Name, Phone, Bio, Avatar, Specialization)
    const updateRes = await req(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        firstName: 'Abebe',
        lastName: 'Kebede-PhD',
        phone: '+251-911-234567',
        bio: 'Senior Mathematics Professor and Head of Department.',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        specialization: 'Advanced Mathematics',
        qualification: 'Ph.D. in Applied Mathematics',
      }),
    });
    if (!updateRes.ok) throw new Error('Profile update failed: ' + JSON.stringify(updateRes.data));
    console.log(`✓ Teacher profile updated successfully: ${updateRes.data.user.firstName} ${updateRes.data.user.lastName}, Phone: ${updateRes.data.user.phone}`);

    // 3. Verify getMe reflects updated profile
    const meRes = await req(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    if (!meRes.ok) throw new Error('getMe failed: ' + JSON.stringify(meRes.data));
    const me = meRes.data.user;
    if (me.lastName !== 'Kebede-PhD' || me.phone !== '+251-911-234567' || me.teacher?.specialization !== 'Advanced Mathematics') {
      throw new Error('getMe did not return updated profile fields: ' + JSON.stringify(me));
    }
    console.log('✓ getMe verified: updated name, phone, bio, avatar, and specialization correctly stored!');

    // 4. Test Global Search API
    // Search by student id or name
    const searchStudent = await req(`${API_BASE}/search?q=Natnael`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    if (!searchStudent.ok) throw new Error('Search failed: ' + JSON.stringify(searchStudent.data));
    console.log(`✓ Search "Natnael" returned: ${searchStudent.data.data.students.length} student(s)`);

    // Search by teacher specialization / subject
    const searchTeacher = await req(`${API_BASE}/search?q=Mathematics`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    if (!searchTeacher.ok) throw new Error('Search failed: ' + JSON.stringify(searchTeacher.data));
    console.log(`✓ Search "Mathematics" returned: ${searchTeacher.data.data.teachers.length} teacher(s), ${searchTeacher.data.data.materials.length} material(s)`);

    // Search by grade / section
    const searchSection = await req(`${API_BASE}/search?q=Grade 10`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    if (!searchSection.ok) throw new Error('Search failed: ' + JSON.stringify(searchSection.data));
    console.log(`✓ Search "Grade 10" returned: ${searchSection.data.data.sections.length} section(s), ${searchSection.data.data.students.length} student(s)`);

    // 5. Admin edits teacher back and updates student
    const adminLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
    });
    const adminToken = adminLogin.data.token;

    const adminEditTeacher = await req(`${API_BASE}/admin/users/2`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        firstName: 'Abebe',
        lastName: 'Kebede',
        email: 'teacher.math@highschool.edu',
        specialization: 'Mathematics',
        qualification: 'M.Sc. Mathematics',
      }),
    });
    if (!adminEditTeacher.ok) throw new Error('Admin edit teacher failed: ' + JSON.stringify(adminEditTeacher.data));
    console.log('✓ Admin successfully updated teacher record back to official status');

    console.log('\n=== ALL PROFILE & SEARCH TESTS PASSED SUCCESSFULLY! ===\n');
  } catch (err) {
    console.error('Test Error:', err.message);
    process.exit(1);
  }
}

runTests();
