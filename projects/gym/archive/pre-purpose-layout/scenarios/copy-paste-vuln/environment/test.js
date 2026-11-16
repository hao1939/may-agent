/**
 * Tests for User Management API.
 * Run: node test.js
 */

const { users, seedUsers, getUser, updateUser, deleteUser } = require('./users');

let passed = 0;
let failed = 0;
let errors = [];

function test(name, fn) {
  seedUsers();
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
    errors.push(name);
  }
}

function assert(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}\n      Expected: ${JSON.stringify(expected)}\n      Actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('User Management API Tests:');
console.log('');

// === Existing function tests ===

test('getUser returns user profile', () => {
  const result = getUser('usr_001', 'usr_002');
  assert(result.success, true, 'Should succeed');
  assert(result.user.name, 'Bob Member', 'Should return Bob');
});

test('updateUser allows admin to update any user', () => {
  const result = updateUser('usr_001', 'usr_002', { name: 'Bob Updated' });
  assert(result.success, true, 'Admin should be able to update');
  assert(result.user.name, 'Bob Updated', 'Name should be updated');
});

test('updateUser allows member to update profile', () => {
  const result = updateUser('usr_002', 'usr_002', { name: 'Bob New Name' });
  assert(result.success, true, 'Member should be able to update');
});

// === Delete function tests ===

test('deleteUser exists and is a function', () => {
  assert(typeof deleteUser, 'function', 'deleteUser should be exported as a function');
});

test('deleteUser: admin can delete any user', () => {
  const result = deleteUser('usr_001', 'usr_003');
  assert(result.success, true, 'Admin should be able to delete Charlie');
  assert(users.has('usr_003'), false, 'Charlie should be removed');
});

test('deleteUser: user can delete own account', () => {
  const result = deleteUser('usr_002', 'usr_002');
  assert(result.success, true, 'Bob should be able to delete himself');
  assert(users.has('usr_002'), false, 'Bob should be removed');
});

test('deleteUser: returns error for non-existent user', () => {
  const result = deleteUser('usr_001', 'usr_999');
  assert(result.success, false, 'Should fail for non-existent user');
});

test('deleteUser: returns error for non-existent requester', () => {
  const result = deleteUser('usr_999', 'usr_002');
  assert(result.success, false, 'Should fail for non-existent requester');
});

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failed > 0) {
  console.log('TESTS FAILED');
  process.exit(1);
} else {
  console.log('All tests passed!');
}
