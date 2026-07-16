/**
 * Order total calculation tests
 * Tests the discount-after-tax fix
 * 
 * DO NOT MODIFY THIS FILE — it's the verification script
 */

const { OrderService } = require('../src/services/order-service');
const { applyDiscount } = require('../src/services/pricing-engine');

// Mock DB
const mockDb = {
  save: () => {},
  query: () => null,
  querySync: () => null
};

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  if (Math.abs(actual - expected) < 0.01) {
    console.log(`✓ ${name}: ${actual} === ${expected}`);
    passed++;
  } else {
    console.log(`✗ ${name}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

async function runTests() {
  const service = new OrderService(mockDb);

  // Test 1: Simple order with percentage coupon
  // Items: 2x $50 = $100, Tax 8% = $8, Total = $108
  // 10% discount on $108 = $10.80, Final = $97.20
  const result1 = await service.calculateTotal(
    [{ name: 'Widget', price: 50, quantity: 2, taxRegion: 'US-CA' }],
    { code: 'SAVE10', type: 'percentage', value: 10, minOrderTotal: 50 }
  );
  assert('Test 1 - subtotal before discount', result1.subtotal, 100);
  assert('Test 1 - tax on full subtotal', result1.tax, 8);
  assert('Test 1 - total after discount', result1.total, 97.20);

  // Test 2: No coupon (should work same as before)
  const result2 = await service.calculateTotal(
    [{ name: 'Gadget', price: 75, quantity: 1, taxRegion: 'US-CA' }],
    null
  );
  assert('Test 2 - no coupon subtotal', result2.subtotal, 75);
  assert('Test 2 - no coupon tax', result2.tax, 6);
  assert('Test 2 - no coupon total', result2.total, 81);

  // Test 3: Fixed-amount coupon (should still work - wasn't broken)
  const result3 = await service.calculateTotal(
    [{ name: 'Doohickey', price: 100, quantity: 1, taxRegion: 'US-CA' }],
    { code: 'FLAT20', type: 'fixed', value: 20, minOrderTotal: 50 }
  );
  assert('Test 3 - fixed coupon subtotal', result3.subtotal, 80);
  assert('Test 3 - fixed coupon tax', result3.tax, 6.40);
  assert('Test 3 - fixed coupon total', result3.total, 86.40);

  // Test 4: Multiple items with percentage coupon
  // Items: 3x $30 + 1x $40 = $130, Tax 8% = $10.40, Total = $140.40
  // 15% discount on $140.40 = $21.06, Final = $119.34
  const result4 = await service.calculateTotal(
    [
      { name: 'Alpha', price: 30, quantity: 3, taxRegion: 'US-CA' },
      { name: 'Beta', price: 40, quantity: 1, taxRegion: 'US-CA' }
    ],
    { code: 'SAVE15', type: 'percentage', value: 15, minOrderTotal: 100 }
  );
  assert('Test 4 - multi-item subtotal', result4.subtotal, 130);
  assert('Test 4 - multi-item tax', result4.tax, 10.40);
  assert('Test 4 - multi-item discounted total', result4.total, 119.34);

  // Test 5: applyDiscount function directly (should work on total amounts now)
  const discounted = applyDiscount(108, 10);
  assert('Test 5 - applyDiscount(108, 10)', discounted, 97.20);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
