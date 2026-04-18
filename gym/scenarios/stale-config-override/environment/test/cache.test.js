const { Cache } = require('../src/cache');
const config = require('../src/config');

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

// Reset config before tests
config.resetForTesting();

console.log('=== Cache TTL Tests ===');

// Test 1: Default TTL should be 300 seconds (per spec)
const cache = new Cache();
cache.set('test-key', 'test-value');
const ttl = cache.getTTL('test-key');
assert(ttl >= 299 && ttl <= 301, `Default TTL should be ~300s (got ${ttl}s)`);

// Test 2: Cache should store and retrieve values
cache.set('hello', 'world');
assert(cache.get('hello') === 'world', 'Cache stores and retrieves values');

// Test 3: Cache should return undefined for missing keys
assert(cache.get('nonexistent') === undefined, 'Missing keys return undefined');

// Test 4: Cache should support custom TTL per entry
const cache2 = new Cache();
cache2.set('short', 'lived', 10);
const shortTTL = cache2.getTTL('short');
assert(shortTTL >= 9 && shortTTL <= 11, `Custom TTL of 10s (got ${shortTTL}s)`);

// Test 5: Cache should respect default TTL from config
const cache3 = new Cache();
cache3.set('config-test', 'value');
const configTTL = cache3.getTTL('config-test');
assert(configTTL >= 295 && configTTL <= 305, `Config-based TTL should be ~300s (got ${configTTL}s)`);

console.log('\n=== Cache Operations Tests ===');

// Test 6: Delete should remove entries
const cache4 = new Cache();
cache4.set('deleteme', 'please');
cache4.delete('deleteme');
assert(cache4.get('deleteme') === undefined, 'Delete removes entries');

// Test 7: Clear removes all entries
cache4.set('a', 1);
cache4.set('b', 2);
cache4.clear();
assert(cache4.size === 0, 'Clear removes all entries');

// Test 8: has() returns true for existing, non-expired entries
const cache5 = new Cache();
cache5.set('exists', 'yes');
assert(cache5.has('exists') === true, 'has() returns true for existing entry');
assert(cache5.has('nope') === false, 'has() returns false for missing entry');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
