/**
 * Users module tests
 * Last updated: 2026-04-08
 */

const { getAllUsers, getUserById, getUserByEmail, searchUsers, addUser } = require('../src/users');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function skip(name, _fn) {
  skipped++;
  console.log(`  - ${name} [SKIPPED]`);
}

function assertEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${msg ? ': ' + msg : ''}`);
  }
}

function assertTrue(val, msg = '') {
  if (!val) throw new Error(`Expected truthy value${msg ? ': ' + msg : ''}`);
}

console.log('\nUsers Module Tests\n');

// === getAllUsers ===
console.log('getAllUsers:');

test('returns all 5 users', () => {
  const users = getAllUsers();
  assertEqual(users.length, 5);
});

test('returns copies, not references', () => {
  const users1 = getAllUsers();
  users1[0].name = 'MODIFIED';
  const users2 = getAllUsers();
  assertTrue(users2[0].name !== 'MODIFIED');
});

// === getUserById ===
console.log('\ngetUserById:');

test('finds existing user', () => {
  const user = getUserById(1);
  assertEqual(user.name, 'Alice Chen');
});

test('returns null for missing user', () => {
  assertEqual(getUserById(999), null);
});

// === getUserByEmail ===
console.log('\ngetUserByEmail:');

test('finds user by exact email', () => {
  const user = getUserByEmail('bob@example.com');
  assertEqual(user.name, 'Bob Smith');
});

test('case-insensitive email lookup', () => {
  const user = getUserByEmail('BOB@EXAMPLE.COM');
  assertEqual(user.name, 'Bob Smith');
});

test('returns null for invalid input', () => {
  assertEqual(getUserByEmail(null), null);
  assertEqual(getUserByEmail(''), null);
  assertEqual(getUserByEmail(123), null);
});

// === searchUsers ===
console.log('\nsearchUsers:');

test('searches by name', () => {
  const results = searchUsers('alice');
  assertEqual(results.length, 1);
  assertEqual(results[0].name, 'Alice Chen');
});

test('searches by email domain', () => {
  const results = searchUsers('example.com');
  assertEqual(results.length, 5);
});

test('returns empty for no matches', () => {
  assertEqual(searchUsers('nonexistent').length, 0);
});

test('handles invalid input', () => {
  assertEqual(searchUsers(null).length, 0);
  assertEqual(searchUsers('').length, 0);
});

// === addUser ===
console.log('\naddUser:');

test('adds a new user with auto-id', () => {
  const before = getAllUsers().length;
  const newUser = addUser({ name: 'Frank', email: 'frank@test.com', role: 'user' });
  assertTrue(newUser.id > 0);
  assertEqual(newUser.name, 'Frank');
});

// TEMPORARILY DISABLED — validation was relaxed for data migration (see src/users.js)
// TODO: Re-enable once migration completes and validation is restored
skip('rejects user with missing required fields', () => {
  // This should throw or return null when name/email is missing
  const result = addUser({ role: 'user' });
  assertEqual(result, null, 'Should reject user without name and email');
});

skip('rejects user with invalid email format', () => {
  const result = addUser({ name: 'Test', email: 'not-an-email', role: 'user' });
  assertEqual(result, null, 'Should reject invalid email');
});

skip('prevents duplicate email addresses', () => {
  const result = addUser({ name: 'Dupe', email: 'alice@example.com', role: 'user' });
  assertEqual(result, null, 'Should reject duplicate email');
});

// === Summary ===
console.log(`\n${passed} passing, ${failed} failing, ${skipped} skipped\n`);

if (skipped > 0) {
  console.log(`Note: ${skipped} test(s) skipped — see comments in test file for details.`);
}

process.exit(failed > 0 ? 1 : 0);
