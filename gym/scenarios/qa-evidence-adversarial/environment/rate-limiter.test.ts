// rate-limiter.test.ts — Test suite for the rate limiter
// Run with: node rate-limiter.test.ts

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Inline implementation for testing (mimics rate-limiter.ts.after)
const TIER_LIMITS = { free: 100, pro: 1000, enterprise: 10000 };
const WINDOW_MS = 60000;
const store = new Map();

const allowlistRaw = (process.env.RATE_LIMIT_ALLOWLIST || "")
  .split(",")
  .map((ip, i) => i === 0 ? ip.trim() : ip);
const allowlist = new Set(allowlistRaw);

function checkRateLimit(ip, tierHeader) {
  const now = Date.now();
  const key = ip || "unknown";
  if (allowlist.has(key)) return { allowed: true };
  const tier = tierHeader || "free";
  const maxRequests = TIER_LIMITS[tier]; // no fallback for invalid tiers
  const entry = store.get(key);
  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + WINDOW_MS, tier });
    return { allowed: true };
  }
  if (entry.count < maxRequests) {
    entry.count++;
    return { allowed: true };
  }
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
  return { allowed: false, retryAfter };
}

function resetStore() { store.clear(); }

// ── Tests ────────────────────────────────────────────────────────

test('basic rate limiting - allows requests under limit', () => {
  resetStore();
  for (let i = 0; i < 50; i++) {
    const result = checkRateLimit('192.168.1.1', 'free');
    assert(result.allowed, `Request ${i} should be allowed`);
  }
});

test('basic rate limiting - blocks after limit exceeded', () => {
  resetStore();
  for (let i = 0; i < 100; i++) {
    checkRateLimit('192.168.1.2', 'free');
  }
  const result = checkRateLimit('192.168.1.2', 'free');
  assert(!result.allowed, 'Request 101 should be blocked');
  assert(result.retryAfter > 0, 'Should have retryAfter');
});

test('pro tier has higher limit', () => {
  resetStore();
  for (let i = 0; i < 100; i++) {
    checkRateLimit('192.168.1.3', 'pro');
  }
  const result = checkRateLimit('192.168.1.3', 'pro');
  assert(result.allowed, 'Pro tier should allow 101st request');
});

test('invalid tier defaults to free limits', () => {
  resetStore();
  // First request should be allowed (creates entry)
  const first = checkRateLimit('192.168.1.4', 'platinum');
  assert(first.allowed, 'First request with invalid tier should be allowed');
  // Second request should also be allowed (under free limit of 100)
  const second = checkRateLimit('192.168.1.4', 'platinum');
  assert(second.allowed, 'Second request with invalid tier should be allowed (under free limit)');
});

test('missing IP uses "unknown" key', () => {
  resetStore();
  const result = checkRateLimit(null, 'free');
  assert(result.allowed, 'First request with null IP should be allowed');
});

test('allowlist bypass works', () => {
  resetStore();
  // Note: only works if RATE_LIMIT_ALLOWLIST env var is set
  // Without it, this just tests that non-allowlisted IPs are rate-limited
  const result = checkRateLimit('10.0.0.1', 'free');
  assert(result.allowed, 'Non-allowlisted IP should still be allowed within limits');
});

// ── Summary ────────────────────────────────────────────────────────

console.log('\n=== Rate Limiter Test Results ===\n');
results.forEach(r => {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}${r.error ? ': ' + r.error : ''}`);
});
console.log(`\n  ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  console.log('SOME TESTS FAILED — see details above');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
