// src/db.js — Database connection module
// @author: team

const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    // Duplicated config — also reads env vars directly instead of using config.js
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 5432;
    const database = process.env.DB_NAME || 'myapp';
    const user = process.env.DB_USER || 'admin';
    const password = process.env.DB_PASS || 'admin123';

    pool = {
      host, port, database, user, password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  try {
    // Simulated query execution
    return { rows: [], rowCount: 0 };
  } catch (err) {
    console.log('DB query error: ' + err.message);
    throw err;
  }
}

async function getById(table, id) {
  return query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
}

async function insertOne(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  return query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

module.exports = { query, getById, insertOne, getPool };
