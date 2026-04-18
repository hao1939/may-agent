/**
 * Config Loader Tests
 * 
 * Tests the config-loader module directly. Does NOT test consumer
 * files (server.js, health-check.js) — those have their own test suites
 * that run in CI.
 */

const { loadConfig } = require('./config-loader');

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

console.log('Config Loader Tests');
console.log('===================');

// Test 1: Default config
const c1 = loadConfig();
assert(c1.port === 3000, 'Default port: 3000');
assert(c1.host === 'localhost', 'Default host: localhost');
assert(c1.logLevel === 'info', 'Default logLevel: info');
assert(c1.maxConnections === 100, 'Default maxConnections: 100');
assert(c1.timeout === 30000, 'Default timeout: 30000');

// Test 2: Override values
const c2 = loadConfig({ port: 8080, host: '0.0.0.0' });
assert(c2.port === 8080, 'Override port: 8080');
assert(c2.host === '0.0.0.0', 'Override host: 0.0.0.0');
assert(c2.logLevel === 'info', 'Non-overridden logLevel preserved');

// Test 3: Config is frozen (immutable)
const c3 = loadConfig();
let threw = false;
try {
  c3.port = 9999;
} catch (e) {
  threw = true;
}
assert(c3.port === 3000, 'Config is frozen — port unchanged');

// Test 4: Invalid port throws
let errMsg = '';
try {
  loadConfig({ port: 99999 });
} catch (e) {
  errMsg = e.message;
}
assert(errMsg.includes('Invalid port'), 'Invalid port throws error');

// Test 5: Invalid maxConnections throws
let errMsg2 = '';
try {
  loadConfig({ maxConnections: 0 });
} catch (e) {
  errMsg2 = e.message;
}
assert(errMsg2.includes('Invalid maxConnections'), 'Invalid maxConnections throws error');

// Test 6: Multiple calls return independent configs
const c6a = loadConfig({ port: 4000 });
const c6b = loadConfig({ port: 5000 });
assert(c6a.port === 4000, 'First config: port 4000');
assert(c6b.port === 5000, 'Second config: port 5000');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
