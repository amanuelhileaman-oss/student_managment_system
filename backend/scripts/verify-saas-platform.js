/**
 * Verification Script for Multi-Tenant SaaS Architecture:
 * Tests 1 Global Super Admin + Multiple Isolated High Schools
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

async function runSaaSVerification() {
  console.log('====================================================');
  console.log('VERIFYING MULTI-TENANT SAAS ARCHITECTURE');
  console.log('====================================================\n');

  // 1. Super Admin Authentication
  console.log('--- TEST GROUP 1: Super Admin Authentication ---');
  const superLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'superadmin@ethiohighhub.com', password: 'SuperAdmin@123' }),
  });
  assert(
    superLogin.ok && superLogin.data?.user?.role === 'superadmin',
    'Global Super Admin Login',
    `Role: ${superLogin.data?.user?.role}`
  );
  const superToken = superLogin.data?.token;

  // 2. Super Admin Platform Analytics
  console.log('\n--- TEST GROUP 2: Platform Stats & Overview ---');
  const statsRes = await request('/superadmin/stats', {
    headers: { Authorization: `Bearer ${superToken}` },
  });
  assert(
    statsRes.ok && statsRes.data?.stats?.totalSchools >= 2,
    'Super Admin Platform Stats',
    `Total Schools: ${statsRes.data?.stats?.totalSchools}, Active: ${statsRes.data?.stats?.activeSchools}`
  );

  // 3. School 1 (Bole High School) Isolation
  console.log('\n--- TEST GROUP 3: School 1 (Bole High School) Isolation ---');
  const boleLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aman12@gmail.com', password: 'aman1221' }),
  });
  assert(
    boleLogin.ok && boleLogin.data?.user?.role === 'admin' && boleLogin.data?.user?.school_name === 'Bole High School',
    'Bole School Admin Login & School Context',
    `School: ${boleLogin.data?.user?.school_name}`
  );
  const boleToken = boleLogin.data?.token;

  const boleUsers = await request('/admin/users', {
    headers: { Authorization: `Bearer ${boleToken}` },
  });
  const hasDawitInBole = boleUsers.data?.data?.some((u) => u.email === 'student.g9@highschool.edu');
  const hasMenelikStudentInBole = boleUsers.data?.data?.some((u) => u.email === 'student.g9@menelik.edu');
  assert(
    hasDawitInBole && !hasMenelikStudentInBole,
    'Bole High School User Isolation',
    `Contains Dawit: ${hasDawitInBole}, Leaks Menelik Student: ${hasMenelikStudentInBole}`
  );

  // 4. School 2 (Menelik II High School) Isolation
  console.log('\n--- TEST GROUP 4: School 2 (Menelik II High School) Isolation ---');
  const menelikLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin.menelik@highschool.edu', password: 'Admin@123' }),
  });
  assert(
    menelikLogin.ok && menelikLogin.data?.user?.role === 'admin' && menelikLogin.data?.user?.school_name === 'Menelik II High School',
    'Menelik School Admin Login & School Context',
    `School: ${menelikLogin.data?.user?.school_name}`
  );
  const menelikToken = menelikLogin.data?.token;

  const menelikUsers = await request('/admin/users', {
    headers: { Authorization: `Bearer ${menelikToken}` },
  });
  const hasMenelikStudent = menelikUsers.data?.data?.some((u) => u.email === 'student.g9@menelik.edu');
  const hasDawitInMenelik = menelikUsers.data?.data?.some((u) => u.email === 'student.g9@highschool.edu');
  assert(
    hasMenelikStudent && !hasDawitInMenelik,
    'Menelik High School User Isolation',
    `Contains Menelik Student: ${hasMenelikStudent}, Leaks Dawit from Bole: ${hasDawitInMenelik}`
  );

  // 5. Dynamic Provisioning of New School 3 (Hawassa High)
  console.log('\n--- TEST GROUP 5: Super Admin School Provisioning ---');
  const createSchoolRes = await request('/superadmin/schools', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superToken}` },
    body: JSON.stringify({
      name: 'Hawassa Comprehensive High School',
      code: 'hawassa-high',
      city: 'Hawassa',
      adminEmail: 'admin.hawassa@highschool.edu',
      adminPassword: 'Admin@123',
      adminFirstName: 'Hawassa',
      adminLastName: 'Principal',
    }),
  });
  assert(
    createSchoolRes.ok || createSchoolRes.status === 400, // May exist if rerun
    'Dynamic School Provisioning via Super Admin API',
    createSchoolRes.data?.message || 'Provisioned'
  );

  // Sign in as new Hawassa School Admin
  const hawassaLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin.hawassa@highschool.edu', password: 'Admin@123' }),
  });
  assert(
    hawassaLogin.ok && hawassaLogin.data?.user?.school_name === 'Hawassa Comprehensive High School',
    'New School Admin Login & Automatic Tenant Isolation',
    `School: ${hawassaLogin.data?.user?.school_name}`
  );

  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runSaaSVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
