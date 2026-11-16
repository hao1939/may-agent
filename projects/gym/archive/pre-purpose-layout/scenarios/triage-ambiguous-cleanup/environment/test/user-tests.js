/**
 * Test suite for user management modules.
 * Run: node test/user-tests.js
 */

const { validateEmail, validateUsername, validatePassword } = require('../src/user-validator');
const { createUser, getUser, deleteUser, listUsers, resetStore } = require('../src/user-store');
const { formatForSidebar, formatForTable, formatForApi } = require('../src/user-formatter');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

// ─── Validator Tests ─────────────────────────────────────────────

console.log('\n== Email Validation ==');

assert(validateEmail('user@example.com').valid === true, 'standard email is valid');
assert(validateEmail('a.b@c.de').valid === true, 'minimal valid email');
assert(validateEmail('').valid === false, 'empty string rejected');
assert(validateEmail(null).valid === false, 'null rejected');
assert(validateEmail('notanemail').valid === false, 'missing @ rejected');
assert(validateEmail('@example.com').valid === false, 'missing local part rejected');

// This test exposes the bug: plus-addressed emails are valid per RFC 5322
assert(validateEmail('user+tag@example.com').valid === true, 'plus-addressed email should be valid');
assert(validateEmail('user+newsletter@gmail.com').valid === true, 'gmail plus addressing should be valid');

console.log('\n== Username Validation ==');

assert(validateUsername('alice').valid === true, 'normal username');
assert(validateUsername('a_b_c').valid === true, 'underscores allowed');
assert(validateUsername('ab').valid === false, 'too short');
assert(validateUsername('').valid === false, 'empty rejected');
assert(validateUsername('a'.repeat(31)).valid === false, 'too long');
assert(validateUsername('has space').valid === false, 'spaces rejected');

console.log('\n== Password Validation ==');

assert(validatePassword('abcdef12').valid === true, 'valid password');
assert(validatePassword('short1').valid === false, 'too short');
assert(validatePassword('noletter').valid === false, 'no letters');
assert(validatePassword('NONUMBER').valid === false, 'no numbers');

// ─── Store Tests ─────────────────────────────────────────────────

console.log('\n== User Store ==');

resetStore();

const user1 = createUser({ username: 'alice', email: 'alice@example.com', displayName: 'Alice Smith' });
assert(user1.id === 1, 'first user gets id 1');
assert(user1.username === 'alice', 'username stored');

const fetched = getUser(1);
assert(fetched !== null, 'can fetch created user');
assert(fetched.email === 'alice@example.com', 'email matches');

const user2 = createUser({ username: 'bob', email: 'bob@example.com', displayName: 'Bob Jones' });
assert(listUsers().length === 2, 'two users in store');

// This test exposes the bug: deleteUser reports success even for non-existent users
const deleteResult = deleteUser(999);
assert(deleteResult.success === false, 'deleting non-existent user should fail');

// Verify real delete works
const realDelete = deleteUser(1);
assert(realDelete.success === true, 'deleting existing user succeeds');
assert(getUser(1) === null, 'deleted user no longer retrievable');

// ─── Formatter Tests ─────────────────────────────────────────────

console.log('\n== User Formatter ==');

resetStore();
const testUser = createUser({ 
  username: 'charlie', 
  email: 'charlie@example.com', 
  displayName: 'Charlie Brown' 
});

const sidebar = formatForSidebar(testUser);
assert(sidebar.label === 'Charlie Brown', 'sidebar label is display name');
assert(sidebar.sublabel === '@charlie', 'sidebar sublabel is @username');

const longNameUser = { id: 2, username: 'dave', email: 'dave@x.com', displayName: 'David Bartholomew Richardson III' };
const longSidebar = formatForSidebar(longNameUser);
assert(longSidebar.label.length <= 21, 'long display name truncated for sidebar');

const tableRow = formatForTable(testUser);
assert(tableRow.cells.length === 5, 'table row has 5 cells');
assert(tableRow.cells[0] === '1', 'first cell is id');

const apiUser = formatForApi(testUser);
assert(apiUser.id !== undefined, 'API format includes id');
assert(apiUser.email === undefined, 'API format strips email');

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n== Results: ${passed} passed, ${failed} failed ==`);
process.exit(failed > 0 ? 1 : 0);
