/**
 * cache.test.js — Tests for cache module
 */
const { Cache } = require('./cache');

let passed = 0, failed = 0;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    console.log(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

const cache = new Cache(1000);

// Test set and get
cache.set('a', 1);
assertEqual(cache.get('a'), 1, 'get after set');

// Test has
assertEqual(cache.has('a'), true, 'has existing key');
assertEqual(cache.has('z'), false, 'has missing key');

// Test delete
cache.set('b', 2);
cache.delete('b');
assertEqual(cache.get('b'), undefined, 'get after delete');

// Test size
cache.set('c', 3);
assertEqual(cache.size(), 2, 'size after operations');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
