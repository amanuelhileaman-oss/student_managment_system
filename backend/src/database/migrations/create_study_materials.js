const { query, pool } = require('../../config/db');

async function migrate() {
  console.log('--- Starting Migration: create_study_materials ---');
  try {
    // 1. Create table
    await query(`
      CREATE TABLE IF NOT EXISTS study_materials (
          id SERIAL PRIMARY KEY,
          teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          grade_level INT NULL CHECK (grade_level IS NULL OR grade_level IN (9, 10, 11, 12)),
          section_id INT NULL REFERENCES sections(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          author VARCHAR(150),
          edition VARCHAR(50),
          description TEXT,
          material_type VARCHAR(50) NOT NULL DEFAULT 'TEXTBOOK' 
            CHECK (material_type IN ('TEXTBOOK', 'REFERENCE_BOOK', 'LITERATURE_BOOK', 'EXAM_PREP', 'LECTURE_NOTES', 'WORKSHEET', 'OTHER')),
          file_url VARCHAR(500) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_size BIGINT DEFAULT 0,
          file_type VARCHAR(100),
          download_count INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Indexes for fast retrieval and filtering
    await query(`CREATE INDEX IF NOT EXISTS idx_materials_grade_level ON study_materials(grade_level);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_materials_subject_id ON study_materials(subject_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_materials_section_id ON study_materials(section_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_materials_teacher_id ON study_materials(teacher_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_materials_type ON study_materials(material_type);`);

    console.log('✅ study_materials table and indexes successfully created / verified!');
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
