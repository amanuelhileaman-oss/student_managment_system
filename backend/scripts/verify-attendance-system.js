const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../src/config/db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || `Request failed with status ${res.status}`);
    err.response = { status: res.status, data };
    throw err;
  }
  return { status: res.status, data };
}

async function testAttendanceSystem() {
  console.log('=== Starting Real-World Attendance System Verification ===\n');

  try {
    // 1. Find an active teacher assigned to a section with multiple students
    const tRes = await query(`
      SELECT u.id as user_id, u.email, u.first_name, u.last_name, u.role, t.id as teacher_id, ta.section_id, ta.subject_id,
             s.name as subject_name, sec.section_name, sec.grade_level,
             (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = ta.section_id) as enrolled_count
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      JOIN teacher_assignments ta ON ta.teacher_id = t.id
      JOIN subjects s ON ta.subject_id = s.id
      JOIN sections sec ON ta.section_id = sec.id
      WHERE u.is_active = TRUE AND (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = ta.section_id) >= 5
      LIMIT 1
    `);

    if (tRes.rows.length === 0) {
      throw new Error('No active teacher with assignments found in database.');
    }

    const targetTeacher = tRes.rows[0];
    console.log(`1. Target Teacher: ${targetTeacher.first_name} ${targetTeacher.last_name} (${targetTeacher.email})`);
    console.log(`   Assigned Class: Grade ${targetTeacher.grade_level}-${targetTeacher.section_name} • ${targetTeacher.subject_name}`);

    const teacherToken = jwt.sign(
      { id: targetTeacher.user_id, email: targetTeacher.email, role: targetTeacher.role },
      process.env.JWT_SECRET || 'highschool_secret_key_2026',
      { expiresIn: '1h' }
    );

    // 2. Fetch attendance roster for today
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n2. Fetching attendance roster for ${today}...`);
    const rosterRes = await apiRequest(
      `/teachers/attendance?sectionId=${targetTeacher.section_id}&subjectId=${targetTeacher.subject_id}&date=${today}`,
      'GET',
      null,
      teacherToken
    );

    console.log(`   Status: ${rosterRes.status} OK`);
    console.log(`   Total enrolled students in class: ${rosterRes.data.data.students.length}`);
    const students = rosterRes.data.data.students;

    if (students.length === 0) {
      throw new Error('No students enrolled in section to test attendance on.');
    }

    // 3. Mark attendance: First student LATE with remark, Second student ABSENT with remark, rest PRESENT
    console.log(`\n3. Recording attendance batch...`);
    const recordsToSave = students.map((s, idx) => {
      if (idx === 0) {
        return { studentId: s.student_id, status: 'LATE', remarks: 'Arrived 15 minutes late' };
      } else if (idx === 1) {
        return { studentId: s.student_id, status: 'ABSENT', remarks: 'Unexcused absence' };
      } else {
        return { studentId: s.student_id, status: 'PRESENT', remarks: '' };
      }
    });

    const saveRes = await apiRequest(
      '/teachers/attendance',
      'POST',
      {
        sectionId: targetTeacher.section_id,
        subjectId: targetTeacher.subject_id,
        date: today,
        records: recordsToSave,
      },
      teacherToken
    );

    console.log(`   Save Response:`, saveRes.data.message);

    // 4. Re-fetch attendance to verify persistence and stats
    console.log(`\n4. Verifying persisted attendance and real-time KPI metrics...`);
    const verifiedRoster = await apiRequest(
      `/teachers/attendance?sectionId=${targetTeacher.section_id}&subjectId=${targetTeacher.subject_id}&date=${today}`,
      'GET',
      null,
      teacherToken
    );

    const stats = verifiedRoster.data.data.stats;
    console.log(`   Attendance Rate: ${stats.attendanceRate}%`);
    console.log(`   Present Count: ${stats.presentCount}`);
    console.log(`   Late Count: ${stats.lateCount}`);
    console.log(`   Absent Count: ${stats.absentCount}`);
    console.log(`   Excused Count: ${stats.excusedCount}`);
    console.log(`   Is Recorded: ${verifiedRoster.data.data.isRecorded}`);

    if (stats.lateCount !== 1 || stats.absentCount !== 1) {
      throw new Error('Attendance counts do not match expected recorded values.');
    }

    // 5. Test Attendance History endpoint
    console.log(`\n5. Verifying Attendance History & At-Risk student query...`);
    const histRes = await apiRequest(
      `/teachers/attendance/history?sectionId=${targetTeacher.section_id}&subjectId=${targetTeacher.subject_id}`,
      'GET',
      null,
      teacherToken
    );
    console.log(`   Historical Days Logged: ${histRes.data.data.history.length}`);
    console.log(`   Latest Log:`, histRes.data.data.history[0]);

    // 6. Test Student Portal visibility
    const firstStudentId = students[0].student_id;
    const stuUserRes = await query(`
      SELECT u.id, u.email, u.role
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `, [firstStudentId]);

    const studentUser = stuUserRes.rows[0];
    const studentToken = jwt.sign(
      { id: studentUser.id, email: studentUser.email, role: 'student' },
      process.env.JWT_SECRET || 'highschool_secret_key_2026',
      { expiresIn: '1h' }
    );

    console.log(`\n6. Testing Student Portal attendance visibility for ${studentUser.email}...`);
    const stuAttRes = await apiRequest('/students/attendance', 'GET', null, studentToken);
    console.log(`   Student Attendance Stats:`, stuAttRes.data.data.stats);
    console.log(`   Recent Records: ${stuAttRes.data.data.records.length} record(s)`);
    console.log(`   First Record: Status = ${stuAttRes.data.data.records[0].status}, Remarks = "${stuAttRes.data.data.records[0].remarks}"`);

    console.log('\n======================================================');
    console.log('✔ ATTENDANCE SYSTEM BACKEND TEST PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Attendance test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testAttendanceSystem();
