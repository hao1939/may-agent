/**
 * Test suite for user-service modules
 * DO NOT MODIFY THIS FILE
 */

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertThrows(fn, msg) {
  try { fn(); throw new Error(msg || 'Expected function to throw'); }
  catch (e) { if (e.message === msg) throw e; }
}

// ==================== Auth Tests ====================
console.log('\nAuth:');

const { generateToken, validateToken, hashPassword } = require('./auth');

test('generateToken creates valid token', () => {
  const token = generateToken('user123');
  assert(typeof token === 'string', 'Token should be a string');
  assert(token.startsWith('usr_'), 'Token should start with usr_');
  assert(validateToken(token), 'Generated token should pass validation');
});

test('validateToken rejects invalid tokens', () => {
  assert(!validateToken(''), 'Empty string should be invalid');
  assert(!validateToken('bad_token'), 'Bad prefix should be invalid');
  assert(!validateToken(null), 'null should be invalid');
});

test('hashPassword works and rejects short passwords', () => {
  const hash = hashPassword('securepassword123');
  assert(typeof hash === 'string' && hash.length === 64, 'Hash should be 64-char hex');
  assertThrows(() => hashPassword('short'));
});

// ==================== Cache Tests ====================
console.log('\nCache:');

const { Cache } = require('./cache');

test('cache set/get works', () => {
  const cache = new Cache(5000);
  cache.set('key1', 'value1');
  assert(cache.get('key1') === 'value1', 'Should retrieve stored value');
});

test('cache has() works', () => {
  const cache = new Cache(5000);
  cache.set('exists', 42);
  assert(cache.has('exists') === true, 'has() should return true for existing key');
  assert(cache.has('nope') === false, 'has() should return false for missing key');
});

test('cache size() works', () => {
  const cache = new Cache(5000);
  cache.set('a', 1);
  cache.set('b', 2);
  assert(cache.size() === 2, `Size should be 2, got ${cache.size()}`);
});

test('cache delete works', () => {
  const cache = new Cache(5000);
  cache.set('temp', 'data');
  cache.delete('temp');
  assert(cache.get('temp') === undefined, 'Deleted key should return undefined');
});

// ==================== Logger Tests ====================
console.log('\nLogger:');

const { Logger } = require('./logger');

test('logger records entries at or above min level', () => {
  const logger = new Logger('warn');
  logger.info('ignored');
  logger.warn('included');
  logger.error('also included');
  const entries = logger.getEntries();
  assert(entries.length === 2, `Expected 2 entries, got ${entries.length}`);
});

test('log entry has correct structure', () => {
  const logger = new Logger('debug');
  const entry = logger.info('test message', { requestId: 'abc' });
  assert(entry.level === 'info', `Level should be 'info', got '${entry.level}'`);
  assert(entry.message === 'test message', `Message mismatch: '${entry.message}'`);
  assert(entry.requestId === 'abc', 'Meta should be merged into entry');
  assert(entry.timestamp, 'Entry should have a timestamp');
});

test('logger.clear() removes all entries', () => {
  const logger = new Logger('debug');
  logger.info('one');
  logger.warn('two');
  logger.clear();
  assert(logger.getEntries().length === 0, 'Entries should be empty after clear');
});

// ==================== Config Tests ====================
console.log('\nConfig:');

const { Config, DEFAULTS } = require('./config');

test('config uses defaults', () => {
  const config = new Config();
  assert(config.get('port') === 3000, `Port should be 3000, got ${config.get('port')}`);
  assert(config.get('host') === 'localhost', 'Host should be localhost');
});

test('config overrides work', () => {
  const config = new Config({ port: 8080, debug: true });
  assert(config.get('port') === 8080, `Port should be 8080, got ${config.get('port')}`);
  assert(config.get('debug') === true, 'Debug should be true');
  assert(config.get('host') === 'localhost', 'Non-overridden should keep default');
});

// ==================== Summary ====================
console.log(`\nResults: ${passed}/${total} passed`);
if (failed > 0) {
  console.log(`${failed} test(s) failed.`);
  process.exit(1);
}
