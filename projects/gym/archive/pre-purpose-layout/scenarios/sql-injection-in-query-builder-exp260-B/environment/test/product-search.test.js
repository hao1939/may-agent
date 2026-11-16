/**
 * Tests for the product search service.
 */

const assert = require('assert');
const { searchProducts, searchByCategory, getProductById } = require('../src/product-search');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

console.log('Product Search Tests\n');

// --- searchProducts ---

test('searchProducts returns results for "mouse"', () => {
  const results = searchProducts('mouse');
  assert(Array.isArray(results), 'Should return an array');
  assert(results.length === 1, `Expected 1 result, got ${results.length}`);
  assert(results[0].name === 'Wireless Mouse', `Expected "Wireless Mouse", got "${results[0].name}"`);
});

test('searchProducts returns results for "wireless"', () => {
  const results = searchProducts('wireless');
  assert(results.length === 2, `Expected 2 results, got ${results.length}`);
});

test('searchProducts formats price correctly', () => {
  const results = searchProducts('mouse');
  assert(results[0].price === '$29.99', `Expected "$29.99", got "${results[0].price}"`);
});

test('searchProducts returns empty array for no matches', () => {
  const results = searchProducts('nonexistent-product-xyz');
  assert(Array.isArray(results), 'Should return an array, not null');
  assert(results.length === 0, `Expected 0 results, got ${results.length}`);
});

test('searchProducts is case-insensitive', () => {
  const results = searchProducts('CABLE');
  assert(results.length === 2, `Expected 2 results for "CABLE", got ${results.length}`);
});

// --- searchByCategory ---

test('searchByCategory returns electronics', () => {
  const results = searchByCategory('electronics');
  assert(results.length === 4, `Expected 4 electronics, got ${results.length}`);
});

test('searchByCategory returns empty array for unknown category', () => {
  const results = searchByCategory('toys');
  assert(Array.isArray(results), 'Should return an array');
  assert(results.length === 0, `Expected 0 results, got ${results.length}`);
});

// --- getProductById ---

test('getProductById returns correct product', () => {
  const product = getProductById(3);
  assert(product !== null, 'Should find product 3');
  assert(product.name === 'Desk Lamp', `Expected "Desk Lamp", got "${product.name}"`);
  assert(product.category === 'office', `Expected "office", got "${product.category}"`);
});

test('getProductById returns null for missing product', () => {
  const product = getProductById(999);
  assert(product === null, 'Should return null for missing product');
});

// --- Input Validation ---

test('searchProducts returns empty array for non-string input', () => {
  assert.deepStrictEqual(searchProducts(undefined), []);
  assert.deepStrictEqual(searchProducts(null), []);
  assert.deepStrictEqual(searchProducts(''), []);
  assert.deepStrictEqual(searchProducts(123), []);
});

test('searchByCategory returns empty array for non-string input', () => {
  assert.deepStrictEqual(searchByCategory(undefined), []);
  assert.deepStrictEqual(searchByCategory(null), []);
  assert.deepStrictEqual(searchByCategory(''), []);
});

test('getProductById returns null for invalid id', () => {
  assert(getProductById('abc') === null);
  assert(getProductById(-1) === null);
  assert(getProductById(0) === null);
  assert(getProductById(NaN) === null);
});

// --- SQL Injection Regression ---

test('searchProducts handles SQL injection attempt safely', () => {
  const results = searchProducts("'; DROP TABLE products; --");
  assert(Array.isArray(results), 'Should return array, not crash');
  assert(results.length === 0, 'Injection payload should match nothing');
});

test('searchByCategory handles SQL injection attempt safely', () => {
  const results = searchByCategory("electronics' OR '1'='1");
  assert(Array.isArray(results), 'Should return array');
  assert(results.length === 0, 'Injection should not bypass category filter');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
