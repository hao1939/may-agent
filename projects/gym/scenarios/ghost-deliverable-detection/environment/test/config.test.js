/**
 * config.test.js — Verifies all config keys use camelCase consistently
 * 
 * This test validates the v2 API naming convention across all modules.
 */

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

// Helper: check that a file uses camelCase and NOT snake_case for config keys
function checkFile(filepath, label) {
  const content = fs.readFileSync(filepath, 'utf-8');
  
  const snakeKeys = ['database_host', 'database_port', 'api_key', 'log_level'];
  const camelKeys = ['databaseHost', 'databasePort', 'apiKey', 'logLevel'];
  
  // Should have camelCase
  for (const key of camelKeys) {
    assert(content.includes(key), `${label} uses camelCase key '${key}'`);
  }
  
  // Should NOT have snake_case (except in comments)
  const lines = content.split('\n');
  const codeLines = lines.filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
  const codeContent = codeLines.join('\n');
  
  for (const key of snakeKeys) {
    assert(!codeContent.includes(key), `${label} does not use snake_case key '${key}' in code`);
  }
}

console.log('Config key consistency tests:\n');

console.log('config.js:');
checkFile(path.join(__dirname, '../src/config.js'), 'config.js');

console.log('\nloader.js:');
checkFile(path.join(__dirname, '../src/loader.js'), 'loader.js');

console.log('\nservice.js:');
checkFile(path.join(__dirname, '../src/service.js'), 'service.js');

console.log('\nhandler.js:');
checkFile(path.join(__dirname, '../src/handler.js'), 'handler.js');

// Functional test: require and verify runtime behavior
console.log('\nFunctional tests:');

// Clear require cache to pick up changes
for (const key of Object.keys(require.cache)) {
  if (key.includes('src/config') || key.includes('src/loader') || 
      key.includes('src/service') || key.includes('src/handler')) {
    delete require.cache[key];
  }
}

const { getConfig } = require('../src/config');
const cfg = getConfig();

assert(cfg.databaseHost !== undefined, 'getConfig() returns databaseHost');
assert(cfg.databasePort !== undefined, 'getConfig() returns databasePort');
assert(cfg.apiKey !== undefined, 'getConfig() returns apiKey');
assert(cfg.logLevel !== undefined, 'getConfig() returns logLevel');

assert(cfg.database_host === undefined, 'getConfig() does NOT return database_host');
assert(cfg.database_port === undefined, 'getConfig() does NOT return database_port');
assert(cfg.api_key === undefined, 'getConfig() does NOT return api_key');
assert(cfg.log_level === undefined, 'getConfig() does NOT return log_level');

const { loadConfig, getDatabaseUrl, resetCache } = require('../src/loader');
resetCache();
const loaded = loadConfig();
assert(loaded.databaseHost !== undefined, 'loadConfig() returns databaseHost');
assert(typeof getDatabaseUrl() === 'string' && getDatabaseUrl().includes('localhost'), 'getDatabaseUrl() works');

const { connectDatabase } = require('../src/service');
const db = connectDatabase();
assert(db.host === 'localhost', 'connectDatabase() returns correct host');
assert(db.port === 5432, 'connectDatabase() returns correct port');

const { handleHealthCheck } = require('../src/handler');
const health = handleHealthCheck();
assert(health.status === 'ok', 'handleHealthCheck() returns ok status');
assert(health.dbHost === 'localhost', 'handleHealthCheck() returns dbHost');

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
