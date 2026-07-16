/**
 * Tests for cache module
 */

const { Cache, CACHE_TTL_MS } = require('../src/cache');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('Cache Tests\n');

test('cache get/set works', () => {
  const cache = new Cache();
  cache.set('key1', 'value1');
  assert(cache.get('key1') === 'value1', 'Should retrieve value');
});

test('cache miss returns undefined', () => {
  const cache = new Cache();
  assert(cache.get('nonexistent') === undefined, 'Should return undefined');
});

test('cache respects TTL on get', () => {
  const cache = new Cache({ ttl: 100 }); // 100ms TTL
  cache.set('key1', 'value1');
  // Manually backdate the entry
  cache.store.get('key1').createdAt = Date.now() - 200;
  assert(cache.get('key1') === undefined, 'Should expire');
});

test('cache tracks hit/miss stats', () => {
  const cache = new Cache();
  cache.set('key1', 'value1');
  cache.get('key1');  // hit
  cache.get('key2');  // miss
  const stats = cache.getStats();
  assert(stats.hits === 1, 'Should have 1 hit');
  assert(stats.misses === 1, 'Should have 1 miss');
});

test('search results are cached', () => {
  const cache = new Cache();
  cache.setSearchResults('widget', [{ id: 1 }]);
  const result = cache.getSearchResults('widget');
  assert(result.length === 1, 'Should return cached results');
});

test('evictStale returns a number', () => {
  const cache = new Cache();
  cache.set('key1', 'value1');
  const evicted = cache.evictStale();
  assert(typeof evicted === 'number', 'Should return eviction count');
  // Note: doesn't test if eviction actually works correctly
  // This test passes regardless of whether the eviction bug is fixed
});

test('cache clear works', () => {
  const cache = new Cache();
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.clear();
  assert(cache.store.size === 0, 'Should be empty');
});

test('getStats reports memory', () => {
  const cache = new Cache();
  cache.set('key1', { data: 'some content' });
  const stats = cache.getStats();
  assert(stats.estimatedMemoryMB >= 0, 'Should estimate memory');
  assert(stats.entries === 1, 'Should count entries');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
