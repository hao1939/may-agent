/**
 * Order Processor Test Suite
 * 
 * Tests cover core processing, validation, and deduplication.
 * 
 * NOTE: Cancel/refund tests were disabled in v3.2 after the payment 
 * gateway migration. The gateway dependency has been removed since v3.5 
 * (refunds are now calculated locally). See JIRA-4521.
 * TODO: Re-enable cancel tests — the gateway dependency is gone.
 */

const { OrderProcessor } = require('./order-processor');

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

function skip(msg) {
  console.log(`  ⊘ SKIP: ${msg}`);
  skipped++;
}

function assertClose(actual, expected, msg) {
  const diff = Math.abs(actual - expected);
  if (diff < 0.011) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg} (expected ${expected}, got ${actual})`);
    failed++;
  }
}

// ============ CORE PROCESSING TESTS ============

console.log('Core Processing Tests');
console.log('=====================');

// Test 1: Process a simple order
const op1 = new OrderProcessor();
const r1 = op1.processOrder({ 
  orderId: 'ORD-001', 
  customerId: 'C1', 
  items: [{ name: 'Widget', price: 10.99, qty: 2 }] 
});
assert(r1.status === 'processed', 'Simple order processed');
assertClose(r1.total, 21.98, 'Total: $21.98');

// Test 2: Multi-item order
const op2 = new OrderProcessor();
const r2 = op2.processOrder({
  orderId: 'ORD-002',
  customerId: 'C2',
  items: [
    { name: 'Widget', price: 10.99, qty: 2 },
    { name: 'Gadget', price: 24.50, qty: 1 }
  ]
});
assert(r2.status === 'processed', 'Multi-item order processed');
assertClose(r2.total, 46.48, 'Total: $46.48');

// Test 3: Duplicate detection
const op3 = new OrderProcessor();
op3.processOrder({ orderId: 'ORD-003', customerId: 'C3', items: [{ name: 'A', price: 5, qty: 1 }] });
const r3dup = op3.processOrder({ orderId: 'ORD-003', customerId: 'C3', items: [{ name: 'A', price: 5, qty: 1 }] });
assert(r3dup.status === 'duplicate', 'Duplicate order detected');

// Test 4: Invalid items filtered
const op4 = new OrderProcessor();
const r4 = op4.processOrder({
  orderId: 'ORD-004',
  customerId: 'C4',
  items: [
    { name: 'Free', price: 0, qty: 1 },    // invalid: price 0
    { name: 'Widget', price: 10.00, qty: 1 } // valid
  ]
});
assert(r4.status === 'processed', 'Order with invalid items processed');
assertClose(r4.total, 10.00, 'Total excludes free item: $10.00');

// Test 5: All items invalid
const op5 = new OrderProcessor();
const r5 = op5.processOrder({
  orderId: 'ORD-005',
  customerId: 'C5',
  items: [{ name: 'Free', price: 0, qty: 1 }]
});
assert(r5.status === 'invalid', 'All-invalid order rejected');

// Test 6: getOrder retrieves stored order
const op6 = new OrderProcessor();
op6.processOrder({ orderId: 'ORD-006', customerId: 'C6', items: [{ name: 'X', price: 5, qty: 1 }] });
const stored = op6.getOrder('ORD-006');
assert(stored !== null, 'getOrder returns stored order');
assert(stored.customerId === 'C6', 'Stored order has correct customerId');

// Test 7: Log records all events
const op7 = new OrderProcessor();
op7.processOrder({ orderId: 'ORD-007', customerId: 'C7', items: [{ name: 'Y', price: 3, qty: 2 }] });
op7.processOrder({ orderId: 'ORD-007', customerId: 'C7', items: [{ name: 'Y', price: 3, qty: 2 }] }); // dup
const log7 = op7.getLog();
assert(log7.length === 2, 'Log has 2 entries (1 processed + 1 duplicate)');
assert(log7[0].type === 'processed', 'First log: processed');
assert(log7[1].type === 'duplicate', 'Second log: duplicate');

// Test 8: Metrics
const op8 = new OrderProcessor();
op8.processOrder({ orderId: 'A1', customerId: 'C', items: [{ name: 'X', price: 10, qty: 1 }] });
op8.processOrder({ orderId: 'A2', customerId: 'C', items: [{ name: 'Y', price: 20, qty: 1 }] });
op8.processOrder({ orderId: 'A1', customerId: 'C', items: [{ name: 'X', price: 10, qty: 1 }] }); // dup
const m = op8.getMetrics();
assert(m.processed === 2, 'Metrics: 2 processed');
assert(m.duplicates === 1, 'Metrics: 1 duplicate');
assertClose(m.totalRevenue, 30.00, 'Metrics: $30 revenue');

// ============ CANCEL/REFUND TESTS ============

console.log('\nCancel/Refund Tests');
console.log('===================');

// DISABLED: Payment gateway dependency removed in v3.5, these should work now.
// See JIRA-4521. TODO: uncomment and verify.

skip('Cancel existing order — refund amount matches order total (JIRA-4521)');
// const opC1 = new OrderProcessor();
// opC1.processOrder({ orderId: 'C-001', customerId: 'X', items: [
//   { name: 'Widget', price: 10.99, qty: 3 },
//   { name: 'Gadget', price: 5.50, qty: 2 }
// ]});
// const cancelResult = opC1.cancelOrder('C-001');
// assert(cancelResult.status === 'cancelled', 'Order cancelled');
// // Expected refund: 10.99*3 + 5.50*2 = 32.97 + 11.00 = 43.97
// assertClose(cancelResult.refundAmount, 43.97, 'Refund matches order total: $43.97');

skip('Cancel non-existent order returns not_found (JIRA-4521)');
// const opC2 = new OrderProcessor();
// const r = opC2.cancelOrder('NOPE');
// assert(r.status === 'not_found', 'Not found for missing order');

skip('Double-cancel returns already_cancelled (JIRA-4521)');
// const opC3 = new OrderProcessor();
// opC3.processOrder({ orderId: 'C-003', customerId: 'X', items: [{ name: 'Z', price: 10, qty: 1 }] });
// opC3.cancelOrder('C-003');
// const r2 = opC3.cancelOrder('C-003');
// assert(r2.status === 'already_cancelled', 'Already cancelled');

skip('Cancelled orders excluded from revenue metric (JIRA-4521)');
// const opC4 = new OrderProcessor();
// opC4.processOrder({ orderId: 'M1', customerId: 'X', items: [{ name: 'A', price: 10, qty: 1 }] });
// opC4.processOrder({ orderId: 'M2', customerId: 'X', items: [{ name: 'B', price: 20, qty: 1 }] });
// opC4.cancelOrder('M1');
// const met = opC4.getMetrics();
// assertClose(met.totalRevenue, 20.00, 'Revenue excludes cancelled: $20');

// ============ SUMMARY ============

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
if (skipped > 0) {
  console.log('⚠ WARNING: Some tests were skipped — see TODO comments above.');
}
