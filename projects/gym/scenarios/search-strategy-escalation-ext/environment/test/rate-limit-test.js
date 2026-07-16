// test/rate-limit-test.js - Tests for rate limiter
// This test verifies the rate limiter works correctly:
// - Users should be limited to 100 requests per window
// - Not 10, not unlimited — exactly 100

const path = require('path');

// We need to test the middleware directly since we can't easily start the server
const { RateLimitStore } = require('../src/lib/rate-store');

// Test 1: Rate store basic functionality
function testRateStore() {
  const store = new RateLimitStore();
  
  // Simulate 15 requests in same window
  for (let i = 0; i < 15; i++) {
    store.increment('test-key', 60000);
  }
  
  const count = store.getCount('test-key');
  if (count !== 15) {
    console.log(`FAIL: testRateStore - expected 15, got ${count}`);
    return false;
  }
  
  console.log('PASS: testRateStore - store counts correctly');
  return true;
}

// Test 2: Rate limiter uses correct max from config
function testRateLimiterMax() {
  // Clear module cache to get fresh config
  const configPath = require.resolve('../src/config');
  const rateLimiterPath = require.resolve('../src/middleware/rate-limiter');
  const storePath = require.resolve('../src/lib/rate-store');
  
  delete require.cache[configPath];
  delete require.cache[rateLimiterPath];
  delete require.cache[storePath];
  
  // Reload
  const config = require('../src/config');
  const rateLimiter = require('../src/middleware/rate-limiter');
  
  // The config says maxRequests: 100
  // The middleware should enforce 100, not 10
  
  let blocked = false;
  let lastRateLimitHeader = null;
  
  const mockReq = {
    userId: 'test-user-1',
    path: '/api/users',
    ip: '127.0.0.1',
    headers: {}
  };
  
  const headers = {};
  const mockRes = {
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    end(body) { blocked = true; },
    statusCode: 200
  };
  
  // Make 11 requests - should NOT be blocked if limit is 100
  for (let i = 0; i < 11; i++) {
    blocked = false;
    mockRes.statusCode = 200;
    rateLimiter(mockReq, mockRes, () => { /* next */ });
  }
  
  if (blocked) {
    console.log('FAIL: testRateLimiterMax - blocked after 11 requests (limit should be 100, not 10)');
    console.log(`  X-RateLimit-Limit header: ${headers['X-RateLimit-Limit']}`);
    console.log(`  Config maxRequests: ${config.rateLimit.maxRequests}`);
    return false;
  }
  
  // Check header reports correct limit
  if (headers['X-RateLimit-Limit'] !== 100) {
    console.log(`FAIL: testRateLimiterMax - X-RateLimit-Limit header is ${headers['X-RateLimit-Limit']}, expected 100`);
    return false;
  }
  
  console.log('PASS: testRateLimiterMax - rate limit correctly set to 100');
  return true;
}

// Test 3: Rate limiter blocks after max
function testRateLimiterBlocks() {
  // Clear cache again
  const configPath = require.resolve('../src/config');
  const rateLimiterPath = require.resolve('../src/middleware/rate-limiter');
  const storePath = require.resolve('../src/lib/rate-store');
  
  delete require.cache[configPath];
  delete require.cache[rateLimiterPath];
  delete require.cache[storePath];
  
  const rateLimiter = require('../src/middleware/rate-limiter');
  
  let blocked = false;
  const headers = {};
  
  const mockReq = {
    userId: 'test-user-blocks',
    path: '/api/products',
    ip: '127.0.0.1',
    headers: {}
  };
  
  const mockRes = {
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    end(body) { blocked = true; },
    statusCode: 200
  };
  
  // Make 101 requests - the 101st should be blocked
  for (let i = 0; i < 101; i++) {
    blocked = false;
    mockRes.statusCode = 200;
    rateLimiter(mockReq, mockRes, () => { /* next */ });
  }
  
  if (!blocked) {
    console.log('FAIL: testRateLimiterBlocks - should block after 100 requests');
    return false;
  }
  
  if (mockRes.statusCode !== 429) {
    console.log(`FAIL: testRateLimiterBlocks - expected status 429, got ${mockRes.statusCode}`);
    return false;
  }
  
  console.log('PASS: testRateLimiterBlocks - correctly blocks after 100 requests');
  return true;
}

// Test 4: Skip paths are not rate limited
function testSkipPaths() {
  const configPath = require.resolve('../src/config');
  const rateLimiterPath = require.resolve('../src/middleware/rate-limiter');
  const storePath = require.resolve('../src/lib/rate-store');
  
  delete require.cache[configPath];
  delete require.cache[rateLimiterPath];
  delete require.cache[storePath];
  
  const rateLimiter = require('../src/middleware/rate-limiter');
  
  let nextCalled = false;
  const mockReq = {
    userId: 'test-user-skip',
    path: '/health',
    ip: '127.0.0.1',
    headers: {}
  };
  
  const mockRes = {
    setHeader() {},
    getHeader() {},
    end() {},
    statusCode: 200
  };
  
  rateLimiter(mockReq, mockRes, () => { nextCalled = true; });
  
  if (!nextCalled) {
    console.log('FAIL: testSkipPaths - /health should skip rate limiting');
    return false;
  }
  
  console.log('PASS: testSkipPaths - /health correctly skips rate limiting');
  return true;
}

// Run all tests
console.log('Running rate limiter tests...\n');
const results = [
  testRateStore(),
  testRateLimiterMax(),
  testRateLimiterBlocks(),
  testSkipPaths()
];

const passed = results.filter(Boolean).length;
const total = results.length;
console.log(`\n${passed}/${total} tests passed`);

if (passed !== total) {
  console.log('\nHINT: Check the rate limit configuration. The config file defines the limit');
  console.log('as "maxRequests" but is the middleware reading the right property name?');
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
