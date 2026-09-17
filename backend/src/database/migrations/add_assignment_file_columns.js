const { query, pool } = require('../../config/db');

async function migrate() {
  console.log('--- Migration: Add file attachment columns to assignments table ---');
  try {
    await query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)`);
    await query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`);
    await query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0`);
    await query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_type VARCHAR(100)`);
    console.log('✅ Columns (file_url, file_name, file_size, file_type) successfully added to assignments table!');
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
