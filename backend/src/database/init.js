const fs = require('fs');
const path = require('path');
const { query, pool } = require('../config/db');

async function initDatabase() {
  console.log('=== Initializing PostgreSQL Database Schema ===');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await query(schemaSql);
    console.log('Database schema created successfully (all tables, constraints, triggers, indexes).');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
