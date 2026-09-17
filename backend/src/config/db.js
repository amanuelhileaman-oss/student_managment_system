const dns = require('dns');
const https = require('https');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || '';
let pool;

if (connectionString.includes('neon.tech')) {
  const { Pool: NeonPool, neonConfig } = require('@neondatabase/serverless');
  const ws = require('ws');

  const ipv4Agent = new https.Agent({
    family: 4,
    keepAlive: true,
    lookup: (hostname, opts, cb) => dns.lookup(hostname, { family: 4 }, cb),
  });

  class CustomWebSocket extends ws {
    constructor(url, protocols) {
      super(url, protocols, {
        agent: ipv4Agent,
        family: 4,
      });
      this.on('error', () => {
        // Capture idle WebSocket resets to prevent unhandled process events
      });
    }
  }

  neonConfig.webSocketConstructor = CustomWebSocket;
  // Use HTTP fetch for standard pool queries to eliminate idle WebSocket ECONNRESET drops
  neonConfig.poolQueryViaFetch = true;

  pool = new NeonPool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
  });
} else {
  const isRemote = connectionString.includes('sslmode') || connectionString.includes('aws');
  pool = new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });
}

pool.on('error', (err) => {
  console.warn('PostgreSQL pool event (auto-recovering):', err.message || err);
});

/**
 * Execute a parameterized query with automatic retry for transient network / cloud cold-start glitches
 */
const query = async (text, params) => {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      const errMsg = err.message || err.error?.message || String(err);
      const isTransient =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('timeout') ||
        errMsg.includes('Connection terminated') ||
        errMsg.includes('fetch failed') ||
        errMsg.includes('socket hang up') ||
        errMsg.includes('connection reset');

      if (isTransient && attempt < maxRetries) {
        console.warn(`[Cloud DB] Query retry attempt ${attempt}/${maxRetries} after transient issue:`, errMsg);
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      throw err;
    }
  }
};

/**
 * Helper to run a callback inside a PostgreSQL transaction with BEGIN / COMMIT / ROLLBACK
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  withTransaction,
};
