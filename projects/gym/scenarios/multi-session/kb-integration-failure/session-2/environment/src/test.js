/**
 * test.js — API Client Tests
 * 
 * Verifies the API client module meets quality requirements:
 * - No hardcoded credentials
 * - Retry logic with exponential backoff
 * - Proper error handling (no swallowed errors)
 * - Rate limiting support
 * - Config-driven API key
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Read source files for static analysis ──

const apiClientSrc = fs.readFileSync(path.join(__dirname, 'api-client.js'), 'utf8');
const configSrc = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
const dataServiceSrc = fs.readFileSync(path.join(__dirname, 'data-service.js'), 'utf8');

// Strip comments for code analysis
function stripComments(src) {
  return src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const apiClientCode = stripComments(apiClientSrc);
const configCode = stripComments(configSrc);

// ── Test Suite 1: No Hardcoded Credentials ──

console.log('\nTesting credentials...');

test('API key not hardcoded in api-client.js', () => {
  // Look for common patterns of hardcoded keys
  const hardcodedPatterns = [
    /['"]sk_live_[^'"]+['"]/,
    /['"]sk_test_[^'"]+['"]/,
    /API_KEY\s*=\s*['"][a-zA-Z0-9_]+['"]/,
    /apiKey\s*[:=]\s*['"][a-zA-Z0-9_]{20,}['"]/
  ];
  
  for (const pattern of hardcodedPatterns) {
    assert(!pattern.test(apiClientCode),
      `Found hardcoded API key pattern: ${pattern}`);
  }
});

test('API key comes from config or environment', () => {
  const usesConfig = /require\s*\(\s*['"]\.\/config['"]\s*\)/.test(apiClientCode) ||
                     /config\.api\.apiKey/.test(apiClientCode) ||
                     /process\.env/.test(apiClientCode);
  assert(usesConfig, 'api-client.js should read API key from config.js or process.env');
});

test('Config reads API key from environment variable', () => {
  assert(/process\.env/.test(configCode),
    'config.js should read API key from environment variable');
  assert(/PRODUCT_API_KEY/.test(configCode),
    'config.js should reference PRODUCT_API_KEY env var');
});

// ── Test Suite 2: Error Handling ──

console.log('\nTesting error handling...');

test('Does not silently swallow errors', () => {
  // Bad patterns: catching errors and returning empty/default
  const swallowPatterns = [
    /catch\s*\([^)]*\)\s*\{[^}]*resolve\s*\(\s*\[\s*\]\s*\)/s,
    /\.on\s*\(\s*['"]error['"]\s*,\s*[^)]*resolve\s*\(\s*\[\s*\]\s*\)/s,
    /error.*ignored/i,
    /console\.log\s*\(\s*['"].*error.*ignored/i
  ];
  
  let swallowed = false;
  for (const pattern of swallowPatterns) {
    if (pattern.test(apiClientCode)) {
      swallowed = true;
      break;
    }
  }
  assert(!swallowed, 'Errors should be thrown/rejected, not silently resolved with empty data');
});

test('Throws or rejects on HTTP errors', () => {
  const hasErrorHandling = /reject\s*\(/.test(apiClientCode) ||
                           /throw\s+new\s+Error/.test(apiClientCode) ||
                           /throw\s+/.test(apiClientCode) ||
                           /\.status/.test(apiClientCode);
  assert(hasErrorHandling, 'Should throw/reject on HTTP errors, not silently succeed');
});

test('Checks HTTP status codes', () => {
  const checksStatus = /statusCode|status\s*[!=<>]|res\.ok/.test(apiClientCode) ||
                       /[45]\d{2}/.test(apiClientCode);
  assert(checksStatus, 'Should check HTTP response status codes');
});

// ── Test Suite 3: Retry Logic ──

console.log('\nTesting retry logic...');

test('Has retry mechanism', () => {
  const retryIndicators = [
    /retry/i,
    /attempt/i,
    /backoff/i,
    /MAX_RETRIES|maxRetries|max_retries/,
    /retryCount|retryAttempt/i
  ];
  
  const found = retryIndicators.filter(p => p.test(apiClientCode));
  assert(found.length >= 1, 'Should have retry logic (look for retry/attempt/backoff patterns)');
});

test('Has exponential backoff or delay between retries', () => {
  const backoffIndicators = [
    /exponential/i,
    /backoff/i,
    /Math\.pow|2\s*\*\*|\*\s*2/,
    /delay\s*\*/,
    /setTimeout|sleep|wait/i
  ];
  
  const found = backoffIndicators.filter(p => p.test(apiClientCode));
  assert(found.length >= 1, 'Should use exponential backoff between retries');
});

test('Limits retries to reasonable count', () => {
  const retryLimit = apiClientCode.match(/(?:MAX_RETRIES|maxRetries|max_retries|retries)\s*[:=]\s*(\d+)/i);
  if (retryLimit) {
    const count = parseInt(retryLimit[1]);
    assert(count >= 2 && count <= 5, `Retry limit ${count} should be between 2-5`);
  }
  // Also accept if there's a for-loop with retry count
  const hasLoopRetry = /for\s*\([^)]*(?:retry|attempt|tries)/i.test(apiClientCode) ||
                       /while\s*\([^)]*(?:retry|attempt|tries)/i.test(apiClientCode);
  assert(retryLimit || hasLoopRetry, 'Should have a configurable retry limit');
});

// ── Test Suite 4: Rate Limiting ──

console.log('\nTesting rate limiting...');

test('Has rate limiting mechanism', () => {
  const rateLimitIndicators = [
    /rate.?limit/i,
    /throttl/i,
    /requests?.?per/i,
    /bucket/i,
    /token.?bucket/i,
    /sliding.?window/i,
    /queue/i,
    /concurrent/i
  ];
  
  const found = rateLimitIndicators.filter(p => p.test(apiClientCode));
  assert(found.length >= 1, 'Should have rate limiting logic');
});

test('Rate limit is configurable', () => {
  const configurable = /rate.?limit/i.test(configCode) ||
                       /max.?requests/i.test(configCode) ||
                       /requests.?per/i.test(configCode) ||
                       /rate.?limit/i.test(apiClientCode + configSrc);
  // Accept if the value is in config, or passed as parameter, or as a constant
  const hasRateConfig = configurable ||
                        /RATE_LIMIT|rateLimit|rate_limit/i.test(apiClientCode);
  assert(hasRateConfig, 'Rate limit should be configurable');
});

// ── Test Suite 5: Module Integration ──

console.log('\nTesting integration...');

test('api-client.js exports required functions', () => {
  const api = require('./api-client');
  assert(typeof api.getProducts === 'function', 'Missing getProducts export');
  assert(typeof api.getProduct === 'function', 'Missing getProduct export');
  assert(typeof api.searchProducts === 'function', 'Missing searchProducts export');
});

test('data-service.js uses api-client', () => {
  assert(/require\s*\(\s*['"]\.\/api-client['"]\s*\)/.test(dataServiceSrc),
    'data-service.js should import from api-client.js');
});

// ── Results ──

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failed === 0) {
  console.log('ALL TESTS PASSED');
} else {
  console.log('SOME TESTS FAILED');
  process.exit(1);
}
