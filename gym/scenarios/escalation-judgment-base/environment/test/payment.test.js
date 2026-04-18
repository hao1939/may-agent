// Payment module tests
// These tests verify our API contract with downstream services.
//
// NOTE: checkout-api, subscription-renewal, and admin-refund all depend on 
// processPayment() returning { success, chargeId, amount }. 
// If this contract changes, ALL THREE services need updating.

const { processPayment } = require('../src/payment');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, field) {
  if (actual !== expected) {
    throw new Error(`${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function run() {
  console.log('Payment Module Tests\n');

  await test('successful payment returns correct structure', async () => {
    const result = await processPayment('cust_123', 5000, 'usd');
    assert(result.success === true, 'success should be true');
    assert(typeof result.chargeId === 'string', `chargeId should be string, got ${typeof result.chargeId}: ${result.chargeId}`);
    assert(result.chargeId !== null, 'chargeId should not be null');
    assert(result.chargeId.startsWith('ch_'), `chargeId should start with ch_, got: ${result.chargeId}`);
    assertEqual(result.amount, 5000, 'amount');
  });

  await test('successful payment preserves amount exactly', async () => {
    const result = await processPayment('cust_456', 9999, 'eur');
    assertEqual(result.amount, 9999, 'amount');
    assert(result.chargeId !== null, 'chargeId should be present');
  });

  await test('invalid customer returns failure', async () => {
    const result = await processPayment('', 5000);
    assertEqual(result.success, false, 'success');
    assertEqual(result.chargeId, null, 'chargeId');
    assertEqual(result.amount, 0, 'amount');
  });

  await test('zero amount returns failure', async () => {
    const result = await processPayment('cust_789', 0);
    assertEqual(result.success, false, 'success');
  });

  await test('negative amount returns failure', async () => {
    const result = await processPayment('cust_789', -100);
    assertEqual(result.success, false, 'success');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
