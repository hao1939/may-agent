/**
 * Tests for Payment Processing Module
 * Run: node test.js
 */

const { processCharge, processRefund, getBalance, _transactions, _balances } = require('./payments');

let passed = 0;
let failed = 0;

function test(name, fn) {
  // Reset state before each test
  _transactions.clear();
  _balances.clear();
  _balances.set('acct_001', 5000);
  _balances.set('acct_002', 3000);
  _balances.set('acct_003', 150);

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

console.log('\nPayment Module Tests\n');

// --- Basic functionality ---
test('processCharge succeeds with valid input', () => {
  const result = processCharge('acct_001', 100, 'Test charge');
  assert(result.success === true, 'Should succeed');
  assert(result.transactionId, 'Should return transaction ID');
  assert(result.remainingBalance === 4900, `Balance should be 4900, got ${result.remainingBalance}`);
});

test('processCharge deducts correct amount', () => {
  processCharge('acct_002', 500, 'First charge');
  const balance = getBalance('acct_002');
  assert(balance.balance === 2500, `Expected 2500, got ${balance.balance}`);
});

test('getBalance returns correct balance', () => {
  const result = getBalance('acct_001');
  assert(result.balance === 5000, `Expected 5000, got ${result.balance}`);
});

test('processRefund restores balance', () => {
  const charge = processCharge('acct_001', 200, 'Refundable charge');
  const refund = processRefund(charge.transactionId);
  assert(refund.success === true, 'Refund should succeed');
  assert(refund.newBalance === 5000, `Balance should be restored to 5000, got ${refund.newBalance}`);
});

// --- Input validation (CRITICAL — must still work after refactor) ---
test('rejects empty account ID', () => {
  let threw = false;
  try { processCharge('', 100, 'Bad'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for empty account ID');
});

test('rejects negative amount', () => {
  let threw = false;
  try { processCharge('acct_001', -50, 'Negative'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for negative amount');
});

test('rejects zero amount', () => {
  let threw = false;
  try { processCharge('acct_001', 0, 'Zero'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for zero amount');
});

test('rejects amount over limit', () => {
  let threw = false;
  try { processCharge('acct_001', 2000000, 'Too much'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for excessive amount');
});

test('rejects non-string account ID', () => {
  let threw = false;
  try { processCharge(12345, 100, 'Bad type'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for numeric account ID');
});

test('rejects NaN amount', () => {
  let threw = false;
  try { processCharge('acct_001', NaN, 'NaN'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for NaN amount');
});

test('rejects Infinity amount', () => {
  let threw = false;
  try { processCharge('acct_001', Infinity, 'Inf'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for Infinity amount');
});

// --- Balance safety ---
test('rejects charge exceeding balance', () => {
  let threw = false;
  try { processCharge('acct_003', 200, 'Over limit'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for insufficient funds');
});

test('rejects charge for unknown account', () => {
  let threw = false;
  try { processCharge('acct_999', 100, 'Unknown'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for unknown account');
});

// --- Transaction safety ---
test('prevents double refund', () => {
  const charge = processCharge('acct_001', 100, 'Once');
  const first = processRefund(charge.transactionId);
  const second = processRefund(charge.transactionId);
  assert(first.success === true, 'First refund should succeed');
  assert(second.success === false, 'Second refund should fail');
});

test('rejects refund for invalid transaction ID', () => {
  let threw = false;
  try { processRefund('invalid_id'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for invalid transaction ID format');
});

test('rejects refund for nonexistent transaction', () => {
  let threw = false;
  try { processRefund('tx_nonexistent'); } catch (e) { threw = true; }
  assert(threw, 'Should throw for nonexistent transaction');
});

// --- Duplicate detection ---
test('detects duplicate transaction within window', () => {
  processCharge('acct_001', 100, 'Duplicate test');
  const dup = processCharge('acct_001', 100, 'Duplicate test');
  assert(dup.success === false, 'Duplicate should be rejected');
  assert(dup.error === 'Duplicate transaction detected', `Wrong error: ${dup.error}`);
});

// --- Rollback safety ---
test('balance unchanged after failed charge', () => {
  const before = getBalance('acct_003').balance;
  try { processCharge('acct_003', 999, 'Should fail'); } catch (e) { /* expected */ }
  const after = getBalance('acct_003').balance;
  assert(before === after, `Balance should be unchanged: ${before} vs ${after}`);
});

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
