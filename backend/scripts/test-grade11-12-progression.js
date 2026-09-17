const jwt = require('jsonwebtoken');
const { query } = require('../src/config/db');
const { JWT_SECRET } = require('../src/middleware/auth');

async function runTest() {
  console.log('=== Starting Test: Grade 11 & Grade 12 Progression Pipeline ===\n');

  try {
    // 1. Create or retrieve a dedicated test student for progression pipeline
    const testEmail = 'progression.test.student@highschool.edu';
    let userRes = await query('SELECT * FROM users WHERE email = $1', [testEmail]);
    let testUser;

    if (userRes.rows.length === 0) {
      const insUser = await query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
         VALUES ($1, '$2a$10$dummyhashnotusedforjwttestingonly', 'student', 'Kidus', 'Alemu', TRUE)
         RETURNING *`,
        [testEmail]
      );
      testUser = insUser.rows[0];

      await query(
        `INSERT INTO students (user_id, student_id, current_grade_level, current_stream_id, current_section_id, document_status, prerequisite_verified)
         VALUES ($1, 'STU-PROG-001', 10, 1, 5, 'APPROVED', TRUE)`,
        [testUser.id]
      );
    } else {
      testUser = userRes.rows[0];
      // Reset student state to Grade 10, General Stream, Section 5
      await query(
        `UPDATE students 
         SET current_grade_level = 10, current_stream_id = 1, current_section_id = 5, document_status = 'APPROVED', prerequisite_verified = TRUE 
         WHERE user_id = $1`,
        [testUser.id]
      );
    }

    const studentRes = await query('SELECT * FROM students WHERE user_id = $1', [testUser.id]);
    const student = studentRes.rows[0];

    // Clear any past test grade records or enrollments for this test student in Grade 10, 11, 12
    await query('DELETE FROM grade_records WHERE student_id = $1', [student.id]);
    await query('DELETE FROM enrollments WHERE student_id = $1', [student.id]);

    const token = jwt.sign(
      {
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        firstName: testUser.first_name,
        lastName: testUser.last_name,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`👤 Student: ${testUser.first_name} ${testUser.last_name} (ID: ${student.student_id}, Grade: 10)`);

    // -------------------------------------------------------------
    // TEST 1: Grade 10 student without Grade 10 results attempts Grade 11 enrollment
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Grade 10 student attempts Grade 11 enrollment with NO recorded results ---');
    const enroll1Res = await fetch('http://localhost:5000/api/students/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sectionId: 7, // Grade 11 Natural Section A
        targetGradeLevel: 11,
        targetStreamId: 2, // Natural
      }),
    });
    const enroll1Data = await enroll1Res.json();
    console.log(`Status: ${enroll1Res.status} (Expected 400)`);
    console.log(`Message: "${enroll1Data.message}"`);
    if (enroll1Res.status !== 400 || !enroll1Data.message.includes('Grade 10 academic results have not yet been recorded')) {
      throw new Error('Test 1 failed: Expected rejection due to missing Grade 10 results.');
    }
    console.log('✓ Test 1 Passed: Correctly blocked Grade 11 enrollment without Grade 10 results.');

    // -------------------------------------------------------------
    // TEST 2: Grade 10 student with FAILING Grade 10 results (Average = 42%)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Grade 10 student with FAILING Grade 10 results (Average < 50%) ---');
    const g10SubjectsRes = await query('SELECT id, name FROM subjects WHERE grade_level = 10 LIMIT 3');
    const subj1 = g10SubjectsRes.rows[0];
    const subj2 = g10SubjectsRes.rows[1];

    // Seed failing scores: 40% and 44% -> Average = 42%
    await query(
      `INSERT INTO grade_records (student_id, subject_id, section_id, academic_year_id, total_score, letter_grade)
       VALUES ($1, $2, 5, 1, 40.0, 'F'), ($1, $3, 5, 1, 44.0, 'F')`,
      [student.id, subj1.id, subj2.id]
    );

    const enroll2Res = await fetch('http://localhost:5000/api/students/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sectionId: 7,
        targetGradeLevel: 11,
        targetStreamId: 2,
      }),
    });
    const enroll2Data = await enroll2Res.json();
    console.log(`Status: ${enroll2Res.status} (Expected 400)`);
    console.log(`Message: "${enroll2Data.message}"`);
    if (enroll2Res.status !== 400 || !enroll2Data.message.includes('below the criteria')) {
      throw new Error('Test 2 failed: Expected rejection due to failing Grade 10 average.');
    }
    console.log('✓ Test 2 Passed: Correctly blocked Grade 11 enrollment when Grade 10 average < 50%.');

    // -------------------------------------------------------------
    // TEST 3: Grade 10 student with PASSING Grade 10 results (Average = 78%)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Grade 10 student with PASSING Grade 10 results (Average = 78%) advances to Grade 11 Natural ---');
    await query('DELETE FROM grade_records WHERE student_id = $1', [student.id]);
    // Seed passing scores: 76% and 80% -> Average = 78%
    await query(
      `INSERT INTO grade_records (student_id, subject_id, section_id, academic_year_id, total_score, letter_grade)
       VALUES ($1, $2, 5, 1, 76.0, 'B'), ($1, $3, 5, 1, 80.0, 'A')`,
      [student.id, subj1.id, subj2.id]
    );

    // Verify progression eligibility endpoint
    const progRes = await fetch('http://localhost:5000/api/students/progression-eligibility?targetGradeLevel=11', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const progData = await progRes.json();
    console.log(`Eligibility Check Status: ${progRes.status}, Eligible: ${progData.data?.evaluation?.eligible}, Average: ${progData.data?.evaluation?.average}%`);
    if (!progData.data?.evaluation?.eligible) {
      throw new Error('Progression check failed for passing Grade 10 student.');
    }

    // Now enroll into Grade 11 Natural Science (Section ID: 7)
    const enroll3Res = await fetch('http://localhost:5000/api/students/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sectionId: 7, // Grade 11 Natural Section A
        targetGradeLevel: 11,
        targetStreamId: 2, // Natural Science
      }),
    });
    const enroll3Data = await enroll3Res.json();
    console.log(`Enrollment Status: ${enroll3Res.status}, Message: "${enroll3Data.message}"`);
    if (enroll3Res.status !== 200) {
      throw new Error(`Grade 11 enrollment failed: ${JSON.stringify(enroll3Data)}`);
    }

    // Verify database student record is now in Grade 11 Natural Stream
    const updatedStuRes = await query('SELECT * FROM students WHERE id = $1', [student.id]);
    const updatedStudent = updatedStuRes.rows[0];
    console.log(`Updated Student in DB: Grade ${updatedStudent.current_grade_level}, Stream ID: ${updatedStudent.current_stream_id}, Section ID: ${updatedStudent.current_section_id}`);
    if (updatedStudent.current_grade_level !== 11 || updatedStudent.current_stream_id !== 2 || updatedStudent.current_section_id !== 7) {
      throw new Error('Database student record was not properly updated to Grade 11 Natural Stream.');
    }
    console.log('✓ Test 3 Passed: Successfully advanced from Grade 10 to Grade 11 Natural Science!');

    // -------------------------------------------------------------
    // TEST 4: Grade 11 student attempts Grade 12 enrollment with NO Grade 11 results
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Grade 11 student attempts Grade 12 enrollment with NO Grade 11 results ---');
    const enroll4Res = await fetch('http://localhost:5000/api/students/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sectionId: 11, // Grade 12 Natural Section A
        targetGradeLevel: 12,
        targetStreamId: 2, // Natural
      }),
    });
    const enroll4Data = await enroll4Res.json();
    console.log(`Status: ${enroll4Res.status} (Expected 400)`);
    console.log(`Message: "${enroll4Data.message}"`);
    if (enroll4Res.status !== 400 || !enroll4Data.message.includes('Grade 11 academic results have not yet been recorded')) {
      throw new Error('Test 4 failed: Expected rejection due to missing Grade 11 results.');
    }
    console.log('✓ Test 4 Passed: Correctly blocked Grade 12 Senior enrollment without Grade 11 results.');

    // -------------------------------------------------------------
    // TEST 5: Grade 11 student with PASSING Grade 11 results (Average = 74%) advances to Grade 12 Senior
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Grade 11 student with PASSING Grade 11 results advances to Grade 12 Senior Year ---');
    const g11SubjectsRes = await query('SELECT id, name FROM subjects WHERE grade_level = 11 AND stream_id = 2 LIMIT 2');
    const g11Subj1 = g11SubjectsRes.rows[0];
    const g11Subj2 = g11SubjectsRes.rows[1];

    // Seed Grade 11 results: 72% and 76% -> Average = 74%
    await query(
      `INSERT INTO grade_records (student_id, subject_id, section_id, academic_year_id, total_score, letter_grade)
       VALUES ($1, $2, 7, 1, 72.0, 'B'), ($1, $3, 7, 1, 76.0, 'B')`,
      [student.id, g11Subj1.id, g11Subj2.id]
    );

    // Verify progression eligibility endpoint for Grade 12
    const prog12Res = await fetch('http://localhost:5000/api/students/progression-eligibility?targetGradeLevel=12', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const prog12Data = await prog12Res.json();
    console.log(`Grade 12 Eligibility Check Status: ${prog12Res.status}, Eligible: ${prog12Data.data?.evaluation?.eligible}, Average: ${prog12Data.data?.evaluation?.average}%`);
    if (!prog12Data.data?.evaluation?.eligible) {
      throw new Error('Progression check failed for passing Grade 11 student.');
    }

    // Enroll into Grade 12 Senior Natural (Section ID: 11)
    const enroll5Res = await fetch('http://localhost:5000/api/students/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sectionId: 11, // Grade 12 Natural Section A
        targetGradeLevel: 12,
        targetStreamId: 2, // Natural
      }),
    });
    const enroll5Data = await enroll5Res.json();
    console.log(`Enrollment Status: ${enroll5Res.status}, Message: "${enroll5Data.message}"`);
    if (enroll5Res.status !== 200) {
      throw new Error(`Grade 12 enrollment failed: ${JSON.stringify(enroll5Data)}`);
    }

    // Verify database student record is now in Grade 12 Senior Natural Stream
    const seniorStuRes = await query('SELECT * FROM students WHERE id = $1', [student.id]);
    const seniorStudent = seniorStuRes.rows[0];
    console.log(`Senior Student in DB: Grade ${seniorStudent.current_grade_level}, Stream ID: ${seniorStudent.current_stream_id}, Section ID: ${seniorStudent.current_section_id}`);
    if (seniorStudent.current_grade_level !== 12 || seniorStudent.current_stream_id !== 2 || seniorStudent.current_section_id !== 11) {
      throw new Error('Database student record was not properly updated to Grade 12 Senior Natural Stream.');
    }
    console.log('✓ Test 5 Passed: Successfully advanced from Grade 11 to Grade 12 Senior Year!');

    console.log('\n🎉 ALL GRADE 11 & GRADE 12 PROGRESSION TESTS PASSED WITH 100% ACCURACY!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTest();
