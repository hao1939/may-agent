// src/db.js — Database connection module
// @author: team
// Updated by @sam: Now uses config.js properly, removed duplicated env var reads

const config = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = {
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      max: config.db.maxPool,
      idleTimeoutMillis: config.db.idleTimeout,
      connectionTimeoutMillis: config.db.connectTimeout
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
