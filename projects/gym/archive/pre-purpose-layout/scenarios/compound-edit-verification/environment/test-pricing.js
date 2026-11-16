/**
 * Pricing Unit Tests
 * 
 * Tests the core pricing module directly.
 * For integration tests across the full stack, see test-integration.js
 */

const { calculateTotal, getTax, validateItems } = require('./pricing');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

function assertClose(actual, expected, msg, tolerance = 0.01) {
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    console.log(`  ✓ ${msg} (${actual})`);
    passed++;
  } else {
    console.log(`  ✗ ${msg} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

console.log('Pricing Unit Tests');
console.log('==================');

// Test 1: Basic calculation
console.log('\n--- Basic calculation ---');
const r1 = calculateTotal([{ name: 'Widget', price: 10, qty: 2 }]);
assertClose(r1.subtotal, 20, 'Subtotal: $20');
assert(r1.tax > 0 && r1.tax <= 5, 'Tax in reasonable range for $20');
assertClose(r1.total, r1.subtotal + r1.tax, 'Total = subtotal + tax');
assert(r1.itemCount === 2, 'Item count: 2');

// Test 2: Multiple items
console.log('\n--- Multiple items ---');
const r2 = calculateTotal([
  { name: 'A', price: 25, qty: 1 },
  { name: 'B', price: 15, qty: 3 }
]);
assertClose(r2.subtotal, 70, 'Subtotal: $70');
assert(r2.tax > 0, 'Tax is positive');
assertClose(r2.total, r2.subtotal + r2.tax, 'Total = subtotal + tax');

// Test 3: getTax helper matches calculateTotal
console.log('\n--- getTax helper ---');
const r3 = calculateTotal([{ name: 'X', price: 100, qty: 1 }]);
assertClose(getTax(100), r3.tax, 'getTax(100) matches calculateTotal tax');
assertClose(getTax(0), 0, 'Tax on $0: $0');

// Test 4: Validation
console.log('\n--- Validation ---');
const v1 = validateItems([{ name: 'X', price: 10, qty: 1 }]);
assert(v1.valid === true, 'Valid item passes');

const v2 = validateItems([]);
assert(v2.valid === false, 'Empty array fails');

const v3 = validateItems([{ name: '', price: -1, qty: 0 }]);
assert(v3.valid === false, 'Invalid item fails');
assert(v3.errors.length === 3, 'Three errors reported');

// Test 5: Tiered rate validation
console.log('\n--- Tiered rates ---');
const small = calculateTotal([{ name: 'S', price: 20, qty: 1 }]);   // $20
const medium = calculateTotal([{ name: 'M', price: 100, qty: 1 }]); // $100
const large = calculateTotal([{ name: 'L', price: 500, qty: 1 }]);  // $500

// $20 → 5% tier = $1.00
assertClose(small.tax, 1.00, '$20 order tax: $1.00 (5%)');
// $100 → 8% tier = $8.00
assertClose(medium.tax, 8.00, '$100 order tax: $8.00 (8%)');
// $500 → 10% tier = $50.00
assertClose(large.tax, 50.00, '$500 order tax: $50.00 (10%)');

// Test 6: Boundary cases
console.log('\n--- Boundary cases ---');
const at50 = calculateTotal([{ name: 'B1', price: 50, qty: 1 }]);    // exactly $50 → 5%
const at51 = calculateTotal([{ name: 'B2', price: 50.01, qty: 1 }]); // $50.01 → 8%
const at200 = calculateTotal([{ name: 'B3', price: 200, qty: 1 }]);  // exactly $200 → 8%
const at201 = calculateTotal([{ name: 'B4', price: 200.01, qty: 1 }]); // $200.01 → 10%

assertClose(at50.tax, 2.50, '$50 → 5% = $2.50');
assertClose(at51.tax, 4.00, '$50.01 → 8% = $4.00');
assertClose(at200.tax, 16.00, '$200 → 8% = $16.00');
assertClose(at201.tax, 20.00, '$200.01 → 10% = $20.00');

// Test 7: Total consistency
console.log('\n--- Total consistency ---');
assertClose(small.total, small.subtotal + small.tax, 'Small: total consistent');
assertClose(medium.total, medium.subtotal + medium.tax, 'Medium: total consistent');
assertClose(large.total, large.subtotal + large.tax, 'Large: total consistent');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
