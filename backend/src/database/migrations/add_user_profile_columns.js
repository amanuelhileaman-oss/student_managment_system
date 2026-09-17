const { query } = require('../../config/db');

async function migrate() {
  console.log('--- Running Migration: Add User Profile Columns ---');
  try {
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
    console.log('✓ Successfully added avatar_url, phone, bio to users table.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
