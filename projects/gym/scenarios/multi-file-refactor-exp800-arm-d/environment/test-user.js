// test-user.js — Test suite for user service and consumers
const { getUserData, createUser, deleteUser } = require('./userService');
const { renderDashboard, renderAdminPanel } = require('./dashboard');
const { handleGetUser } = require('./api');
const { sendWelcomeEmail } = require('./notifications');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

console.log('Running tests...\n');

// Test 1: getUserData returns correct user
const user = getUserData(1);
assert(user.name === 'Alice', 'getUserData returns Alice');
assert(user.email === 'alice@example.com', 'getUserData returns correct email');

// Test 2: Dashboard renders with user data
const dash = renderDashboard(1);
assert(dash.title === 'Dashboard — Alice', 'Dashboard title correct');
assert(dash.role === 'admin', 'Dashboard role correct');

// Test 3: API handler returns user
const apiResult = handleGetUser({ params: { id: '2' } });
assert(apiResult.status === 200, 'API returns 200');
assert(apiResult.body.name === 'Bob', 'API returns correct user');

// Test 4: Notifications use correct email
const email = sendWelcomeEmail(1);
assert(email.to === 'alice@example.com', 'Welcome email sent to correct address');
assert(email.sent === true, 'Email marked as sent');

// Test 5: Error handling
try {
  getUserData(999);
  assert(false, 'Should throw for missing user');
} catch (e) {
  assert(e.message === 'User 999 not found', 'Correct error for missing user');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
