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
        s.id, s.name, s.code, s.city, s.subscription_status, s.subscription_plan,
        s.subscription_started_at, s.subscription_expires_at, s.is_active, s.created_at,
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
      schools: schoolsRes.rows.map((row) => {
        let daysRemaining = 0;
        let isExpired = false;
        if (row.subscription_expires_at) {
          const diffTime = new Date(row.subscription_expires_at) - new Date();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 0) {
            isExpired = true;
            daysRemaining = 0;
          }
        }
        return {
          id: row.id,
          name: row.name,
          code: row.code,
          city: row.city,
          subscriptionStatus: row.subscription_status,
          subscriptionPlan: row.subscription_plan || 'STANDARD',
          subscriptionExpiresAt: row.subscription_expires_at,
          daysRemaining,
          isExpired,
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
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Manually extend or renew a school's license (e.g. for Offline Bank Wire, Cash, Cheque, or Grant)
 */
const extendSchoolSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { months = 12, planName = 'ANNUAL', paymentMethod = 'OFFLINE_BANK_WIRE', amount = 0, notes = '' } = req.body;
    const superAdminId = req.user.id;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School tenant not found.' });
    }
    const school = schoolRes.rows[0];

    // Compute new expiration date:
    // If current expiry is in the future, add to it; otherwise add to now
    const now = new Date();
    const currentExpiry = school.subscription_expires_at && new Date(school.subscription_expires_at) > now
      ? new Date(school.subscription_expires_at)
      : now;

    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + parseInt(months, 10));

    // Update school record
    await query(
      `UPDATE schools 
       SET subscription_status = 'ACTIVE',
           subscription_plan = $1,
           subscription_expires_at = $2,
           is_active = TRUE
       WHERE id = $3`,
      [planName, newExpiry.toISOString(), id]
    );

    // Record in school_payments so both Super Admin and School Admin have an official paper trail
    const txRef = `OFFLINE-${school.id}-${Date.now()}`;
    const BANK_METHOD_LABELS = {
      CBE: 'Commercial Bank of Ethiopia (CBE)',
      AWASH: 'Awash Bank (Awash Birr)',
      ABYSSINIA: 'Bank of Abyssinia (BoA)',
      DASHEN: 'Dashen Bank (Amole)',
      COOP: 'Cooperative Bank of Oromia (CoopPay)',
      TELEBIRR: 'Telebirr Direct Transfer',
      HIBRET: 'Hibret Bank',
      WEGAGEN: 'Wegagen Bank',
      ZEMEN: 'Zemen Bank',
      OROMIA: 'Oromia Bank',
      AMHARA: 'Amhara Bank',
      NIB: 'Nib International Bank',
      GLOBAL: 'Global Bank Ethiopia',
      CASH: 'In-Person Cash Payment',
      CHEQUE: 'Certified Bank Cheque (CPO)',
      GRANT: 'Free Education Bureau Grant / Voucher',
      OFFLINE_BANK_WIRE: 'CBE Bank Wire',
    };
    const methodLabel = BANK_METHOD_LABELS[paymentMethod] || paymentMethod || 'Bank Wire Transfer';

    const paymentRes = await query(
      `INSERT INTO school_payments 
       (school_id, user_id, plan_name, plan_duration_months, amount, currency, tx_ref, payment_status, payment_method, paid_at)
       VALUES ($1, $2, $3, $4, $5, 'ETB', $6, 'SUCCESS', $7, NOW())
       RETURNING *`,
      [
        school.id,
        superAdminId,
        planName,
        parseInt(months, 10),
        parseFloat(amount) || 0,
        txRef,
        methodLabel,
      ]
    );

    await logAudit({
      userId: superAdminId,
      action: 'SUBSCRIPTION_EXTENDED_OFFLINE',
      entityType: 'SCHOOL',
      entityId: school.id,
      details: { schoolName: school.name, months, newExpiry, amount, notes, txRef },
    });

    res.json({
      success: true,
      message: `Successfully extended subscription for ${school.name} by ${months} months! Valid until ${newExpiry.toLocaleDateString()}.`,
      data: {
        schoolId: school.id,
        subscriptionExpiresAt: newExpiry,
        payment: paymentRes.rows[0],
      },
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
      subscriptionStatus = 'PENDING_PAYMENT',
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

      // 3. Provision Default Academic Calendar Year (2026-2027) for the school
      await client.query(
        `INSERT INTO academic_years (school_id, year_name, is_current, start_date, end_date)
         VALUES ($1, '2026-2027', TRUE, '2026-09-01', '2027-06-30')
         RETURNING id`,
        [newSchool.id]
      );

      // Clean Slate: No auto-seeded subjects or starter sections.
      // Curriculum subjects and section capacities are fully configured and managed by the School Administrator.

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

    if (subscriptionStatus && ['ACTIVE', 'TRIAL', 'SUSPENDED', 'PENDING_PAYMENT'].includes(subscriptionStatus)) {
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
 * Super Admin: Delete School (Safe deletion with transaction)
 */
const deleteSchool = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const schoolName = schoolRes.rows[0].name;
    const schoolCode = schoolRes.rows[0].code;

    await withTransaction(async (client) => {
      // 1. Delete school payments first to prevent foreign key errors
      await client.query('DELETE FROM school_payments WHERE school_id = $1', [id]);
      // 2. Delete school (cascades cleanly to users, students, teachers, sections, etc.)
      await client.query('DELETE FROM schools WHERE id = $1', [id]);
    });

    await logAudit({
      userId: req.user.id,
      schoolId: null,
      action: 'SCHOOL_DELETED',
      entityType: 'SCHOOL',
      entityId: id,
      details: { schoolName, schoolCode },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `School "${schoolName}" and all associated records have been safely removed.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Get all schools with compliance status and resource counts for the Actions component
 */
const getActionSchools = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        s.id, s.name, s.code, s.logo_url, s.phone, s.email, s.address, s.city, 
        s.subscription_status, s.is_active, s.created_at,
        s.compliance_status, s.violation_reason, s.violation_date,
        u.id as admin_id, u.email as admin_email, u.first_name as admin_first_name, u.last_name as admin_last_name, u.phone as admin_phone,
        (SELECT COUNT(*) FROM students stu WHERE stu.school_id = s.id) as student_count,
        (SELECT COUNT(*) FROM teachers tch WHERE tch.school_id = s.id) as teacher_count,
        (SELECT COUNT(*) FROM sections sec WHERE sec.school_id = s.id) as section_count,
        (SELECT COUNT(*) FROM school_payments sp WHERE sp.school_id = s.id) as payment_count
      FROM schools s
      LEFT JOIN users u ON u.school_id = s.id AND u.role = 'admin'
      ORDER BY 
        CASE 
          WHEN s.compliance_status = 'SUSPENDED' THEN 1
          WHEN s.compliance_status = 'WARNING_ISSUED' THEN 2
          WHEN s.subscription_status = 'SUSPENDED' THEN 3
          ELSE 4 
        END,
        s.id ASC
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
      complianceStatus: row.compliance_status || (row.is_active ? 'COMPLIANT' : 'SUSPENDED'),
      violationReason: row.violation_reason,
      violationDate: row.violation_date,
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
      paymentCount: parseInt(row.payment_count || 0, 10),
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action: Issue Official Rule Breach Warning
 */
const issueSchoolWarning = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, category, deadlineDays } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify the rule breach reason.' });
    }

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }
    const school = schoolRes.rows[0];

    const days = parseInt(deadlineDays, 10) || 7;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);

    await query(
      `UPDATE schools 
       SET compliance_status = 'WARNING_ISSUED',
           violation_reason = $1,
           violation_date = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [reason.trim(), id]
    );

    // Send official announcement to the school's admin & staff
    try {
      await query(
        `INSERT INTO announcements (school_id, title, content, target_audience, priority, created_by)
         VALUES ($1, $2, $3, 'ALL', 'HIGH', $4)`,
        [
          id,
          'URGENT: Super Admin Disciplinary Notice - Rule Breach Warning',
          `An official rule violation warning has been issued to ${school.name} by Platform Super Administration.\n\nViolation Details: ${reason.trim()}\n\nRectification Deadline: Within ${days} days (${deadline.toLocaleDateString()}). Failure to comply will result in account suspension or platform termination.`,
          req.user.id,
        ]
      );
    } catch (annErr) {
      console.warn('Notice announcement fallback warning:', annErr.message);
    }

    const actionRes = await query(
      `INSERT INTO school_disciplinary_actions 
       (school_id, school_name, school_code, action_type, violation_category, violation_reason, resolution_deadline, executed_by, details)
       VALUES ($1, $2, $3, 'WARNING', $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        school.name,
        school.code,
        category || 'POLICY_BREACH',
        reason.trim(),
        deadline,
        req.user.id,
        JSON.stringify({ deadlineDays: days }),
      ]
    );

    await logAudit({
      userId: req.user.id,
      schoolId: id,
      action: 'SCHOOL_RULE_WARNING_ISSUED',
      entityType: 'SCHOOL',
      entityId: id,
      details: { schoolName: school.name, reason, category, deadline },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Official rule breach warning issued to "${school.name}". School has ${days} days to resolve.`,
      data: actionRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action: Suspend School Access for Rule Breach
 */
const suspendSchoolForBreach = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, category } = req.body;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }
    const school = schoolRes.rows[0];

    const breachReason = reason && reason.trim() ? reason.trim() : 'Suspended due to breach of terms and rules.';

    await query(
      `UPDATE schools 
       SET is_active = FALSE,
           subscription_status = 'SUSPENDED',
           compliance_status = 'SUSPENDED',
           violation_reason = $1,
           violation_date = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [breachReason, id]
    );

    const actionRes = await query(
      `INSERT INTO school_disciplinary_actions 
       (school_id, school_name, school_code, action_type, violation_category, violation_reason, executed_by, details)
       VALUES ($1, $2, $3, 'SUSPEND', $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        school.name,
        school.code,
        category || 'RULE_BREACH_SUSPENSION',
        breachReason,
        req.user.id,
        JSON.stringify({ suspendedAt: new Date().toISOString() }),
      ]
    );

    await logAudit({
      userId: req.user.id,
      schoolId: id,
      action: 'SCHOOL_SUSPENDED_FOR_BREACH',
      entityType: 'SCHOOL',
      entityId: id,
      details: { schoolName: school.name, breachReason, category },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `School "${school.name}" has been SUSPENDED. All administrative and student portal access is frozen.`,
      data: actionRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action: Restore School Standing
 */
const restoreSchoolStanding = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }
    const school = schoolRes.rows[0];

    await query(
      `UPDATE schools 
       SET is_active = TRUE,
           subscription_status = 'ACTIVE',
           compliance_status = 'COMPLIANT',
           violation_reason = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    const actionRes = await query(
      `INSERT INTO school_disciplinary_actions 
       (school_id, school_name, school_code, action_type, violation_category, violation_reason, executed_by, details)
       VALUES ($1, $2, $3, 'RESTORE', 'REINSTATED', $4, $5, $6)
       RETURNING *`,
      [
        id,
        school.name,
        school.code,
        notes || 'Rule compliance verified. Standing fully restored.',
        req.user.id,
        JSON.stringify({ restoredAt: new Date().toISOString() }),
      ]
    );

    await logAudit({
      userId: req.user.id,
      schoolId: id,
      action: 'SCHOOL_RESTORED_TO_GOOD_STANDING',
      entityType: 'SCHOOL',
      entityId: id,
      details: { schoolName: school.name, notes },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `School "${school.name}" restored to Active and Compliant standing!`,
      data: actionRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action: Safe Delete School with Code Confirmation
 */
const safeDeleteSchool = async (req, res, next) => {
  try {
    const { id } = req.params;
    const confirmCode = req.body.confirmCode || req.body.confirmationCode;
    const { reason, category } = req.body;

    const schoolRes = await query('SELECT * FROM schools WHERE id = $1', [id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const school = schoolRes.rows[0];

    // Double check confirmation code
    if (!confirmCode || confirmCode.trim().toUpperCase() !== school.code.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: `Deletion authorization mismatch. You must type "${school.code}" to safely authorize deletion.`,
      });
    }

    const schoolName = school.name;
    const schoolCode = school.code;
    const violationReason = reason || 'Rule breach and termination by Super Admin';
    const violationCategory = category || 'CONTRACT_TERMINATION';

    await withTransaction(async (client) => {
      // 1. Delete school payments first to avoid foreign key issues
      await client.query('DELETE FROM school_payments WHERE school_id = $1', [id]);

      // 2. Log disciplinary action before deleting the school row
      await client.query(
        `INSERT INTO school_disciplinary_actions 
         (school_id, school_name, school_code, action_type, violation_category, violation_reason, executed_by, details)
         VALUES ($1, $2, $3, 'SAFE_DELETE', $4, $5, $6, $7)`,
        [
          id,
          schoolName,
          schoolCode,
          violationCategory,
          violationReason,
          req.user.id,
          JSON.stringify({ deletedAt: new Date().toISOString(), schoolCode }),
        ]
      );

      // 3. Delete school (cascades to all other tables)
      await client.query('DELETE FROM schools WHERE id = $1', [id]);
    });

    await logAudit({
      userId: req.user.id,
      schoolId: null,
      action: 'SCHOOL_RULE_BREACH_DELETED',
      entityType: 'SCHOOL',
      entityId: id,
      details: { schoolName, schoolCode, violationReason, violationCategory },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `School "${schoolName}" (${schoolCode}) and its related records have been safely deleted without affecting other schools.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action: System & School Cleanup of Unnecessary Records
 */
const performSystemCleanup = async (req, res, next) => {
  try {
    const { cleanupType, schoolId, targetScope } = req.body;
    let itemsAffected = 0;
    let description = '';

    if (cleanupType === 'FAILED_PAYMENTS') {
      // Clear abandoned pending payments older than 3 days
      const del = await query(
        `DELETE FROM school_payments 
         WHERE payment_status IN ('PENDING', 'FAILED') 
           AND created_at < NOW() - INTERVAL '3 days'
         RETURNING id`
      );
      itemsAffected = del.rowCount || del.rows.length;
      description = `Purged ${itemsAffected} stale/failed payment records older than 3 days.`;
    } else if (cleanupType === 'ORPHAN_USERS') {
      // Find users with invalid school_id that are not superadmin
      const del = await query(
        `DELETE FROM users 
         WHERE role != 'superadmin' 
           AND (school_id IS NULL OR school_id NOT IN (SELECT id FROM schools))
         RETURNING id`
      );
      itemsAffected = del.rowCount || del.rows.length;
      description = `Removed ${itemsAffected} orphaned accounts unlinked to valid schools.`;
    } else if (cleanupType === 'SCHOOL_ACADEMIC_TEST_DATA') {
      if (!schoolId) {
        return res.status(400).json({ success: false, message: 'School ID is required for academic test data cleanup.' });
      }
      const schoolCheck = await query('SELECT name, code FROM schools WHERE id = $1', [schoolId]);
      if (schoolCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'School not found.' });
      }

      await withTransaction(async (client) => {
        const d1 = await client.query('DELETE FROM attendance WHERE school_id = $1 RETURNING id', [schoolId]);
        const d2 = await client.query('DELETE FROM grade_records WHERE school_id = $1 RETURNING id', [schoolId]);
        const d3 = await client.query('DELETE FROM assignments WHERE school_id = $1 RETURNING id', [schoolId]);
        const d4 = await client.query('DELETE FROM study_materials WHERE school_id = $1 RETURNING id', [schoolId]);
        itemsAffected = (d1.rowCount || 0) + (d2.rowCount || 0) + (d3.rowCount || 0) + (d4.rowCount || 0);
      });
      description = `Cleared ${itemsAffected} mock/test academic records (attendance, grades, assignments, materials) for "${schoolCheck.rows[0].name}".`;
    } else if (cleanupType === 'STALE_AUDIT_LOGS') {
      const del = await query(
        `DELETE FROM audit_logs 
         WHERE created_at < NOW() - INTERVAL '60 days'
         RETURNING id`
      );
      itemsAffected = del.rowCount || del.rows.length;
      description = `Purged ${itemsAffected} legacy audit log entries older than 60 days.`;
    } else {
      return res.status(400).json({ success: false, message: 'Unknown cleanup type.' });
    }

    // Log disciplinary / cleanup action
    await query(
      `INSERT INTO school_disciplinary_actions 
       (school_id, school_name, school_code, action_type, violation_category, violation_reason, executed_by, details)
       VALUES ($1, $2, 'SYSTEM', 'CLEANUP_DATA', $3, $4, $5, $6)`,
      [
        schoolId || null,
        schoolId ? `School ID #${schoolId}` : 'Platform System',
        cleanupType,
        description,
        req.user.id,
        JSON.stringify({ itemsAffected, cleanupType, targetScope }),
      ]
    );

    res.json({
      success: true,
      message: description,
      itemsAffected,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action: Get Disciplinary and Actions Audit Logs
 */
const getDisciplinaryLogs = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        a.id, a.school_id, a.school_name, a.school_code, 
        a.action_type, a.violation_category, a.violation_reason, 
        a.resolution_deadline, a.details, a.created_at,
        u.email as executed_by_email, u.first_name as executed_by_name
      FROM school_disciplinary_actions a
      LEFT JOIN users u ON a.executed_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlatformStats,
  getSchools,
  createSchool,
  updateSchoolStatus,
  extendSchoolSubscription,
  deleteSchool,
  getActionSchools,
  issueSchoolWarning,
  suspendSchoolForBreach,
  restoreSchoolStanding,
  safeDeleteSchool,
  performSystemCleanup,
  getDisciplinaryLogs,
};
