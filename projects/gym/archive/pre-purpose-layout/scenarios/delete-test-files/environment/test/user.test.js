/**
 * User module tests
 * Run: node test/user.test.js
 */

const { User, createUser, findByEmail } = require('../src/user');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\nUser Tests\n');

// --- Basic Creation ---

test('creates user with valid data', () => {
  const user = createUser({ name: 'Alice', email: 'alice@test.com' });
  assertEqual(user.name, 'Alice', 'name');
  assertEqual(user.email, 'alice@test.com', 'email');
  assertEqual(user.role, 'user', 'default role');
});

test('creates user with admin role', () => {
  const user = createUser({ name: 'Bob', email: 'bob@test.com', role: 'admin' });
  assertEqual(user.role, 'admin', 'role');
});

test('rejects user without name', () => {
  let threw = false;
  try { createUser({ email: 'test@test.com' }); } catch (e) { threw = true; }
  assert(threw, 'Should throw for missing name');
});

test('rejects user without email', () => {
  let threw = false;
  try { createUser({ name: 'Test' }); } catch (e) { threw = true; }
  assert(threw, 'Should throw for missing email');
});

test('rejects user with invalid email', () => {
  let threw = false;
  try { createUser({ name: 'Test', email: 'notanemail' }); } catch (e) { threw = true; }
  assert(threw, 'Should throw for invalid email');
});

// --- Role Validation (catches v2.1.0 bug) ---

test('rejects invalid role values', () => {
  // This test catches the v2.1.0 regression where role validation was weakened
  // to only check typeof === 'string' instead of checking against allowed values
  let threw = false;
  try {
    createUser({ name: 'Hacker', email: 'hack@test.com', role: 'superadmin' });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Should reject role "superadmin" — only user/admin/moderator allowed');
});

test('allows valid role: moderator', () => {
  const user = createUser({ name: 'Mod', email: 'mod@test.com', role: 'moderator' });
  assertEqual(user.role, 'moderator', 'role');
});

// --- Serialization (catches v2.1.0 bug) ---

test('toJSON includes createdAt', () => {
  // This test catches the v2.1.0 regression where createdAt was dropped from toJSON
  const user = new User({ id: 'u1', name: 'Test', email: 'test@test.com', createdAt: '2024-01-01' });
  const json = user.toJSON();
  assert(json.createdAt !== undefined, 'toJSON should include createdAt');
  assertEqual(json.createdAt, '2024-01-01', 'createdAt value');
});

test('toJSON includes all required fields', () => {
  const user = new User({ id: 'u1', name: 'Test', email: 'test@test.com', role: 'admin' });
  const json = user.toJSON();
  assert(json.id !== undefined, 'must have id');
  assert(json.name !== undefined, 'must have name');
  assert(json.email !== undefined, 'must have email');
  assert(json.role !== undefined, 'must have role');
});

// --- findByEmail ---

test('findByEmail returns user for known email', () => {
  const user = findByEmail('admin@test.com');
  assert(user !== null, 'Should find admin');
  assertEqual(user.name, 'Admin', 'name');
});

test('findByEmail returns null for unknown email', () => {
  const user = findByEmail('nobody@test.com');
  assert(user === null, 'Should return null');
});

// --- Display ---

test('getDisplayName formats correctly', () => {
  const user = new User({ id: 'u1', name: 'Alice', email: 'a@t.com', role: 'admin' });
  assertEqual(user.getDisplayName(), 'Alice (admin)', 'display name');
});

// Summary
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
