const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../services/auditService');

/**
 * Super Admin: Platform Dashboard Analytics
 */
const getPlatformStats = async (req, res, next) => {
  try {
    const schoolsCountRes = await query(`
      SELECT 
        COUNT(*) as total_schools,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_schools,
        COUNT(CASE WHEN subscription_status = 'ACTIVE' THEN 1 END) as active_subscriptions,
        COUNT(CASE WHEN subscription_status = 'TRIAL' THEN 1 END) as trial_subscriptions,
        COUNT(CASE WHEN subscription_status = 'SUSPENDED' THEN 1 END) as suspended_subscriptions
      FROM schools
    `);

    const usersCountRes = await query(`
      SELECT 
        COUNT(CASE WHEN role = 'student' THEN 1 END) as total_students,
        COUNT(CASE WHEN role = 'teacher' THEN 1 END) as total_teachers,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_school_admins
      FROM users
    `);

    const sectionsCountRes = await query(`SELECT COUNT(*) as total_sections FROM sections`);
    const attendanceCountRes = await query(`SELECT COUNT(*) as total_attendance_records FROM attendance`);

    // Top schools summary
    const schoolsRes = await query(`
      SELECT 
        s.id, s.name, s.code, s.city, s.subscription_status, s.is_active, s.created_at,
        u.email as admin_email, u.first_name as admin_first_name, u.last_name as admin_last_name,
        (SELECT COUNT(*) FROM students stu WHERE stu.school_id = s.id) as student_count,
        (SELECT COUNT(*) FROM teachers tch WHERE tch.school_id = s.id) as teacher_count,
        (SELECT COUNT(*) FROM sections sec WHERE sec.school_id = s.id) as section_count
      FROM schools s
      LEFT JOIN users u ON u.school_id = s.id AND u.role = 'admin'
      ORDER BY s.created_at DESC
    `);

    res.json({
      success: true,
      stats: {
        totalSchools: parseInt(schoolsCountRes.rows[0].total_schools || 0, 10),
        activeSchools: parseInt(schoolsCountRes.rows[0].active_schools || 0, 10),
        activeSubscriptions: parseInt(schoolsCountRes.rows[0].active_subscriptions || 0, 10),
        trialSubscriptions: parseInt(schoolsCountRes.rows[0].trial_subscriptions || 0, 10),
        suspendedSubscriptions: parseInt(schoolsCountRes.rows[0].suspended_subscriptions || 0, 10),
        totalStudents: parseInt(usersCountRes.rows[0].total_students || 0, 10),
        totalTeachers: parseInt(usersCountRes.rows[0].total_teachers || 0, 10),
        totalSchoolAdmins: parseInt(usersCountRes.rows[0].total_school_admins || 0, 10),
        totalSections: parseInt(sectionsCountRes.rows[0].total_sections || 0, 10),
        totalAttendanceRecords: parseInt(attendanceCountRes.rows[0].total_attendance_records || 0, 10),
      },
      schools: schoolsRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        city: row.city,
        subscriptionStatus: row.subscription_status,
        isActive: row.is_active,
        createdAt: row.created_at,
        admin: row.admin_email
          ? {
              email: row.admin_email,
              name: `${row.admin_first_name || ''} ${row.admin_last_name || ''}`.trim(),
            }
          : null,
        studentCount: parseInt(row.student_count || 0, 10),
        teacherCount: parseInt(row.teacher_count || 0, 10),
        sectionCount: parseInt(row.section_count || 0, 10),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: List all schools with detailed statistics
 */
const getSchools = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        s.id, s.name, s.code, s.logo_url, s.phone, s.email, s.address, s.city, 
        s.subscription_status, s.is_active, s.created_at,
        u.id as admin_id, u.email as admin_email, u.first_name as admin_first_name, u.last_name as admin_last_name, u.phone as admin_phone,
        (SELECT COUNT(*) FROM students stu WHERE stu.school_id = s.id) as student_count,
        (SELECT COUNT(*) FROM teachers tch WHERE tch.school_id = s.id) as teacher_count,
        (SELECT COUNT(*) FROM sections sec WHERE sec.school_id = s.id) as section_count
      FROM schools s
      LEFT JOIN users u ON u.school_id = s.id AND u.role = 'admin'
      ORDER BY s.id ASC
    `);

    const formatted = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      logoUrl: row.logo_url,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      subscriptionStatus: row.subscription_status,
      isActive: row.is_active,
      createdAt: row.created_at,
      admin: row.admin_id
        ? {
            id: row.admin_id,
            email: row.admin_email,
            firstName: row.admin_first_name,
            lastName: row.admin_last_name,
            phone: row.admin_phone,
          }
        : null,
      studentCount: parseInt(row.student_count || 0, 10),
      teacherCount: parseInt(row.teacher_count || 0, 10),
      sectionCount: parseInt(row.section_count || 0, 10),
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Provision a Brand New High School Tenant + Single School Admin
 */
const createSchool = async (req, res, next) => {
  try {
    const {
      name,
      code,
      city = 'Addis Ababa',
      phone,
      email,
      address,
      subscriptionStatus = 'ACTIVE',
      adminEmail,
      adminPassword = 'Admin@123',
      adminFirstName = 'School',
      adminLastName = 'Administrator',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'School Name is required.' });
    }

    if (!adminEmail || !adminEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Initial School Admin Email is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid School Admin email address.' });
    }

    const cleanCode = (code || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check duplicate school code
    const existingCode = await query('SELECT id FROM schools WHERE code = $1', [cleanCode]);
    if (existingCode.rows.length > 0) {
      return res.status(400).json({ success: false, message: `A school with code "${cleanCode}" already exists.` });
    }

    // Check duplicate admin email
    const existingEmail = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [adminEmail.trim()]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Email "${adminEmail.trim()}" is already registered.` });
    }

    const adminHash = await bcrypt.hash(adminPassword.trim(), 10);

    const createdData = await withTransaction(async (client) => {
      // 1. Create School Record
      const schoolRes = await client.query(
        `INSERT INTO schools (name, code, city, phone, email, address, subscription_status, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING id, name, code, city, subscription_status, is_active, created_at`,
        [name.trim(), cleanCode, city.trim(), phone || null, email || null, address || null, subscriptionStatus]
      );
      const newSchool = schoolRes.rows[0];

      // 2. Create School Admin Account (Exactly 1 Admin guaranteed by trigger)
      const userRes = await client.query(
        `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
         VALUES ($1, $2, $3, 'admin', $4, $5, TRUE)
         RETURNING id, email, role, first_name, last_name`,
        [newSchool.id, adminEmail.trim(), adminHash, adminFirstName.trim(), adminLastName.trim()]
      );
      const newAdmin = userRes.rows[0];

      // 3. Provision Default Academic Year (2026-2027)
      const yearRes = await client.query(
        `INSERT INTO academic_years (school_id, year_name, is_current, start_date, end_date)
         VALUES ($1, '2026-2027', TRUE, '2026-09-01', '2027-06-30')
         RETURNING id`,
        [newSchool.id]
      );
      const newYearId = yearRes.rows[0].id;

      // 4. Provision Standard Ethiopian Curriculum Subjects for Grades 9 & 10
      const standardSubjects = [
        { code: 'MATH-9', name: 'Mathematics', grade: 9 },
        { code: 'ENG-9', name: 'English', grade: 9 },
        { code: 'PHY-9', name: 'Physics', grade: 9 },
        { code: 'CHEM-9', name: 'Chemistry', grade: 9 },
        { code: 'BIO-9', name: 'Biology', grade: 9 },
        { code: 'HIST-9', name: 'History', grade: 9 },
        { code: 'GEO-9', name: 'Geography', grade: 9 },
        { code: 'CIV-9', name: 'Civics', grade: 9 },
        { code: 'MATH-10', name: 'Mathematics', grade: 10 },
        { code: 'ENG-10', name: 'English', grade: 10 },
        { code: 'PHY-10', name: 'Physics', grade: 10 },
        { code: 'CHEM-10', name: 'Chemistry', grade: 10 },
        { code: 'BIO-10', name: 'Biology', grade: 10 },
      ];

      for (const sub of standardSubjects) {
        await client.query(
          `INSERT INTO subjects (school_id, code, name, grade_level)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [newSchool.id, sub.code, sub.name, sub.grade]
        );
      }

      // 5. Provision Starter Sections 9-A & 10-A
      const generalStreamRes = await client.query("SELECT id FROM streams WHERE code = 'GENERAL'");
      const generalStreamId = generalStreamRes.rows.length ? generalStreamRes.rows[0].id : null;

      if (generalStreamId) {
        await client.query(
          `INSERT INTO sections (school_id, grade_level, stream_id, section_name, capacity, academic_year_id)
           VALUES ($1, 9, $2, 'A', 50, $3)
           ON CONFLICT DO NOTHING`,
          [newSchool.id, generalStreamId, newYearId]
        );
      }

      return { school: newSchool, admin: newAdmin };
    });

    await logAudit({
      userId: req.user.id,
      schoolId: createdData.school.id,
      action: 'SCHOOL_PROVISIONED',
      entityType: 'SCHOOL',
      entityId: createdData.school.id,
      details: { schoolName: createdData.school.name, adminEmail: createdData.admin.email },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `School "${createdData.school.name}" and Admin account successfully created.`,
      data: createdData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Update School Status (Active/Suspended/Trial)
 */
const updateSchoolStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, subscriptionStatus } = req.body;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const updates = [];
    const params = [id];

    if (typeof isActive === 'boolean') {
      params.push(isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (subscriptionStatus && ['ACTIVE', 'TRIAL', 'SUSPENDED'].includes(subscriptionStatus)) {
      params.push(subscriptionStatus);
      updates.push(`subscription_status = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid status updates provided.' });
    }

    updates.push('updated_at = NOW()');

    const updateSql = `UPDATE schools SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const updated = await query(updateSql, params);

    await logAudit({
      userId: req.user.id,
      schoolId: id,
      action: 'SCHOOL_STATUS_UPDATED',
      entityType: 'SCHOOL',
      entityId: id,
      details: { isActive, subscriptionStatus },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'School status updated successfully.',
      data: updated.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Delete School
 */
const deleteSchool = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const schoolName = schoolRes.rows[0].name;

    await query('DELETE FROM schools WHERE id = $1', [id]);

    await logAudit({
      userId: req.user.id,
      schoolId: null,
      action: 'SCHOOL_DELETED',
      entityType: 'SCHOOL',
      entityId: id,
      details: { schoolName },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `School "${schoolName}" and all associated records have been removed.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlatformStats,
  getSchools,
  createSchool,
  updateSchoolStatus,
  deleteSchool,
};
