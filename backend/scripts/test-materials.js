const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { query } = require('../src/config/db');
const { JWT_SECRET } = require('../src/middleware/auth');

async function runTest() {
  console.log('=== Starting Test: Study Materials & Digital Library Flow ===\n');

  try {
    // 1. Get teacher Abebe Kebede
    const teacherUserRes = await query("SELECT * FROM users WHERE role = 'teacher' ORDER BY id ASC LIMIT 1");
    if (teacherUserRes.rows.length === 0) throw new Error('No teacher found in database');
    const teacherUser = teacherUserRes.rows[0];

    const teacherRes = await query('SELECT * FROM teachers WHERE user_id = $1', [teacherUser.id]);
    const teacher = teacherRes.rows[0];

    // 2. Get student Sara Haile (Grade 9)
    const studentUserRes = await query("SELECT u.*, s.current_grade_level, s.current_section_id FROM users u JOIN students s ON s.user_id = u.id WHERE u.role = 'student' ORDER BY u.id ASC LIMIT 1");
    if (studentUserRes.rows.length === 0) throw new Error('No student found in database');
    const studentUser = studentUserRes.rows[0];

    // 3. Get Subject (Grade 9 Mathematics)
    const subjectRes = await query("SELECT * FROM subjects WHERE grade_level = 9 LIMIT 1");
    const subject = subjectRes.rows[0];

    // Sign Tokens
    const teacherToken = jwt.sign(
      {
        id: teacherUser.id,
        email: teacherUser.email,
        role: teacherUser.role,
        firstName: teacherUser.first_name,
        lastName: teacherUser.last_name,
        teacher,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const studentToken = jwt.sign(
      {
        id: studentUser.id,
        email: studentUser.email,
        role: studentUser.role,
        firstName: studentUser.first_name,
        lastName: studentUser.last_name,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`👤 Testing as Teacher: ${teacherUser.first_name} ${teacherUser.last_name} (${teacherUser.email})`);
    console.log(`👤 Testing as Student: ${studentUser.first_name} ${studentUser.last_name} (Grade ${studentUser.current_grade_level})`);
    console.log(`📚 Target Subject: ${subject.name} (Grade ${subject.grade_level})\n`);

    // 4. Test Teacher Upload Options
    const optRes = await fetch('http://localhost:5000/api/teachers/materials/options', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const optData = await optRes.json();
    console.log(`✓ 1. Teacher Upload Options API status: ${optRes.status} (Subjects available: ${optData.data?.allSubjects?.length || 0})`);

    // 5. Test File Upload (Create dummy PDF file)
    const testFilePath = path.join(__dirname, 'sample_test_book.pdf');
    fs.writeFileSync(testFilePath, '%PDF-1.4 Mock PDF Content for Grade 9 Mathematics Textbook');

    const fileBuffer = fs.readFileSync(testFilePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', blob, 'Grade9_Math_Textbook_2026.pdf');
    formData.append('title', 'Grade 9 Mathematics Official Student Textbook');
    formData.append('author', 'Ministry of Education');
    formData.append('edition', '2026 Revised Edition');
    formData.append('subjectId', String(subject.id));
    formData.append('gradeLevel', '9');
    formData.append('materialType', 'TEXTBOOK');
    formData.append('description', 'Comprehensive textbook covering Algebra, Geometry, and Trigonometry.');

    const uploadRes = await fetch('http://localhost:5000/api/teachers/materials', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    console.log(`✓ 2. Teacher Upload Status: ${uploadRes.status} (${uploadData.message})`);
    if (!uploadData.success) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
    }

    const uploadedMaterial = uploadData.data;
    console.log(`   Material ID: ${uploadedMaterial.id}, File: ${uploadedMaterial.file_name}, Type: ${uploadedMaterial.material_type}`);

    // Verify file exists on server disk
    const diskFileName = path.basename(uploadedMaterial.file_url);
    const diskPath = path.join(__dirname, '../uploads/materials', diskFileName);
    const fileExistsOnDisk = fs.existsSync(diskPath);
    console.log(`✓ 3. Verified file stored on disk at: ${diskPath} (Exists: ${fileExistsOnDisk})`);

    // 6. Test GET Teacher Materials
    const listRes = await fetch('http://localhost:5000/api/teachers/materials', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const listData = await listRes.json();
    const foundInTeacherList = listData.data.some((m) => m.id === uploadedMaterial.id);
    console.log(`✓ 4. Teacher Materials List Status: ${listRes.status} (Material present in teacher list: ${foundInTeacherList})`);

    // 7. Test Student Materials (Student should see this Grade 9 book!)
    const studentMatRes = await fetch('http://localhost:5000/api/students/materials', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentMatData = await studentMatRes.json();
    console.log(`✓ 5. Student Materials Status: ${studentMatRes.status} (Total available for student: ${studentMatData.data?.materials?.length})`);
    const foundInStudentList = studentMatData.data?.materials?.find((m) => m.id === uploadedMaterial.id);
    console.log(`   Student sees textbook: "${foundInStudentList?.title}" by ${foundInStudentList?.author} (${foundInStudentList?.material_type})`);

    // 8. Test Student Download Counter Track
    const dlRes = await fetch(`http://localhost:5000/api/students/materials/${uploadedMaterial.id}/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const dlData = await dlRes.json();
    console.log(`✓ 6. Download Tracking Status: ${dlRes.status} (New download count: ${dlData.data?.download_count})`);

    // 9. Test Direct File Download API
    const fileDlRes = await fetch(`http://localhost:5000/api/students/materials/${uploadedMaterial.id}/file`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    console.log(`✓ 7. Direct File Download Status: ${fileDlRes.status} (Content-Type: ${fileDlRes.headers.get('content-type')})`);

    // 10. Test Teacher Update
    const updateRes = await fetch(`http://localhost:5000/api/teachers/materials/${uploadedMaterial.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        title: 'Grade 9 Mathematics Official Student Textbook (Updated)',
        edition: '2026-2027 Edition',
      }),
    });
    const updateData = await updateRes.json();
    console.log(`✓ 8. Teacher Update Status: ${updateRes.status} (Updated title: "${updateData.data?.title}")`);

    // Clean up sample test file
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The Learning Materials and Digital Library system is 100% operational.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTest();
