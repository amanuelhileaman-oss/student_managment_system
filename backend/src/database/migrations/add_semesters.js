/**
 * Migration: Add Semesters Support to Academic Years, Grade Records, and Assignments
 * Ensures zero data loss and backward compatibility for existing records.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { query } = require('../../config/db');

async function runMigration() {
  console.log('🚀 [MIGRATION] Starting Two-Semester Schema Enhancements...');

  try {
    // 1. Add current_semester to academic_years
    console.log('1. Checking academic_years.current_semester...');
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'academic_years' AND column_name = 'current_semester'
        ) THEN
          ALTER TABLE academic_years ADD COLUMN current_semester INT NOT NULL DEFAULT 1 CHECK (current_semester IN (1, 2));
          RAISE NOTICE 'Added current_semester column to academic_years.';
        ELSE
          RAISE NOTICE 'current_semester column already exists on academic_years.';
        END IF;
      END $$;
    `);

    // 2. Add semester to grade_records
    console.log('2. Checking grade_records.semester...');
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'grade_records' AND column_name = 'semester'
        ) THEN
          ALTER TABLE grade_records ADD COLUMN semester INT NOT NULL DEFAULT 1 CHECK (semester IN (1, 2));
          RAISE NOTICE 'Added semester column to grade_records.';
        ELSE
          RAISE NOTICE 'semester column already exists on grade_records.';
        END IF;
      END $$;
    `);

    // 3. Update unique constraint on grade_records to include semester
    console.log('3. Updating unique constraint on grade_records...');
    await query(`
      DO $$
      BEGIN
        -- Drop old constraint if exists
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'grade_records' AND constraint_name = 'uq_student_subject_year_grade'
        ) THEN
          ALTER TABLE grade_records DROP CONSTRAINT uq_student_subject_year_grade;
          RAISE NOTICE 'Dropped old constraint uq_student_subject_year_grade.';
        END IF;

        -- Add new constraint if not exists
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'grade_records' AND constraint_name = 'uq_student_subject_year_semester'
        ) THEN
          ALTER TABLE grade_records ADD CONSTRAINT uq_student_subject_year_semester 
            UNIQUE (student_id, subject_id, academic_year_id, semester);
          RAISE NOTICE 'Added new constraint uq_student_subject_year_semester.';
        END IF;
      END $$;
    `);

    // 4. Add semester to assignments (optional, defaults to 1)
    console.log('4. Checking assignments.semester...');
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'assignments' AND column_name = 'semester'
        ) THEN
          ALTER TABLE assignments ADD COLUMN semester INT DEFAULT 1 CHECK (semester IN (1, 2));
          RAISE NOTICE 'Added semester column to assignments.';
        ELSE
          RAISE NOTICE 'semester column already exists on assignments.';
        END IF;
      END $$;
    `);

    // 5. Verify current state
    const yearRes = await query('SELECT id, year_name, is_current, current_semester FROM academic_years WHERE is_current = TRUE LIMIT 1');
    console.log('✅ Current Academic Year:', yearRes.rows[0]);

    console.log('🎉 [MIGRATION SUCCESS] Database schema upgraded to support 2 Semesters per Academic Year!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [MIGRATION ERROR]:', err);
    process.exit(1);
  }
}

runMigration();
