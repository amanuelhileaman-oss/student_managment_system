const bcrypt = require('bcryptjs');
const { query, withTransaction, pool } = require('../config/db');
require('dotenv').config();

async function seedDatabase() {
  console.log('=== Seeding High School Management System Database ===');

  try {
    await withTransaction(async (client) => {
      // 1. Seed Single Admin
      const adminEmail = process.env.ADMIN_EMAIL || 'aman12@gmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'aman1221';
      const adminHash = await bcrypt.hash(adminPassword, 10);

      const existingAdmin = await client.query('SELECT id, email FROM users WHERE role = $1', ['admin']);
      if (existingAdmin.rows.length === 0) {
        await client.query(
          `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
           VALUES ($1, $2, 'admin', 'System', 'Administrator', TRUE)`,
          [adminEmail, adminHash]
        );
        console.log(`[SEED] Created Single Admin: ${adminEmail}`);
      } else {
        console.log(`[SEED] Single Admin already exists: ${existingAdmin.rows[0].email}`);
      }

      // 2. Academic Year
      const yearRes = await client.query(
        `INSERT INTO academic_years (year_name, is_current, start_date, end_date)
         VALUES ('2026-2027', TRUE, '2026-09-01', '2027-06-30')
         ON CONFLICT (year_name) DO UPDATE SET is_current = TRUE
         RETURNING id`
      );
      const currentYearId = yearRes.rows[0].id;
      console.log(`[SEED] Academic Year: 2026-2027 (ID: ${currentYearId})`);

      // 3. High School Grades (Grade 8 strictly excluded)
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

      // 4. Streams
      const streamsData = [
        { code: 'GENERAL', name: 'General Stream', desc: 'Standard high-school foundation curriculum for Grades 9 and 10' },
        { code: 'NATURAL', name: 'Natural Stream', desc: 'Sciences, Engineering, and Advanced Mathematics focus for Grades 11 and 12' },
        { code: 'SOCIAL', name: 'Social Stream', desc: 'Social sciences, Humanities, Economics, and Law focus for Grades 11 and 12' },
      ];
      const streamMap = {};
      for (const s of streamsData) {
        const sRes = await client.query(
          `INSERT INTO streams (code, name, description) VALUES ($1, $2, $3)
           ON CONFLICT (code) DO UPDATE SET name = $2, description = $3
           RETURNING id, code`,
          [s.code, s.name, s.desc]
        );
        streamMap[s.code] = sRes.rows[0].id;
      }
      console.log('[SEED] Streams established: GENERAL, NATURAL, SOCIAL.');

      // 5. Stream Criteria (Admin Configured Rules)
      // Natural Stream: min overall 70%, Math >= 65, Physics >= 60, Chemistry >= 60, Biology >= 60
      await client.query(
        `INSERT INTO stream_criteria (stream_id, target_grade_level, min_overall_average, required_subjects_config)
         VALUES ($1, 11, 70.00, $2)
         ON CONFLICT DO NOTHING`,
        [
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

      // Social Stream: min overall 65%, History >= 60, Geography >= 60, Economics >= 60, Civics >= 60
      await client.query(
        `INSERT INTO stream_criteria (stream_id, target_grade_level, min_overall_average, required_subjects_config)
         VALUES ($1, 11, 65.00, $2)
         ON CONFLICT DO NOTHING`,
        [
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
      console.log('[SEED] Stream Criteria configured for Natural & Social Streams.');

      // 6. Subjects
      const subjectsData = [
        // Grade 9 General
        { code: 'MATH-9', name: 'Mathematics', grade: 9, stream: 'GENERAL' },
        { code: 'ENG-9', name: 'English', grade: 9, stream: 'GENERAL' },
        { code: 'PHY-9', name: 'Physics', grade: 9, stream: 'GENERAL' },
        { code: 'CHEM-9', name: 'Chemistry', grade: 9, stream: 'GENERAL' },
        { code: 'BIO-9', name: 'Biology', grade: 9, stream: 'GENERAL' },
        { code: 'HIST-9', name: 'History', grade: 9, stream: 'GENERAL' },
        { code: 'GEO-9', name: 'Geography', grade: 9, stream: 'GENERAL' },
        { code: 'CIV-9', name: 'Civics', grade: 9, stream: 'GENERAL' },

        // Grade 10 General
        { code: 'MATH-10', name: 'Mathematics', grade: 10, stream: 'GENERAL' },
        { code: 'ENG-10', name: 'English', grade: 10, stream: 'GENERAL' },
        { code: 'PHY-10', name: 'Physics', grade: 10, stream: 'GENERAL' },
        { code: 'CHEM-10', name: 'Chemistry', grade: 10, stream: 'GENERAL' },
        { code: 'BIO-10', name: 'Biology', grade: 10, stream: 'GENERAL' },
        { code: 'HIST-10', name: 'History', grade: 10, stream: 'GENERAL' },
        { code: 'GEO-10', name: 'Geography', grade: 10, stream: 'GENERAL' },
        { code: 'ECON-10', name: 'Economics', grade: 10, stream: 'GENERAL' },
        { code: 'CIV-10', name: 'Civics', grade: 10, stream: 'GENERAL' },

        // Grade 11 Natural
        { code: 'MATH-11-NAT', name: 'Advanced Mathematics', grade: 11, stream: 'NATURAL' },
        { code: 'PHY-11-NAT', name: 'Physics', grade: 11, stream: 'NATURAL' },
        { code: 'CHEM-11-NAT', name: 'Chemistry', grade: 11, stream: 'NATURAL' },
        { code: 'BIO-11-NAT', name: 'Biology', grade: 11, stream: 'NATURAL' },
        { code: 'ENG-11-NAT', name: 'English', grade: 11, stream: 'NATURAL' },

        // Grade 11 Social
        { code: 'MATH-11-SOC', name: 'General Mathematics', grade: 11, stream: 'SOCIAL' },
        { code: 'HIST-11-SOC', name: 'History', grade: 11, stream: 'SOCIAL' },
        { code: 'GEO-11-SOC', name: 'Geography', grade: 11, stream: 'SOCIAL' },
        { code: 'ECON-11-SOC', name: 'Economics', grade: 11, stream: 'SOCIAL' },
        { code: 'ENG-11-SOC', name: 'English', grade: 11, stream: 'SOCIAL' },
      ];

      const subjectMap = {};
      for (const sub of subjectsData) {
        const subRes = await client.query(
          `INSERT INTO subjects (code, name, grade_level, stream_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (code) DO UPDATE SET name = $2, grade_level = $3, stream_id = $4
           RETURNING id, code`,
          [sub.code, sub.name, sub.grade, streamMap[sub.stream]]
        );
        subjectMap[sub.code] = subRes.rows[0].id;
      }
      console.log('[SEED] High school subjects created.');

      // 7. Sections (Default capacity 50)
      const sectionsData = [
        // Grade 9 General
        { grade: 9, stream: 'GENERAL', name: 'A', cap: 50 },
        { grade: 9, stream: 'GENERAL', name: 'B', cap: 50 },
        { grade: 9, stream: 'GENERAL', name: 'C', cap: 50 },
        { grade: 9, stream: 'GENERAL', name: 'D', cap: 50 },

        // Grade 10 General
        { grade: 10, stream: 'GENERAL', name: 'A', cap: 50 },
        { grade: 10, stream: 'GENERAL', name: 'B', cap: 50 },

        // Grade 11 Natural & Social
        { grade: 11, stream: 'NATURAL', name: 'A', cap: 50 },
        { grade: 11, stream: 'NATURAL', name: 'B', cap: 50 },
        { grade: 11, stream: 'SOCIAL', name: 'A', cap: 50 },
        { grade: 11, stream: 'SOCIAL', name: 'B', cap: 50 },

        // Grade 12 Natural & Social
        { grade: 12, stream: 'NATURAL', name: 'A', cap: 50 },
        { grade: 12, stream: 'SOCIAL', name: 'A', cap: 50 },
      ];

      const sectionMap = {};
      for (const sec of sectionsData) {
        const secRes = await client.query(
          `INSERT INTO sections (grade_level, stream_id, section_name, capacity, academic_year_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (grade_level, stream_id, section_name, academic_year_id)
           DO UPDATE SET capacity = $4
           RETURNING id, section_name, grade_level, stream_id`,
          [sec.grade, streamMap[sec.stream], sec.name, sec.cap, currentYearId]
        );
        sectionMap[`${sec.grade}-${sec.stream}-${sec.name}`] = secRes.rows[0].id;
      }
      console.log('[SEED] Sections established with default capacity 50.');

      // 8. Prerequisites (Grade 8 Official Ministry Records)
      const prereqs = [
        { id: 'STU-2026-001', name: 'Dawit Bekele', school: 'Addis Primary', year: 2026, total: 620, avg: 88.57, status: 'PASSED' },
        { id: 'STU-2026-002', name: 'Sara Haile', school: 'Bole Primary', year: 2026, total: 580, avg: 82.85, status: 'PASSED' },
        { id: 'STU-2026-003', name: 'Yonatan Alemu', school: 'Hawassa Primary', year: 2026, total: 290, avg: 41.42, status: 'FAILED' },
        { id: 'STU-2026-004', name: 'Meron Tesfaye', school: 'Arada Primary', year: 2026, total: 540, avg: 77.14, status: 'PASSED' },
        { id: 'STU-2026-010', name: 'Natnael Desta', school: 'Menelik Primary', year: 2025, total: 640, avg: 91.42, status: 'PASSED' },
        { id: 'STU-2026-011', name: 'Bethlehem Girma', school: 'Yeka Primary', year: 2025, total: 510, avg: 72.85, status: 'PASSED' },
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

      // 9. Teachers
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
            `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
             VALUES ($1, $2, 'teacher', $3, $4, TRUE) RETURNING id`,
            [t.email, hash, t.first_name, t.last_name]
          );
          uid = ins.rows[0].id;
        } else {
          uid = uRes.rows[0].id;
        }

        const tRes = await client.query(
          `INSERT INTO teachers (user_id, teacher_id, phone, qualification, specialization, years_of_experience, is_approved)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           ON CONFLICT (teacher_id) DO UPDATE SET qualification = $4, specialization = $5
           RETURNING id, teacher_id`,
          [uid, t.tid, t.phone, t.qualification, t.specialization, t.years]
        );
        teacherMap[t.tid] = tRes.rows[0].id;
      }
      console.log('[SEED] Teachers seeded (Math, Physics, History).');

      // 10. Teacher Assignments
      // Abebe Kebede -> Math-9 to Section A and Section B
      const g9SecA = sectionMap['9-GENERAL-A'];
      const g9SecB = sectionMap['9-GENERAL-B'];
      const subMath9 = subjectMap['MATH-9'];

      const assign1 = await client.query(
        `INSERT INTO teacher_assignments (teacher_id, subject_id, section_id, academic_year_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO NOTHING
         RETURNING id`,
        [teacherMap['TCH-2026-001'], subMath9, g9SecA, currentYearId]
      );
      const assign1Id = assign1.rows.length ? assign1.rows[0].id : (await client.query(
        `SELECT id FROM teacher_assignments WHERE teacher_id = $1 AND subject_id = $2 AND section_id = $3`,
        [teacherMap['TCH-2026-001'], subMath9, g9SecA]
      )).rows[0].id;

      await client.query(
        `INSERT INTO teacher_assignments (teacher_id, subject_id, section_id, academic_year_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO NOTHING`,
        [teacherMap['TCH-2026-001'], subMath9, g9SecB, currentYearId]
      );

      // Helen Mengistu -> Physics-10 to Section A
      const g10SecA = sectionMap['10-GENERAL-A'];
      const subPhy10 = subjectMap['PHY-10'];
      await client.query(
        `INSERT INTO teacher_assignments (teacher_id, subject_id, section_id, academic_year_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) DO NOTHING`,
        [teacherMap['TCH-2026-002'], subPhy10, g10SecA, currentYearId]
      );
      console.log('[SEED] Teacher Assignments created.');

      // 11. Schedules
      await client.query(
        `INSERT INTO schedules (teacher_assignment_id, day_of_week, start_time, end_time, period_number, room_number)
         VALUES
           ($1, 'Monday', '08:30:00', '09:30:00', 1, 'Room 101'),
           ($1, 'Wednesday', '09:30:00', '10:30:00', 2, 'Room 101'),
           ($1, 'Friday', '11:00:00', '12:00:00', 3, 'Room 101')
         ON CONFLICT DO NOTHING`,
        [assign1Id]
      );
      console.log('[SEED] Schedules configured.');

      // 12. Students
      // Student 1: Dawit Bekele (Grade 9 General, Section A)
      const pwHash = await bcrypt.hash('Student@123', 10);
      let s1User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g9@highschool.edu']);
      let s1Uid;
      if (s1User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
           VALUES ('student.g9@highschool.edu', $1, 'student', 'Dawit', 'Bekele', TRUE) RETURNING id`,
          [pwHash]
        );
        s1Uid = ins.rows[0].id;
      } else {
        s1Uid = s1User.rows[0].id;
      }

      const s1Res = await client.query(
        `INSERT INTO students (user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, 'STU-2026-001', '2010-05-14', 'Male', '+251911001122', 'Bole Sub-city, Addis Ababa', 'Bekele Wolde', '+251911998877', 9, $2, $3, TRUE, 'ACTIVE')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $3
         RETURNING id`,
        [s1Uid, streamMap['GENERAL'], g9SecA]
      );
      const student1Id = s1Res.rows[0].id;

      // Enroll student 1 in section A
      await client.query(
        `INSERT INTO enrollments (student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, 9, $3, $4, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [student1Id, g9SecA, streamMap['GENERAL'], currentYearId]
      );

      // Student 2: Sara Haile (Grade 9 General, Section B)
      let s2User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g9b@highschool.edu']);
      let s2Uid;
      if (s2User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
           VALUES ('student.g9b@highschool.edu', $1, 'student', 'Sara', 'Haile', TRUE) RETURNING id`,
          [pwHash]
        );
        s2Uid = ins.rows[0].id;
      } else {
        s2Uid = s2User.rows[0].id;
      }
      const s2Res = await client.query(
        `INSERT INTO students (user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, 'STU-2026-002', '2010-08-20', 'Female', '+251922112233', 'Yeka Sub-city, Addis Ababa', 'Haile Tadesse', '+251922887766', 9, $2, $3, TRUE, 'ACTIVE')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $3
         RETURNING id`,
        [s2Uid, streamMap['GENERAL'], g9SecB]
      );
      const student2Id = s2Res.rows[0].id;
      await client.query(
        `INSERT INTO enrollments (student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, 9, $3, $4, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [student2Id, g9SecB, streamMap['GENERAL'], currentYearId]
      );

      // Student 3: Natnael Desta (Grade 10 High Science - Natural Stream Eligible)
      let s3User = await client.query('SELECT id FROM users WHERE email = $1', ['student.g10.natural@highschool.edu']);
      let s3Uid;
      if (s3User.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
           VALUES ('student.g10.natural@highschool.edu', $1, 'student', 'Natnael', 'Desta', TRUE) RETURNING id`,
          [pwHash]
        );
        s3Uid = ins.rows[0].id;
      } else {
        s3Uid = s3User.rows[0].id;
      }
      const s3Res = await client.query(
        `INSERT INTO students (user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, 'STU-2026-010', '2009-03-10', 'Male', '+251933112233', 'Kirkos, Addis Ababa', 'Desta Kassa', '+251933887766', 10, $2, $3, TRUE, 'PROMOTED')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $3
         RETURNING id`,
        [s3Uid, streamMap['GENERAL'], g10SecA]
      );
      const student3Id = s3Res.rows[0].id;
      await client.query(
        `INSERT INTO enrollments (student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, 10, $3, $4, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [student3Id, g10SecA, streamMap['GENERAL'], currentYearId]
      );

      // Seed Grade 10 results for Natnael Desta (High marks in Math 92, Physics 88, Chem 85, Bio 87, Eng 80, Hist 75, Geo 78, Civ 82 => Avg ~ 83.4%)
      const g10Subs = ['MATH-10', 'PHY-10', 'CHEM-10', 'BIO-10', 'ENG-10', 'HIST-10', 'GEO-10', 'CIV-10'];
      const natnaelScores = [92, 88, 85, 87, 80, 75, 78, 82];
      for (let i = 0; i < g10Subs.length; i++) {
        const subId = subjectMap[g10Subs[i]];
        const score = natnaelScores[i];
        await client.query(
          `INSERT INTO grade_records (student_id, subject_id, section_id, academic_year_id, semester, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks)
           VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, 'Excellent performance')
           ON CONFLICT (student_id, subject_id, academic_year_id, semester) DO UPDATE SET total_score = $9`,
          [
            student3Id,
            subId,
            g10SecA,
            currentYearId,
            score * 0.1, // quiz
            score * 0.3, // midterm
            score * 0.2, // assignment
            score * 0.4, // final
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
          `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
           VALUES ('student.g10.social@highschool.edu', $1, 'student', 'Bethlehem', 'Girma', TRUE) RETURNING id`,
          [pwHash]
        );
        s4Uid = ins.rows[0].id;
      } else {
        s4Uid = s4User.rows[0].id;
      }
      const s4Res = await client.query(
        `INSERT INTO students (user_id, student_id, date_of_birth, gender, phone, address, guardian_name, guardian_phone, current_grade_level, current_stream_id, current_section_id, prerequisite_verified, promotion_status)
         VALUES ($1, 'STU-2026-011', '2009-07-22', 'Female', '+251944112233', 'Nifas Silk, Addis Ababa', 'Girma Assefa', '+251944887766', 10, $2, $3, TRUE, 'PROMOTED')
         ON CONFLICT (student_id) DO UPDATE SET current_section_id = $3
         RETURNING id`,
        [s4Uid, streamMap['GENERAL'], g10SecA]
      );
      const student4Id = s4Res.rows[0].id;
      await client.query(
        `INSERT INTO enrollments (student_id, section_id, grade_level, stream_id, academic_year_id, status)
         VALUES ($1, $2, 10, $3, $4, 'ENROLLED')
         ON CONFLICT (student_id, academic_year_id, grade_level) DO NOTHING`,
        [student4Id, g10SecA, streamMap['GENERAL'], currentYearId]
      );

      // Seed Grade 10 results for Bethlehem (Low science: Math 52, Physics 48, Chem 50, Bio 54; High social: History 88, Geo 85, Econ 84, Civics 89 => Avg ~ 68.75%)
      const bethSubs = ['MATH-10', 'PHY-10', 'CHEM-10', 'BIO-10', 'ENG-10', 'HIST-10', 'GEO-10', 'ECON-10', 'CIV-10'];
      const bethScores = [52, 48, 50, 54, 75, 88, 85, 84, 89];
      for (let i = 0; i < bethSubs.length; i++) {
        const subId = subjectMap[bethSubs[i]];
        const score = bethScores[i];
        await client.query(
          `INSERT INTO grade_records (student_id, subject_id, section_id, academic_year_id, semester, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks)
           VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, 'Eligible for Social Stream')
           ON CONFLICT (student_id, subject_id, academic_year_id, semester) DO UPDATE SET total_score = $9`,
          [
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
      console.log('[SEED] Test students seeded with Grade 9 & Grade 10 academic records.');

      // 13. Assignments & Group Assignment (With Group Code & Automatic Score Propagation)
      const assignRes = await client.query(
        `INSERT INTO assignments (teacher_assignment_id, title, description, assignment_type, max_score, due_date, instructions)
         VALUES ($1, 'Linear Equations Project', 'Collaborative algebra modeling project', 'GROUP', 20.00, NOW() + INTERVAL '14 days', 'Work in assigned groups. Submit written derivation and presentation.')
         RETURNING id`,
        [assign1Id]
      );
      const assignmentId = assignRes.rows[0].id;

      // Create Group: GROUP-MATH9-A-001
      const groupRes = await client.query(
        `INSERT INTO assignment_groups (assignment_id, group_code, group_name, group_score, evaluated_at)
         VALUES ($1, 'GROUP-MATH9-A-001', 'Algebra Team Alpha', 18.00, NOW())
         ON CONFLICT (group_code) DO UPDATE SET group_score = 18.00
         RETURNING id`,
        [assignmentId]
      );
      const groupId = groupRes.rows[0].id;

      // Add Dawit Bekele to group
      await client.query(
        `INSERT INTO assignment_group_members (group_id, student_id)
         VALUES ($1, $2)
         ON CONFLICT (group_id, student_id) DO NOTHING`,
        [groupId, student1Id]
      );

      // Record Grade for Dawit in Math-9
      await client.query(
        `INSERT INTO grade_records (student_id, subject_id, section_id, academic_year_id, semester, quiz_score, midterm_score, assignment_score, final_score, total_score, letter_grade, remarks)
         VALUES ($1, $2, $3, $4, 1, 9.5, 27.5, 18.0, 36.0, 91.0, 'A+', 'Outstanding collaborative group work')
         ON CONFLICT (student_id, subject_id, academic_year_id, semester) DO UPDATE SET
           assignment_score = 18.0, total_score = 91.0, letter_grade = 'A+'`,
        [student1Id, subMath9, g9SecA, currentYearId]
      );
      console.log('[SEED] Group Assignment and Group Code GROUP-MATH9-A-001 created.');

      // 14. Announcements
      await client.query(
        `INSERT INTO announcements (title, content, target_audience, created_at)
         VALUES ('Welcome to Academic Year 2026-2027', 'The new school year has officially commenced. All students must complete section registration and verify their schedules.', 'ALL', NOW())`
      );

      // 15. System Settings
      const defaultSettings = [
        { key: 'school_name', val: { name: 'Addis International High School' }, desc: 'Official School Name' },
        { key: 'default_section_capacity', val: { capacity: 50 }, desc: 'Standard maximum student capacity per section' },
        { key: 'grading_policy', val: { quiz_weight: 10, midterm_weight: 30, assignment_weight: 20, final_weight: 40 }, desc: 'Academic grading weights' },
        { key: 'prerequisite_min_pass_gpa', val: { min_gpa: 50.0 }, desc: 'Minimum Grade 8 GPA required for Grade 9 admission' },
      ];
      for (const s of defaultSettings) {
        await client.query(
          `INSERT INTO system_settings (key, value, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, description = $3`,
          [s.key, JSON.stringify(s.val), s.desc]
        );
      }
      console.log('[SEED] System settings configured.');

      // 16. Audit Log
      await client.query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, details)
         VALUES ('SYSTEM_INIT', 'DATABASE', 'ALL', '{"message": "Initial database seed completed successfully."}')`
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
