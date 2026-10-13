const bcrypt = require('bcryptjs');
const { query, withTransaction, pool } = require('../config/db');
require('dotenv').config();

async function seedDatabase() {
  console.log('=== Seeding High School Multi-Tenant SaaS Database ===');

  try {
    await withTransaction(async (client) => {
      // 1. Seed Global Super Admin
      const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@ethiohighhub.com';
      const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
      const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

      const existingSuperAdmin = await client.query('SELECT id, email FROM users WHERE role = $1', ['superadmin']);
      if (existingSuperAdmin.rows.length === 0) {
        await client.query(
          `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, $2, 'superadmin', 'Platform', 'SuperAdmin', TRUE)`,
          [superAdminEmail, superAdminHash]
        );
        console.log(`[SEED] Created Global Super Admin: ${superAdminEmail}`);
      } else {
        console.log(`[SEED] Global Super Admin already exists: ${existingSuperAdmin.rows[0].email}`);
      }

      // 2. Seed School 1: Bole High School
      const boleSchoolRes = await client.query(
        `INSERT INTO schools (name, code, city, phone, email, subscription_status, is_active)
         VALUES ('Bole High School', 'bole-high', 'Addis Ababa', '+251 11 661 2233', 'info@bolehigh.edu.et', 'ACTIVE', TRUE)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, subscription_status = 'ACTIVE'
         RETURNING id`
      );
      const boleSchoolId = boleSchoolRes.rows[0].id;
      console.log(`[SEED] Established School 1: Bole High School (ID: ${boleSchoolId})`);

      // 3. Seed School 1 Single Admin (Amanuel / aman12@gmail.com)
      const adminEmail = process.env.ADMIN_EMAIL || 'aman12@gmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'aman1221';
      const adminHash = await bcrypt.hash(adminPassword, 10);

      const existingAdmin = await client.query('SELECT id, email FROM users WHERE role = $1 AND school_id = $2', ['admin', boleSchoolId]);
      if (existingAdmin.rows.length === 0) {
        await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, $2, $3, 'admin', 'System', 'Administrator', TRUE)`,
          [boleSchoolId, adminEmail, adminHash]
        );
        console.log(`[SEED] Created Bole School Admin: ${adminEmail}`);
      } else {
        console.log(`[SEED] Bole School Admin already exists: ${existingAdmin.rows[0].email}`);
      }

      // 4. Seed Academic Year for Bole High School
      const yearRes = await client.query(
        `INSERT INTO academic_years (school_id, year_name, is_current, start_date, end_date)
         VALUES ($1, '2026-2027', TRUE, '2026-09-01', '2027-06-30')
         ON CONFLICT (school_id, year_name) DO UPDATE SET is_current = TRUE
         RETURNING id`,
        [boleSchoolId]
      );
      const currentYearId = yearRes.rows[0].id;
      console.log(`[SEED] Academic Year for Bole High: 2026-2027 (ID: ${currentYearId})`);

      // 5. High School Grades (Shared Standard: 9, 10, 11, 12)
      const gradesData = [
        { level: 9, name: 'Grade 9' },
        { level: 10, name: 'Grade 10' },
        { level: 11, name: 'Grade 11' },
        { level: 12, name: 'Grade 12' },
      ];
      for (const g of gradesData) {
        await client.query(
          `INSERT INTO grades (level, name) VALUES ($1, $2)
           ON CONFLICT (level) DO UPDATE SET name = $2`,
          [g.level, g.name]
        );
      }
      console.log('[SEED] Grades 9, 10, 11, 12 established.');

      // 6. Streams (Shared Standard: GENERAL, NATURAL, SOCIAL)
      const streamsData = [
        { code: 'GENERAL', name: 'General Stream', desc: 'Standard high-school foundation curriculum for Grades 9 and 10' },
        { code: 'NATURAL', name: 'Natural Stream', desc: 'Sciences, Engineering, and Advanced Mathematics focus for Grades 11 and 12' },
        { code: 'SOCIAL', name: 'Social Stream', desc: 'Social sciences, Humanities, Economics, and Law focus for Grades 11 and 12' },
      ];
      const streamMap = {};
      for (const s of streamsData) {
        const strRes = await client.query(
          `INSERT INTO streams (code, name, description) VALUES ($1, $2, $3)
           ON CONFLICT (code) DO UPDATE SET name = $2, description = $3
           RETURNING id, code`,
          [s.code, s.name, s.desc]
        );
        streamMap[s.code] = strRes.rows[0].id;
      }
      console.log('[SEED] Streams established: GENERAL, NATURAL, SOCIAL.');

      // 7. Stream Criteria for Bole High School
      await client.query(
        `INSERT INTO stream_criteria (school_id, stream_id, target_grade_level, min_overall_average, required_subjects_config)
         VALUES ($1, $2, 11, 70.00, $3)
         ON CONFLICT (school_id, stream_id, target_grade_level) DO NOTHING`,
        [
          boleSchoolId,
          streamMap['NATURAL'],
          JSON.stringify({
            min_avg: 70.0,
            subjects: {
              Mathematics: 65.0,
              Physics: 60.0,
              Chemistry: 60.0,
              Biology: 60.0,
            },
          }),
        ]
      );

      await client.query(
        `INSERT INTO stream_criteria (school_id, stream_id, target_grade_level, min_overall_average, required_subjects_config)
         VALUES ($1, $2, 11, 65.00, $3)
         ON CONFLICT (school_id, stream_id, target_grade_level) DO NOTHING`,
        [
          boleSchoolId,
          streamMap['SOCIAL'],
          JSON.stringify({
            min_avg: 65.0,
            subjects: {
              History: 60.0,
              Geography: 60.0,
              Economics: 60.0,
              Civics: 60.0,
            },
          }),
        ]
      );
      console.log('[SEED] Stream Criteria configured for Bole High School.');

      // 8. Subjects for Bole High School
      const subjectsData = [
        { code: 'MATH-9', name: 'Mathematics', grade: 9, stream: 'GENERAL' },
        { code: 'ENG-9', name: 'English', grade: 9, stream: 'GENERAL' },
        { code: 'PHY-9', name: 'Physics', grade: 9, stream: 'GENERAL' },
        { code: 'CHEM-9', name: 'Chemistry', grade: 9, stream: 'GENERAL' },
        { code: 'BIO-9', name: 'Biology', grade: 9, stream: 'GENERAL' },
        { code: 'HIST-9', name: 'History', grade: 9, stream: 'GENERAL' },
        { code: 'GEO-9', name: 'Geography', grade: 9, stream: 'GENERAL' },
        { code: 'CIV-9', name: 'Civics', grade: 9, stream: 'GENERAL' },
        { code: 'MATH-10', name: 'Mathematics', grade: 10, stream: 'GENERAL' },
        { code: 'ENG-10', name: 'English', grade: 10, stream: 'GENERAL' },
        { code: 'PHY-10', name: 'Physics', grade: 10, stream: 'GENERAL' },
        { code: 'CHEM-10', name: 'Chemistry', grade: 10, stream: 'GENERAL' },
        { code: 'BIO-10', name: 'Biology', grade: 10, stream: 'GENERAL' },
        { code: 'HIST-10', name: 'History', grade: 10, stream: 'GENERAL' },
        { code: 'GEO-10', name: 'Geography', grade: 10, stream: 'GENERAL' },
        { code: 'ECON-10', name: 'Economics', grade: 10, stream: 'GENERAL' },
        { code: 'CIV-10', name: 'Civics', grade: 10, stream: 'GENERAL' },
        { code: 'MATH-11-NAT', name: 'Advanced Mathematics', grade: 11, stream: 'NATURAL' },
        { code: 'PHY-11-NAT', name: 'Physics', grade: 11, stream: 'NATURAL' },
        { code: 'CHEM-11-NAT', name: 'Chemistry', grade: 11, stream: 'NATURAL' },
        { code: 'BIO-11-NAT', name: 'Biology', grade: 11, stream: 'NATURAL' },
        { code: 'ENG-11-NAT', name: 'English', grade: 11, stream: 'NATURAL' },
        { code: 'MATH-11-SOC', name: 'General Mathematics', grade: 11, stream: 'SOCIAL' },
        { code: 'HIST-11-SOC', name: 'History', grade: 11, stream: 'SOCIAL' },
        { code: 'GEO-11-SOC', name: 'Geography', grade: 11, stream: 'SOCIAL' },
        { code: 'ECON-11-SOC', name: 'Economics', grade: 11, stream: 'SOCIAL' },
        { code: 'ENG-11-SOC', name: 'English', grade: 11, stream: 'SOCIAL' },
      ];

      const subjectMap = {};
      for (const sub of subjectsData) {
        const subRes = await client.query(
          `INSERT INTO subjects (school_id, code, name, grade_level, stream_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (school_id, code) DO UPDATE SET name = $3, grade_level = $4, stream_id = $5
           RETURNING id, code`,
          [boleSchoolId, sub.code, sub.name, sub.grade, streamMap[sub.stream]]
        );
        subjectMap[sub.code] = subRes.rows[0].id;
      }
      console.log('[SEED] High school subjects created for Bole High School.');

      // 9. Sections for Bole High School
      const sectionsData = [
        { grade: 9, stream: 'GENERAL', name: 'A', cap: 50 },
        { grade: 9, stream: 'GENERAL', name: 'B', cap: 50 },
        { grade: 9, stream: 'GENERAL', name: 'C', cap: 50 },
        { grade: 9, stream: 'GENERAL', name: 'D', cap: 50 },
        { grade: 10, stream: 'GENERAL', name: 'A', cap: 50 },
        { grade: 10, stream: 'GENERAL', name: 'B', cap: 50 },
        { grade: 11, stream: 'NATURAL', name: 'A', cap: 50 },
        { grade: 11, stream: 'NATURAL', name: 'B', cap: 50 },
        { grade: 11, stream: 'SOCIAL', name: 'A', cap: 50 },
        { grade: 11, stream: 'SOCIAL', name: 'B', cap: 50 },
        { grade: 12, stream: 'NATURAL', name: 'A', cap: 50 },
        { grade: 12, stream: 'SOCIAL', name: 'A', cap: 50 },
      ];

      const sectionMap = {};
      for (const sec of sectionsData) {
        const secRes = await client.query(
          `INSERT INTO sections (school_id, grade_level, stream_id, section_name, capacity, academic_year_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (school_id, grade_level, stream_id, section_name, academic_year_id)
           DO UPDATE SET capacity = $5
           RETURNING id, section_name, grade_level, stream_id`,
          [boleSchoolId, sec.grade, streamMap[sec.stream], sec.name, sec.cap, currentYearId]
        );
        sectionMap[`${sec.grade}-${sec.stream}-${sec.name}`] = secRes.rows[0].id;
      }
      console.log('[SEED] Sections established for Bole High with 50-student capacity.');

      // 10. Grade 8 Prerequisites
      const prereqs = [
        { id: 'STU-2026-001', name: 'Dawit Bekele', school: 'Addis Primary', year: 2026, total: 620, avg: 88.57, status: 'PASSED' },
        { id: 'STU-2026-002', name: 'Sara Haile', school: 'Bole Primary', year: 2026, total: 580, avg: 82.85, status: 'PASSED' },
        { id: 'STU-2026-003', name: 'Yonatan Alemu', school: 'Hawassa Primary', year: 2026, total: 290, avg: 41.42, status: 'FAILED' },
        { id: 'STU-2026-004', name: 'Meron Tesfaye', school: 'Arada Primary', year: 2026, total: 540, avg: 77.14, status: 'PASSED' },
        { id: 'STU-2026-010', name: 'Natnael Desta', school: 'Menelik Primary', year: 2025, total: 640, avg: 91.42, status: 'PASSED' },
        { id: 'STU-2026-011', name: 'Bethlehem Girma', school: 'Yeka Primary', year: 2025, total: 510, avg: 72.85, status: 'PASSED' },
        { id: 'STU-2026-088', name: 'Abebe Bikila', school: 'Addis Primary', year: 2026, total: 600, avg: 85.71, status: 'PASSED' },
      ];
      for (const p of prereqs) {
        await client.query(
          `INSERT INTO prerequisites (student_id, full_name, previous_school, completion_year, total_score, average_score, status, verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           ON CONFLICT (student_id) DO UPDATE SET
             full_name = $2, previous_school = $3, completion_year = $4, total_score = $5, average_score = $6, status = $7`,
          [p.id, p.name, p.school, p.year, p.total, p.avg, p.status]
        );
      }
      console.log('[SEED] Grade 8 official ministry prerequisites recorded.');

      // 11. Teachers for Bole High School
      const teachersData = [
        {
          email: 'teacher.math@highschool.edu',
          password: 'Teacher@123',
          first_name: 'Abebe',
          last_name: 'Kebede',
          tid: 'TCH-2026-001',
          phone: '+251911223344',
          qualification: 'MSc Mathematics',
          specialization: 'Pure Mathematics',
          years: 8,
        },
        {
          email: 'teacher.physics@highschool.edu',
          password: 'Teacher@123',
          first_name: 'Helen',
          last_name: 'Mengistu',
          tid: 'TCH-2026-002',
          phone: '+251922334455',
          qualification: 'PhD Physics',
          specialization: 'Theoretical & Applied Physics',
          years: 12,
        },
        {
          email: 'teacher.history@highschool.edu',
          password: 'Teacher@123',
          first_name: 'Samuel',
          last_name: 'Tadesse',
          tid: 'TCH-2026-003',
          phone: '+251933445566',
          qualification: 'MA History',
          specialization: 'African and World History',
          years: 6,
        },
      ];

      const teacherMap = {};
      for (const t of teachersData) {
        const hash = await bcrypt.hash(t.password, 10);
        let uRes = await client.query('SELECT id FROM users WHERE email = $1', [t.email]);
        let uid;
        if (uRes.rows.length === 0) {
          const ins = await client.query(
            `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
             VALUES ($1, $2, $3, 'teacher', $4, $5, TRUE) RETURNING id`,
            [boleSchoolId, t.email, hash, t.first_name, t.last_name]
          );
          uid = ins.rows[0].id;
        } else {
          uid = uRes.rows[0].id;
        }

        const tRes = await client.query(
          `INSERT INTO teachers (school_id, user_id, teacher_id, phone, qualification, specialization, years_of_experience, is_approved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           ON CONFLICT (teacher_id) DO UPDATE SET qualification = $5, specialization = $6
           RETURNING id, teacher_id`,
          [boleSchoolId, uid, t.tid, t.phone, t.qualification, t.specialization, t.years]
        );
        teacherMap[t.tid] = tRes.rows[0].id;
      }
      console.log('[SEED] Bole High School teachers seeded.');

      // 12. Teacher Assignments for Bole High School
      const g9SecA = sectionMap['9-GENERAL-A'];
      const g9SecB = sectionMap['9-GENERAL-B'];
      const subMath9 = subjectMap['MATH-9'];

      const assign1 = await client.query(
        `INSERT INTO teacher_assignments (school_id, teacher_id, subject_id, section_id, academic_year_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO UPDATE SET assigned_at = NOW()
         RETURNING id`,
        [boleSchoolId, teacherMap['TCH-2026-001'], subMath9, g9SecA, currentYearId]
      );
      const assign1Id = assign1.rows[0].id;

      await client.query(
        `INSERT INTO teacher_assignments (school_id, teacher_id, subject_id, section_id, academic_year_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO NOTHING`,
        [boleSchoolId, teacherMap['TCH-2026-001'], subMath9, g9SecB, currentYearId]
      );

      const g10SecA = sectionMap['10-GENERAL-A'];
      const subPhy10 = subjectMap['PHY-10'];
      await client.query(
        `INSERT INTO teacher_assignments (school_id, teacher_id, subject_id, section_id, academic_year_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO NOTHING`,
        [boleSchoolId, teacherMap['TCH-2026-002'], subPhy10, g10SecA, currentYearId]
      );

      // 13. Schedules for Bole High School
      await client.query(
        `INSERT INTO schedules (teacher_assignment_id, day_of_week, start_time, end_time, period_number, room_number)
         VALUES
           ($1, 'Monday', '08:30:00', '09:30:00', 1, 'Room 101'),
           ($1, 'Wednesday', '09:30:00', '10:30:00', 2, 'Room 101'),
           ($1, 'Friday', '11:00:00', '12:00:00', 3, 'Room 101')
         ON CONFLICT DO NOTHING`,
        [assign1Id]
      );
      console.log('[SEED] Schedules configured for Bole High School.');

      // 14. Students for Bole High School
      const pwHash = await bcrypt.hash('Student@123', 10);

      // Student 1: Dawit Bekele (Grade 9 General, Section A)
      let s1User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g9@highschool.edu']);
      let s1Uid;
      if (s1User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, 'student.g9@highschool.edu', $2, 'student', 'Dawit', 'Bekele', TRUE) RETURNING id`,
          [boleSchoolId, pwHash]
        );
        s1Uid = ins.rows[0].id;
      } else {
        s1Uid = s1User.rows[0].id;
      }

      const s1Res = await client.query(
        `INSERT INTO students (school_id, user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, $2, 'STU-2026-001', '2010-05-14', 'Male', '+251911001122', 'Bole Sub-city, Addis Ababa', 'Bekele Wolde', '+251911998877', 9, $3, $4, TRUE, 'ACTIVE')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $4
         RETURNING id`,
        [boleSchoolId, s1Uid, streamMap['GENERAL'], g9SecA]
      );
      const student1Id = s1Res.rows[0].id;

      await client.query(
        `INSERT INTO enrollments (school_id, student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, $3, 9, $4, $5, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [boleSchoolId, student1Id, g9SecA, streamMap['GENERAL'], currentYearId]
      );

      // Student 2: Sara Haile (Grade 9 General, Section B)
      let s2User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g9b@highschool.edu']);
      let s2Uid;
      if (s2User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, 'student.g9b@highschool.edu', $2, 'student', 'Sara', 'Haile', TRUE) RETURNING id`,
          [boleSchoolId, pwHash]
        );
        s2Uid = ins.rows[0].id;
      } else {
        s2Uid = s2User.rows[0].id;
      }

      const s2Res = await client.query(
        `INSERT INTO students (school_id, user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, $2, 'STU-2026-002', '2010-08-20', 'Female', '+251922112233', 'Yeka Sub-city, Addis Ababa', 'Haile Tadesse', '+251922887766', 9, $3, $4, TRUE, 'ACTIVE')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $4
         RETURNING id`,
        [boleSchoolId, s2Uid, streamMap['GENERAL'], g9SecB]
      );
      const student2Id = s2Res.rows[0].id;

      await client.query(
        `INSERT INTO enrollments (school_id, student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, $3, 9, $4, $5, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [boleSchoolId, student2Id, g9SecB, streamMap['GENERAL'], currentYearId]
      );

      // Student 3: Natnael Desta (Grade 10 Natural Stream Qualified)
      let s3User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g10.natural@highschool.edu']);
      let s3Uid;
      if (s3User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, 'student.g10.natural@highschool.edu', $2, 'student', 'Natnael', 'Desta', TRUE) RETURNING id`,
          [boleSchoolId, pwHash]
        );
        s3Uid = ins.rows[0].id;
      } else {
        s3Uid = s3User.rows[0].id;
      }

      const s3Res = await client.query(
        `INSERT INTO students (school_id, user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, $2, 'STU-2026-010', '2009-03-10', 'Male', '+251933112233', 'Kirkos, Addis Ababa', 'Desta Kassa', '+251933887766', 10, $3, $4, TRUE, 'PROMOTED')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $4
         RETURNING id`,
        [boleSchoolId, s3Uid, streamMap['GENERAL'], g10SecA]
      );
      const student3Id = s3Res.rows[0].id;

      await client.query(
        `INSERT INTO enrollments (school_id, student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, $3, 10, $4, $5, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [boleSchoolId, student3Id, g10SecA, streamMap['GENERAL'], currentYearId]
      );

      // Grade 10 results for Natnael
      const g10Subs = ['MATH-10', 'PHY-10', 'CHEM-10', 'BIO-10', 'ENG-10', 'HIST-10', 'GEO-10', 'CIV-10'];
      const natnaelScores = [92, 88, 85, 87, 80, 75, 78, 82];
      for (let i = 0; i < g10Subs.length; i++) {
        const subId = subjectMap[g10Subs[i]];
        const score = natnaelScores[i];
        await client.query(
          `INSERT INTO grade_records (school_id, student_id, subject_id, section_id, academic_year_id, semester, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11, 'Excellent performance')
           ON CONFLICT (student_id, subject_id, academic_year_id, semester) DO UPDATE SET total_score = $10`,
          [
            boleSchoolId,
            student3Id,
            subId,
            g10SecA,
            currentYearId,
            score * 0.1,
            score * 0.3,
            score * 0.2,
            score * 0.4,
            score,
            score >= 90 ? 'A+' : score >= 80 ? 'A' : 'B',
          ]
        );
      }

      // Student 4: Bethlehem Girma (Grade 10 Low Science / Social eligible)
      let s4User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g10.social@highschool.edu']);
      let s4Uid;
      if (s4User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, 'student.g10.social@highschool.edu', $2, 'student', 'Bethlehem', 'Girma', TRUE) RETURNING id`,
          [boleSchoolId, pwHash]
        );
        s4Uid = ins.rows[0].id;
      } else {
        s4Uid = s4User.rows[0].id;
      }
      const s4Res = await client.query(
        `INSERT INTO students (school_id, user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, $2, 'STU-2026-011', '2009-07-22', 'Female', '+251944112233', 'Nifas Silk, Addis Ababa', 'Girma Assefa', '+251944887766', 10, $3, $4, TRUE, 'PROMOTED')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $4
         RETURNING id`,
        [boleSchoolId, s4Uid, streamMap['GENERAL'], g10SecA]
      );
      const student4Id = s4Res.rows[0].id;
      await client.query(
        `INSERT INTO enrollments (school_id, student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, $3, 10, $4, $5, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [boleSchoolId, student4Id, g10SecA, streamMap['GENERAL'], currentYearId]
      );

      // Seed Grade 10 results for Bethlehem (Low science: Math 52, Physics 48, Chem 50, Bio 54; High social: History 88, Geo 85, Econ 84, Civics 89 => Avg ~ 68.75%)
      const bethSubs = ['MATH-10', 'PHY-10', 'CHEM-10', 'BIO-10', 'ENG-10', 'HIST-10', 'GEO-10', 'ECON-10', 'CIV-10'];
      const bethScores = [52, 48, 50, 54, 75, 88, 85, 84, 89];
      for (let i = 0; i < bethSubs.length; i++) {
        const subId = subjectMap[bethSubs[i]];
        const score = bethScores[i];
        await client.query(
          `INSERT INTO grade_records (school_id, student_id, subject_id, section_id, academic_year_id, semester, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11, 'Eligible for Social Stream')
           ON CONFLICT (student_id, subject_id, academic_year_id, semester) DO UPDATE SET total_score = $10`,
          [
            boleSchoolId,
            student4Id,
            subId,
            g10SecA,
            currentYearId,
            score * 0.1,
            score * 0.3,
            score * 0.2,
            score * 0.4,
            score,
            score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'F',
          ]
        );
      }

      // 15. Assignments & Group Work
      const assignRes = await client.query(
        `INSERT INTO assignments (school_id, teacher_assignment_id, title, description, assignment_type, max_score, due_date, instructions)
         VALUES ($1, $2, 'Linear Equations Project', 'Collaborative algebra modeling project', 'GROUP', 20.00, NOW() + INTERVAL '14 days', 'Work in assigned groups. Submit written derivation and presentation.')
         RETURNING id`,
        [boleSchoolId, assign1Id]
      );
      const assignmentId = assignRes.rows[0].id;

      const groupRes = await client.query(
        `INSERT INTO assignment_groups (assignment_id, group_code, group_name, group_score, evaluated_at)
         VALUES ($1, 'GROUP-MATH9-A-001', 'Algebra Team Alpha', 18.00, NOW())
         ON CONFLICT (group_code) DO UPDATE SET group_score = 18.00
         RETURNING id`,
        [assignmentId]
      );
      const groupId = groupRes.rows[0].id;

      await client.query(
        `INSERT INTO assignment_group_members (group_id, student_id, assignment_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (group_id, student_id) DO NOTHING`,
        [groupId, student1Id, assignmentId]
      );

      await client.query(
        `INSERT INTO grade_records (school_id, student_id, subject_id, section_id, academic_year_id, semester, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks)
         VALUES ($1, $2, $3, $4, $5, 1, 9.5, 27.5, 18.0, 36.0, 91.0, 'A+', 'Outstanding collaborative group work')
         ON CONFLICT (student_id, subject_id, academic_year_id, semester) DO UPDATE SET
           assignment_score = 18.0, total_score = 91.0, letter_grade = 'A+'`,
        [boleSchoolId, student1Id, subMath9, g9SecA, currentYearId]
      );

      // Attendance sample for Dawit
      await client.query(
        `INSERT INTO attendance (school_id, student_id, section_id, subject_id, teacher_id, date, status, remarks)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'PRESENT', 'On time')
         ON CONFLICT DO NOTHING`,
        [boleSchoolId, student1Id, g9SecA, subMath9, teacherMap['TCH-2026-001']]
      );

      // Announcements for Bole High School
      await client.query(
        `INSERT INTO announcements (school_id, title, content, target_audience, created_at)
         VALUES ($1, 'Welcome to Academic Year 2026-2027 at Bole High', 'The new school year has officially commenced. All students must complete section registration.', 'ALL', NOW())`,
        [boleSchoolId]
      );

      // System Settings for Bole High School
      const defaultSettings = [
        { key: 'school_name', val: { name: 'Bole High School' }, desc: 'Official School Name' },
        { key: 'default_section_capacity', val: { capacity: 50 }, desc: 'Standard maximum student capacity per section' },
        { key: 'grading_policy', val: { quiz_weight: 10, midterm_weight: 30, assignment_weight: 20, final_weight: 40 }, desc: 'Academic grading weights' },
        { key: 'prerequisite_min_pass_gpa', val: { min_gpa: 50.0 }, desc: 'Minimum Grade 8 GPA required for Grade 9 admission' },
      ];
      for (const s of defaultSettings) {
        await client.query(
          `INSERT INTO system_settings (school_id, key, value, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (school_id, key) DO UPDATE SET value = $3, description = $4`,
          [boleSchoolId, s.key, JSON.stringify(s.val), s.desc]
        );
      }

      // ==============================================================================
      // 16. SEED SCHOOL 2: Menelik II High School (PROVING MULTI-TENANT ISOLATION)
      // ==============================================================================
      const s2School = await client.query(
        `INSERT INTO schools (name, code, city, phone, email, subscription_status, is_active)
         VALUES ('Menelik II High School', 'menelik-high', 'Addis Ababa', '+251 11 123 4567', 'info@menelik.edu.et', 'ACTIVE', TRUE)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, subscription_status = 'ACTIVE'
         RETURNING id`
      );
      const menelikSchoolId = s2School.rows[0].id;
      console.log(`[SEED] Established School 2: Menelik II High School (ID: ${menelikSchoolId})`);

      // School 2 Admin: admin.menelik@highschool.edu
      const menelikAdminEmail = 'admin.menelik@highschool.edu';
      const menelikAdminHash = await bcrypt.hash('Admin@123', 10);
      const existingMAdmin = await client.query('SELECT id FROM users WHERE role = $1 AND school_id = $2', ['admin', menelikSchoolId]);
      if (existingMAdmin.rows.length === 0) {
        await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, $2, $3, 'admin', 'Menelik', 'Administrator', TRUE)`,
          [menelikSchoolId, menelikAdminEmail, menelikAdminHash]
        );
        console.log(`[SEED] Created Menelik School Admin: ${menelikAdminEmail}`);
      }

      // School 2 Academic Year
      const mYearRes = await client.query(
        `INSERT INTO academic_years (school_id, year_name, is_current, start_date, end_date)
         VALUES ($1, '2026-2027', TRUE, '2026-09-01', '2027-06-30')
         ON CONFLICT (school_id, year_name) DO UPDATE SET is_current = TRUE
         RETURNING id`,
        [menelikSchoolId]
      );
      const mYearId = mYearRes.rows[0].id;

      // School 2 Sections: 9-A and 10-A
      const mSec9A = await client.query(
        `INSERT INTO sections (school_id, grade_level, stream_id, section_name, capacity, academic_year_id)
         VALUES ($1, 9, $2, 'A', 50, $3)
         ON CONFLICT (school_id, grade_level, stream_id, section_name, academic_year_id) DO UPDATE SET capacity = 50
         RETURNING id`,
        [menelikSchoolId, streamMap['GENERAL'], mYearId]
      );

      // School 2 Teacher: teacher.biology@menelik.edu
      const mTeacherHash = await bcrypt.hash('Teacher@123', 10);
      let mTU = await client.query('SELECT id FROM users WHERE email = $1', ['teacher.biology@menelik.edu']);
      let mTUid;
      if (mTU.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, 'teacher.biology@menelik.edu', $2, 'teacher', 'Kassahun', 'Tefera', TRUE) RETURNING id`,
          [menelikSchoolId, mTeacherHash]
        );
        mTUid = ins.rows[0].id;
      } else {
        mTUid = mTU.rows[0].id;
      }

      await client.query(
        `INSERT INTO teachers (school_id, user_id, teacher_id, phone, qualification, specialization, years_of_experience, is_approved)
         VALUES ($1, $2, 'TCH-MNL-001', '+251912998877', 'MSc Biology', 'Cellular Biology', 9, TRUE)
         ON CONFLICT (teacher_id) DO NOTHING`,
        [menelikSchoolId, mTUid]
      );

      // School 2 Student: student.g9@menelik.edu
      const mStuHash = await bcrypt.hash('Student@123', 10);
      let mSU = await client.query('SELECT id FROM users WHERE email = $1', ['student.g9@menelik.edu']);
      let mSUid;
      if (mSU.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, 'student.g9@menelik.edu', $2, 'student', 'Abinet', 'Girma', TRUE) RETURNING id`,
          [menelikSchoolId, mStuHash]
        );
        mSUid = ins.rows[0].id;
      } else {
        mSUid = mSU.rows[0].id;
      }

      await client.query(
        `INSERT INTO students (school_id, user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, $2, 'STU-MNL-001', '2010-04-12', 'Male', '+251922334411', 'Arada, Addis Ababa', 'Girma Tadesse', '+251922334422', 9, $3, $4, TRUE, 'ACTIVE')
         ON CONFLICT (student_id) DO NOTHING`,
        [menelikSchoolId, mSUid, streamMap['GENERAL'], mSec9A.rows[0].id]
      );
      console.log('[SEED] School 2 (Menelik II High School) seeded with teacher and student.');

      // Audit Log for Platform Setup
      await client.query(
        `INSERT INTO audit_logs (school_id, action, entity_type, entity_id, details)
         VALUES (NULL, 'SYSTEM_INIT', 'PLATFORM', 'ALL', '{"message": "Multi-tenant SaaS platform seeded with Super Admin and multiple schools."}')`
      );
    });

    console.log('=== Database Seeding Complete and Verified ===');
  } catch (error) {
    console.error('Error during database seed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
