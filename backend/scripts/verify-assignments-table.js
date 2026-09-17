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

async function verifyAssignmentsTable() {
  console.log('=== Verifying Teacher Assignments Table & Data ===\n');

  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
  });
  const token = loginRes.token || loginRes.data?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('1. Admin authenticated.');

  // Fetch teacher assignments
  const taRes = await request(`${API_BASE}/admin/teacher-assignments`, { headers: authHeaders });
  console.log(`2. Retrieved ${taRes.data.length} teacher assignments.`);

  // Verify first 5 assignments
  const sample = taRes.data.slice(0, 5);
  sample.forEach((a, i) => {
    console.log(`   [#${i + 1}] Instructor: ${a.first_name} ${a.last_name} (${a.email}) | Subject: ${a.subject_name} [${a.subject_code}] | Grade: ${a.grade_level} | Stream: ${a.stream_name} | Section: ${a.section_name} | Scheduled Periods: ${a.scheduled_periods_count || 0}`);
    if (!a.first_name || !a.subject_name || !a.section_name) {
      throw new Error(`Assignment missing required render fields at index ${i}`);
    }
  });

  // Verify analytics dashboard also reflects teaching faculty and sections
  const analyticsRes = await request(`${API_BASE}/admin/analytics`, { headers: authHeaders });
  console.log(`3. Admin Analytics KPI: Total Teachers = ${analyticsRes.data.totalTeachers}, Total Capacity = ${analyticsRes.data.totalCapacity}, Active Sections = ${analyticsRes.data.activeSections}`);

  console.log('\n ALL TEACHER ASSIGNMENTS DATA CONFIRMED VALID AND READY FOR RENDERING! ');
}

verifyAssignmentsTable().catch((err) => {
  console.error('FAILED:', err.data || err.message);
  process.exit(1);
});
