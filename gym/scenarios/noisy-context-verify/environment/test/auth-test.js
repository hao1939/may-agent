// test/auth-test.js
const auth = require('../src/auth');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Valid login
  try {
    const result = await auth.login('alice@example.com', 'password123');
    if (!result.success) throw new Error(`Expected success, got: ${JSON.stringify(result)}`);
    if (!result.token) throw new Error('No token returned');
    console.log('  ✓ valid login returns success + token');
    passed++;
  } catch (e) {
    console.log(`  ✗ valid login: ${e.message}`);
    failed++;
  }

  // Test 2: Wrong password
  try {
    const result = await auth.login('alice@example.com', 'wrongpass');
    if (result.success) throw new Error('Should have failed');
    if (result.error !== 'Invalid password') throw new Error(`Wrong error: ${result.error}`);
    console.log('  ✓ wrong password returns error');
    passed++;
  } catch (e) {
    console.log(`  ✗ wrong password: ${e.message}`);
    failed++;
  }

  // Test 3: Unknown user
  try {
    const result = await auth.login('nobody@example.com', 'pass');
    if (result.success) throw new Error('Should have failed');
    if (result.error !== 'User not found') throw new Error(`Wrong error: ${result.error}`);
    console.log('  ✓ unknown user returns error');
    passed++;
  } catch (e) {
    console.log(`  ✗ unknown user: ${e.message}`);
    failed++;
  }

  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) process.exit(1);
}

runTests();
