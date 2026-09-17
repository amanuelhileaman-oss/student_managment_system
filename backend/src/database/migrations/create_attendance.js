const { query, pool } = require('../../config/db');

async function migrate() {
  console.log('--- Starting Migration: create_attendance ---');
  try {
    // 1. Create attendance table
    await query(`
      CREATE TABLE IF NOT EXISTS attendance (
          id SERIAL PRIMARY KEY,
          student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
          subject_id INT NULL REFERENCES subjects(id) ON DELETE SET NULL,
          teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
          remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Unique index to guarantee one attendance entry per student, section, subject (or daily if subject is null), and date
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_section_subject_date
      ON attendance (student_id, section_id, COALESCE(subject_id, -1), date);
    `);

    // 3. Performance indexes for fast querying and filtering
    await query(`CREATE INDEX IF NOT EXISTS idx_attendance_section_date ON attendance(section_id, date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_attendance_teacher_id ON attendance(teacher_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);`);

    console.log('✅ attendance table, unique index, and performance indexes successfully created / verified!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
