const { query, pool } = require('../../config/db');

async function migrate() {
  console.log('--- Migration: Add edit and update tracking columns to messages table ---');
  try {
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    console.log('✅ Columns (is_edited, updated_at) successfully added to messages table!');
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
