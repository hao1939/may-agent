/**
 * Cache TTL Test
 *
 * Tests that cache entries respect their TTL correctly.
 * Uses a deliberately slow mock Redis to detect premature local cache expiry.
 * When local cache expires too early, the fallback to Redis is slow and detectable.
 */

// Mock Redis that tracks access count (to detect unnecessary Redis lookups)
const mockRedis = {
  _store: new Map(),
  _expiry: new Map(),
  _getCount: 0,
  async get(key) {
    this._getCount++;
    const exp = this._expiry.get(key);
    if (exp && Date.now() > exp) {
      this._store.delete(key);
      this._expiry.delete(key);
      return null;
    }
    return this._store.get(key) || null;
  },
  async setex(key, ttl, value) {
    this._store.set(key, value);
    this._expiry.set(key, Date.now() + ttl * 1000);
  },
  async del(key) {
    this._store.delete(key);
    this._expiry.delete(key);
  },
  async keys(pattern) { return []; },
};

// Import cache module
const { CacheManager } = require('../src/cache');

async function runTests() {
  const cache = new CacheManager(mockRedis, {
    defaultTtl: 10,
    maxEntries: 100,
  });

  let passed = 0;
  let failed = 0;

  // Test 1: Basic set and get
  await cache.set('test1', { value: 'hello' }, 10);
  const result1 = await cache.get('test1');
  if (result1 && result1.value === 'hello') {
    console.log('PASS: Test 1 — basic set/get');
    passed++;
  } else {
    console.log('FAIL: Test 1 — basic set/get: got', result1);
    failed++;
  }

  // Test 2: Local cache TTL accuracy
  // Set with 3s TTL. After 2.5s, local cache should still have the entry
  // (not yet expired). If the local cache expires early, the get() will
  // fall through to Redis, incrementing the Redis get count.
  //
  // With correct TTL: local cache valid for 3s → at 2.5s, local hit, no Redis call
  // With bug (- 1000): local cache valid for 2s → at 2.5s, local expired, Redis fallback
  mockRedis._getCount = 0;
  await cache.set('test2', { value: 'ttl-check' }, 3);
  // First get should use local cache, not Redis
  const getCountBefore = mockRedis._getCount;
  await new Promise(resolve => setTimeout(resolve, 2500));
  const result2 = await cache.get('test2');

  // The value should still be retrievable either way (from local or Redis)
  // But the KEY check is: did it hit Redis? If so, local cache expired too early.
  const redisGetsAfterWait = mockRedis._getCount - getCountBefore;

  if (result2 && result2.value === 'ttl-check' && redisGetsAfterWait === 0) {
    console.log('PASS: Test 2 — local cache valid at 2.5s of 3s TTL (no Redis fallback)');
    passed++;
  } else if (result2 && result2.value === 'ttl-check' && redisGetsAfterWait > 0) {
    console.log('FAIL: Test 2 — local cache expired too early (fell through to Redis at 2.5s of 3s TTL)');
    console.log('  Redis gets during wait:', redisGetsAfterWait, '(expected 0)');
    failed++;
  } else {
    console.log('FAIL: Test 2 — value not found at all:', result2);
    failed++;
  }

  // Test 3: Entry should actually expire after TTL
  await cache.set('test3', { value: 'expires' }, 1);
  await new Promise(resolve => setTimeout(resolve, 2000));
  const result3 = await cache.get('test3');
  if (result3 === null) {
    console.log('PASS: Test 3 — value expired after TTL');
    passed++;
  } else {
    console.log('FAIL: Test 3 — value should have expired: got', result3);
    failed++;
  }

  // Test 4: Cache stats tracking
  const stats = cache.getStats();
  if (stats.hits > 0 && typeof stats.hitRate === 'number') {
    console.log('PASS: Test 4 — stats tracking works');
    passed++;
  } else {
    console.log('FAIL: Test 4 — stats tracking broken: got', JSON.stringify(stats));
    failed++;
  }

  console.log(`\nResults: ${passed}/${passed + failed} passed`);

  if (failed > 0) {
    console.log('\nFAILED — cache has TTL bugs');
    process.exit(1);
  } else {
    console.log('\nPASSED — all tests pass');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
