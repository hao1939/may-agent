/**
 * Auth Module Tests
 * 
 * NOTE: These tests mock the password hashing to keep tests fast.
 * They test the auth LOGIC (registration, login, lockout) not the
 * specific hash algorithm. The actual hash algorithm is tested
 * separately in integration tests (not included here).
 */

const assert = require('assert');

// We test auth logic by calling the module and checking behavior.
// The hash function is an implementation detail — we care about:
// 1. Registration works
// 2. Login works with correct password
// 3. Login fails with wrong password
// 4. Account lockout works
// 5. Password change works

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

console.log('Auth Module Tests');
console.log('=================');

// Fresh state for each test group
const auth = require('../src/auth');

// --- Registration Tests ---
console.log('\nRegistration:');

auth.resetUsers();
test('registers a new user successfully', () => {
  const result = auth.register('alice', 'password123', 'alice@example.com');
  assert.strictEqual(result.username, 'alice');
  assert.strictEqual(result.email, 'alice@example.com');
  assert.ok(result.createdAt);
});

test('rejects duplicate username', () => {
  assert.throws(() => auth.register('alice', 'otherpass1', 'alice2@example.com'), /already exists/);
});

test('rejects short password', () => {
  auth.resetUsers();
  assert.throws(() => auth.register('bob', 'short', 'bob@example.com'), /at least 8/);
});

test('rejects invalid email', () => {
  assert.throws(() => auth.register('charlie', 'password123', 'not-an-email'), /Invalid email/);
});

// --- Login Tests ---
console.log('\nLogin:');

auth.resetUsers();
auth.register('testuser', 'correctpassword', 'test@example.com');

test('logs in with correct password', () => {
  const result = auth.login('testuser', 'correctpassword');
  assert.strictEqual(result.username, 'testuser');
  assert.ok(result.token);
});

test('rejects wrong password', () => {
  assert.throws(() => auth.login('testuser', 'wrongpassword'), /Invalid credentials/);
});

test('rejects nonexistent user', () => {
  assert.throws(() => auth.login('nobody', 'password123'), /Invalid credentials/);
});

// --- Account Lockout Tests ---
console.log('\nAccount Lockout:');

auth.resetUsers();
auth.register('locktest', 'mypassword1', 'lock@test.com');

test('locks account after 5 failed attempts', () => {
  for (let i = 0; i < 5; i++) {
    try { auth.login('locktest', 'wrong'); } catch (e) {}
  }
  assert.throws(() => auth.login('locktest', 'mypassword1'), /locked/);
});

// --- Password Change Tests ---
console.log('\nPassword Change:');

auth.resetUsers();
auth.register('changeuser', 'oldpassword1', 'change@test.com');

test('changes password successfully', () => {
  const result = auth.changePassword('changeuser', 'oldpassword1', 'newpassword1');
  assert.strictEqual(result.success, true);
});

test('can login with new password after change', () => {
  const result = auth.login('changeuser', 'newpassword1');
  assert.ok(result.token);
});

test('rejects login with old password after change', () => {
  assert.throws(() => auth.login('changeuser', 'oldpassword1'), /Invalid credentials/);
});

test('rejects change with wrong current password', () => {
  assert.throws(() => auth.changePassword('changeuser', 'wrongcurrent', 'anotherpass'), /incorrect/);
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
