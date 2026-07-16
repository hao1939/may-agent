/**
 * Tests for the account management module.
 * Run with: node test/accounts.test.js
 */

const { createAccount, getBalance, deposit, withdraw, withdrawAsync, getTransactions, resetAccounts } = require('../src/accounts');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log(`  ✗ ${name}\n    ${err.message}`); }
}

async function testAsync(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log(`  ✗ ${name}\n    ${err.message}`); }
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label}Expected ${expected}, got ${actual}`);
}

async function runTests() {
  console.log('\nAccount tests:');

  resetAccounts();
  test('creates account with balance', () => {
    const acc = createAccount('user1', 100);
    assertEqual(acc.balance, 100);
  });

  test('deposits correctly', () => {
    deposit('user1', 50);
    assertEqual(getBalance('user1'), 150);
  });

  test('withdraws correctly', () => {
    withdraw('user1', 30);
    assertEqual(getBalance('user1'), 120);
  });

  test('rejects overdraft', () => {
    try {
      withdraw('user1', 200);
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Insufficient funds')) throw e;
    }
  });

  test('tracks transactions', () => {
    const txns = getTransactions('user1');
    assertEqual(txns.length, 2); // deposit + withdrawal
  });

  // BUG-102: Race condition test
  resetAccounts();
  await testAsync('concurrent withdrawals maintain non-negative balance', async () => {
    createAccount('race-test', 100);
    
    // Two concurrent withdrawals of 80 each
    // Only one should succeed; balance should never go below 0
    const results = await Promise.allSettled([
      withdrawAsync('race-test', 80),
      withdrawAsync('race-test', 80)
    ]);
    
    const balance = getBalance('race-test');
    if (balance < 0) {
      throw new Error(`Balance went negative: ${balance} (BUG-102 race condition)`);
    }
    
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const rejections = results.filter(r => r.status === 'rejected').length;
    
    // Exactly one should succeed and one should fail
    if (successes !== 1 || rejections !== 1) {
      throw new Error(`Expected 1 success + 1 rejection, got ${successes} successes + ${rejections} rejections`);
    }
  });

  // More race condition test
  resetAccounts();
  await testAsync('rapid sequential withdrawals stay consistent', async () => {
    createAccount('rapid-test', 100);
    
    // 5 concurrent withdrawals of 30
    // At most 3 should succeed (3*30 = 90 ≤ 100, 4*30 = 120 > 100)
    const results = await Promise.allSettled([
      withdrawAsync('rapid-test', 30),
      withdrawAsync('rapid-test', 30),
      withdrawAsync('rapid-test', 30),
      withdrawAsync('rapid-test', 30),
      withdrawAsync('rapid-test', 30)
    ]);
    
    const balance = getBalance('rapid-test');
    if (balance < 0) {
      throw new Error(`Balance went negative: ${balance}`);
    }
  });

  console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`)); }
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
