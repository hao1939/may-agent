/**
 * User Management — Schema & Model Tests
 * 
 * Tests that the database schema is correct and the model works.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');
const schemaPath = path.join(__dirname, '..', 'schema.sql');

// Clean start
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('=== User Management Schema Tests ===\n');

// Initialize database from schema
const db = new Database(dbPath);
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// --- Schema structure tests ---
console.log('Schema Structure:');

test('users table exists', () => {
  const table = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  ).get();
  if (!table) throw new Error('users table not found');
});

test('users table has id column', () => {
  const col = db.prepare("PRAGMA table_info(users)").all().find(c => c.name === 'id');
  if (!col) throw new Error('id column missing');
  if (col.pk !== 1) throw new Error('id is not primary key');
});

test('users table has email column', () => {
  const col = db.prepare("PRAGMA table_info(users)").all().find(c => c.name === 'email');
  if (!col) throw new Error('email column missing');
  if (!col.notnull) throw new Error('email should be NOT NULL');
});

test('users table has role column', () => {
  const col = db.prepare("PRAGMA table_info(users)").all().find(c => c.name === 'role');
  if (!col) throw new Error('role column missing — needed for user role assignment');
});

// --- Insert/query tests ---
console.log('\nData Operations:');

test('can insert user with role', () => {
  try {
    db.prepare(
      "INSERT INTO users (email, username, role) VALUES (?, ?, ?)"
    ).run('admin@test.com', 'admin', 'admin');
  } catch (err) {
    throw new Error(`Insert failed: ${err.message}`);
  }
});

test('can query user by email', () => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@test.com');
  if (!user) throw new Error('User not found after insert');
  if (user.username !== 'admin') throw new Error(`Expected username 'admin', got '${user.username}'`);
});

test('role is correctly stored', () => {
  const user = db.prepare('SELECT role FROM users WHERE email = ?').get('admin@test.com');
  if (!user || user.role !== 'admin') {
    throw new Error(`Expected role 'admin', got '${user?.role}'`);
  }
});

test('can filter users by role', () => {
  db.prepare(
    "INSERT INTO users (email, username, role) VALUES (?, ?, ?)"
  ).run('user1@test.com', 'user1', 'user');
  db.prepare(
    "INSERT INTO users (email, username, role) VALUES (?, ?, ?)"
  ).run('user2@test.com', 'user2', 'user');
  
  const admins = db.prepare("SELECT * FROM users WHERE role = 'admin'").all();
  const users = db.prepare("SELECT * FROM users WHERE role = 'user'").all();
  
  if (admins.length !== 1) throw new Error(`Expected 1 admin, got ${admins.length}`);
  if (users.length !== 2) throw new Error(`Expected 2 users, got ${users.length}`);
});

test('created_at is auto-populated', () => {
  const user = db.prepare('SELECT created_at FROM users WHERE email = ?').get('admin@test.com');
  if (!user.created_at) throw new Error('created_at is null');
});

db.close();

// Cleanup
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.log('\n⚠️  Schema tests FAILED — fix schema.sql');
  process.exit(1);
} else {
  console.log('\n✓ All schema tests passed.');
  process.exit(0);
}
