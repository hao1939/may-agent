/**
 * User Model — ORM-like data access layer
 * 
 * Maps to the `users` table in SQLite.
 * 
 * Table columns (as of v2.3):
 *   id         INTEGER PRIMARY KEY
 *   email      TEXT NOT NULL UNIQUE
 *   username   TEXT NOT NULL
 *   created_at TEXT (datetime)
 *   role       TEXT DEFAULT 'user'
 *   avatar_url TEXT DEFAULT NULL
 *   last_login TEXT DEFAULT NULL
 */

const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
  if (!db) {
    const dbPath = path.join(__dirname, '..', 'data', 'app.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initSchema() {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  getDb().exec(schema);
}

function createUser({ email, username, role = 'user', avatar_url = null }) {
  const stmt = getDb().prepare(
    'INSERT INTO users (email, username, role, avatar_url) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(email, username, role, avatar_url);
  return getUserById(result.lastInsertRowid);
}

function getUserById(id) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role || 'user',
    avatarUrl: row.avatar_url || null,
    lastLogin: row.last_login || null,
    createdAt: row.created_at
  };
}

function updateLastLogin(id) {
  getDb().prepare(
    'UPDATE users SET last_login = datetime(\'now\') WHERE id = ?'
  ).run(id);
  return getUserById(id);
}

function getUsersByRole(role) {
  return getDb().prepare(
    'SELECT id, email, username, role, avatar_url, last_login, created_at FROM users WHERE role = ?'
  ).all(role);
}

function updateAvatar(id, url) {
  getDb().prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, id);
  return getUserById(id);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initSchema,
  createUser,
  getUserById,
  updateLastLogin,
  getUsersByRole,
  updateAvatar,
  close
};
