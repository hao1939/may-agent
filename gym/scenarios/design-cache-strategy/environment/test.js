/**
 * Test suite for the data pipeline with caching.
 *
 * DO NOT MODIFY this file — it tests your cache implementation.
 *
 * Tests:
 * 1. Pipeline correctness (all events processed correctly)
 * 2. Cache API (get/set/stats exports exist and work)
 * 3. Cache effectiveness (hit rate > 60%)
 * 4. Memory safety (cache size bounded — not unlimited growth)
 * 5. DB call reduction (fewer DB calls than events)
 */

const { runPipeline } = require('./pipeline');
const db = require('./db');

// ─── Generate test workload (Zipf distribution) ───
function generateEvents(count, uniqueUsers) {
  const events = [];
  for (let i = 0; i < count; i++) {
    // Zipf-like: lower user IDs appear much more frequently
    const rank = Math.floor(Math.pow(Math.random(), 2) * uniqueUsers) + 1;
    events.push({
      id: `evt_${i}`,
      userId: `user_${rank}`,
      type: ['pageview', 'click', 'purchase', 'signup'][Math.floor(Math.random() * 4)],
      timestamp: Date.now() - Math.floor(Math.random() * 86400000)
    });
  }
  return events;
}

let passed = 0;
let failed = 0;
const total = 5;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL: ${name} — ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Test 1: Pipeline correctness ───
console.log('\n=== Pipeline Tests ===\n');

const events = generateEvents(50000, 2000);
db.resetCallCount();
const results = runPipeline(events);

test('Pipeline processes all events', () => {
  assert(results.length === 50000, `Expected 50000 results, got ${results.length}`);
  const processed = results.filter(r => r.status === 'processed');
  assert(processed.length > 0, 'No events were processed');
});

// ─── Test 2: Cache API ───
test('Cache module exists with correct API', () => {
  let cache;
  try {
    cache = require('./cache');
  } catch (e) {
    throw new Error('cache.js not found — you need to create it');
  }
  assert(typeof cache.get === 'function', 'cache.get must be a function');
  assert(typeof cache.set === 'function', 'cache.set must be a function');
  assert(typeof cache.stats === 'function', 'cache.stats must be a function');

  const stats = cache.stats();
  assert(stats && typeof stats.hits === 'number', 'stats().hits must be a number');
  assert(stats && typeof stats.misses === 'number', 'stats().misses must be a number');
  assert(stats && typeof stats.size === 'number', 'stats().size must be a number');
});

// ─── Test 3: Cache effectiveness ───
test('Cache hit rate > 60%', () => {
  let cache;
  try {
    cache = require('./cache');
  } catch (e) {
    throw new Error('cache.js not found');
  }
  const stats = cache.stats();
  const totalLookups = stats.hits + stats.misses;
  if (totalLookups === 0) {
    throw new Error('Cache was never used — pipeline must use the cache');
  }
  const hitRate = stats.hits / totalLookups;
  assert(hitRate > 0.6, `Hit rate ${(hitRate * 100).toFixed(1)}% is below 60% threshold`);
  console.log(`    (hit rate: ${(hitRate * 100).toFixed(1)}%, ${stats.hits} hits / ${totalLookups} lookups)`);
});

// ─── Test 4: Memory safety ───
test('Cache size is bounded (not unlimited growth)', () => {
  let cache;
  try {
    cache = require('./cache');
  } catch (e) {
    throw new Error('cache.js not found');
  }
  const stats = cache.stats();
  // With 2000 unique users, an unbounded cache would have ~2000 entries.
  // A bounded cache should have fewer (we set the bar generously at 5000
  // to avoid penalizing reasonable implementations).
  // The real test is: does the cache have ANY eviction mechanism?
  assert(stats.size <= 5000, `Cache size ${stats.size} suggests unbounded growth — need eviction`);

  // Additional check: if the cache has exactly as many entries as unique users,
  // it's likely unbounded (just a Map with no limit). Warn but don't fail.
  if (stats.size >= 1900) {
    console.log(`    ⚠️  Cache size (${stats.size}) ≈ unique users — may lack eviction policy`);
  }
});

// ─── Test 5: DB call reduction ───
test('DB calls reduced by caching', () => {
  const dbCalls = db.getCallCount();
  // Without caching: 50,000 DB calls (one per event)
  // With caching: should be much fewer (at most ~unique users for cold misses)
  assert(dbCalls < 50000, `${dbCalls} DB calls — caching didn't reduce calls at all`);
  assert(dbCalls < 10000, `${dbCalls} DB calls — expected < 10,000 with effective caching`);
  console.log(`    (${dbCalls} DB calls for 50,000 events — ${((1 - dbCalls / 50000) * 100).toFixed(1)}% reduction)`);
});

// ─── Summary ───
console.log(`\n${passed}/${total} tests passed`);
if (failed === 0) {
  console.log('ALL TESTS PASSED');
} else {
  console.log(`${failed} test(s) FAILED`);
  process.exit(1);
}
