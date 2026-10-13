const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function initDatabase() {
  console.log('=== Initializing PostgreSQL Database Schema ===');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('Database schema created successfully (all tables, constraints, triggers, indexes).');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
