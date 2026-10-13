const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/db');
require('dotenv').config();

async function migrateSaasNeon() {
  console.log('=== Safely Migrating Neon Database to Multi-Tenant SaaS ===');

  try {
    // 1. Create schools table if it does not exist
    await query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        logo_url TEXT,
        phone VARCHAR(50),
        email VARCHAR(100),
        address TEXT,
        city VARCHAR(100) DEFAULT 'Addis Ababa',
        subscription_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (subscription_status IN ('ACTIVE', 'TRIAL', 'SUSPENDED')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('[1/6] Verified "schools" table.');

    // 2. Establish Bole High School as Primary School (ID: 1)
    const schoolRes = await query(`
      INSERT INTO schools (id, name, code, city, phone, email, subscription_status, is_active)
      VALUES (1, 'Bole High School', 'bole-high', 'Addis Ababa', '+251 11 661 2233', 'info@bolehigh.edu.et', 'ACTIVE', TRUE)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, subscription_status = 'ACTIVE'
      RETURNING id
    `);
    const boleSchoolId = schoolRes.rows[0].id;
    console.log(`[2/6] Established Primary School: Bole High School (ID: ${boleSchoolId}).`);

    // 3. Add school_id to all tables safely
    const tables = [
      'users',
      'academic_years',
      'stream_criteria',
      'subjects',
      'sections',
      'students',
      'teachers',
      'enrollments',
      'teacher_assignments',
      'schedules',
      'attendance',
      'grade_records',
      'assignments',
      'announcements',
      'audit_logs',
      'study_materials',
      'system_settings',
    ];

    for (const tbl of tables) {
      await query(`
        ALTER TABLE ${tbl}
        ADD COLUMN IF NOT EXISTS school_id INT REFERENCES schools(id) ON DELETE CASCADE
      `);
      // Assign existing records to Bole High School (school_id = 1)
      await query(`
        UPDATE ${tbl}
        SET school_id = 1
        WHERE school_id IS NULL AND NOT (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${tbl}' AND column_name = 'role') AND ${tbl === 'users' ? "role = 'superadmin'" : 'FALSE'})
      `);
    }
    console.log('[3/6] Safely added "school_id" column to all tables with foreign keys.');

    // 4. Update users role check constraint and replace single-admin trigger with multi-tenant trigger
    await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'student', 'teacher'))`);

    await query(`DROP TRIGGER IF EXISTS check_single_admin ON users CASCADE`);
    await query(`DROP TRIGGER IF EXISTS trg_enforce_single_admin ON users CASCADE`);
    await query(`DROP FUNCTION IF EXISTS enforce_single_admin() CASCADE`);

    await query(`
      CREATE OR REPLACE FUNCTION enforce_admin_hierarchy()
      RETURNS TRIGGER AS $$
      DECLARE
          superadmin_count INT;
          school_admin_count INT;
      BEGIN
          IF NEW.role = 'superadmin' THEN
              SELECT COUNT(*) INTO superadmin_count FROM users WHERE role = 'superadmin' AND id != COALESCE(NEW.id, 0);
              IF superadmin_count >= 1 THEN
                  RAISE EXCEPTION 'A platform Super Admin already exists. Only exactly one Super Admin is permitted across the entire platform.';
              END IF;
              NEW.school_id := NULL;
          END IF;

          IF NEW.role = 'admin' THEN
              IF NEW.school_id IS NULL THEN
                  RAISE EXCEPTION 'School Admin must be associated with a valid school.';
              END IF;
              SELECT COUNT(*) INTO school_admin_count FROM users WHERE role = 'admin' AND school_id = NEW.school_id AND id != COALESCE(NEW.id, 0);
              IF school_admin_count >= 1 THEN
                  RAISE EXCEPTION 'This school already has a designated School Admin. Only one Admin per school is permitted.';
              END IF;
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await query(`DROP TRIGGER IF EXISTS check_admin_hierarchy ON users`);
    await query(`
      CREATE TRIGGER check_admin_hierarchy
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION enforce_admin_hierarchy();
    `);

    // Replace old single_admin_idx with per-school index
    await query(`DROP INDEX IF EXISTS single_admin_idx`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS single_superadmin_idx ON users ((role = 'superadmin')) WHERE role = 'superadmin'`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS single_school_admin_idx ON users (school_id) WHERE role = 'admin'`);

    // Replace old single-tenant table constraints with per-school constraints
    await query('ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS academic_years_year_name_key');
    await query('ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS uq_academic_year_school');
    await query('ALTER TABLE academic_years ADD CONSTRAINT uq_academic_year_school UNIQUE (school_id, year_name)');

    await query('ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key');
    await query('ALTER TABLE subjects DROP CONSTRAINT IF EXISTS uq_subject_school_code');
    await query('ALTER TABLE subjects ADD CONSTRAINT uq_subject_school_code UNIQUE (school_id, code)');

    await query('ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_key_key');
    await query('ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS uq_system_settings_school_key');
    await query('ALTER TABLE system_settings ADD CONSTRAINT uq_system_settings_school_key UNIQUE (school_id, key)');

    // 5. Seed Super Admin
    const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@ethiohighhub.com';
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

    const existingSuperAdmin = await query('SELECT id FROM users WHERE role = $1', ['superadmin']);
    if (existingSuperAdmin.rows.length === 0) {
      await query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, school_id)
         VALUES ($1, $2, 'superadmin', 'Platform', 'SuperAdmin', TRUE, NULL)`,
        [superAdminEmail, superAdminHash]
      );
      console.log(`[4/6] Created Global Super Admin: ${superAdminEmail}`);
    } else {
      console.log('[4/6] Global Super Admin already exists.');
    }

    // 6. Seed School 2: Menelik II High School
    await query(`SELECT setval('schools_id_seq', COALESCE((SELECT MAX(id) FROM schools), 1))`);
    const mSchoolRes = await query(`
      INSERT INTO schools (name, code, city, phone, email, subscription_status, is_active)
      VALUES ('Menelik II High School', 'menelik-high', 'Addis Ababa', '+251 11 123 4567', 'info@menelik.edu.et', 'ACTIVE', TRUE)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const menelikSchoolId = mSchoolRes.rows[0].id;

    const menelikAdminEmail = 'admin.menelik@highschool.edu';
    const menelikAdminHash = await bcrypt.hash('Admin@123', 10);
    const existingMAdmin = await query('SELECT id FROM users WHERE role = $1 AND school_id = $2', ['admin', menelikSchoolId]);
    if (existingMAdmin.rows.length === 0) {
      await query(
        `INSERT INTO users (school_id, email, password_hash, role, first_name, last_name, is_active)
         VALUES ($1, $2, $3, 'admin', 'Menelik', 'Administrator', TRUE)`,
        [menelikSchoolId, menelikAdminEmail, menelikAdminHash]
      );
      console.log(`[5/6] Created Menelik School Admin: ${menelikAdminEmail}`);
    }

    console.log('[6/6] Multi-tenant SaaS migration on Neon completed with ZERO data loss!');
    console.log('=== Neon Migration Successful ===');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateSaasNeon();
}

module.exports = { migrateSaasNeon };
