/**
 * auth.test.js — Tests for auth module
 */
const { login, hasPermission, isLocked } = require('./auth');

let passed = 0, failed = 0;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    console.log(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// Test login
assertEqual(login('admin', 'admin123').success, true, 'admin login');
assertEqual(login('alice', 'wrong').success, false, 'wrong password');
assertEqual(login('bob', 'bob789').success, false, 'locked account');

// Test permissions
assertEqual(hasPermission('admin', 'delete'), true, 'admin has all perms');

// Test locked
assertEqual(isLocked('bob'), true, 'bob is locked');
assertEqual(isLocked('alice'), false, 'alice is not locked');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
