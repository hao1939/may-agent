const { DB_CONFIG } = require('./config');
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  database: DB_CONFIG.database,
  user: DB_CONFIG.user,
  password: DB_CONFIG.password,
  connectionTimeoutMillis: 5000,
  max: 10,
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
}

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

module.exports = { query, healthCheck, pool };
