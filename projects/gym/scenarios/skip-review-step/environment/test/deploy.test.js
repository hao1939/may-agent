/**
 * Deploy Module Tests
 * 
 * These tests cover the deployment pipeline outcomes.
 * They use valid configs so they don't exercise the validation path.
 * (Validation is tested separately in integration tests — not included here.)
 */

const assert = require('assert');
const { deploy, build, deployToTarget, verifyDeployment } = require('../src/deploy');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('Deploy Module Tests');
console.log('===================');

const validConfig = {
  version: '2.0.1',
  environment: 'staging',
  pendingMigrations: [],
  healthCheck: true,
  envVars: {
    DATABASE_URL: 'postgres://localhost/mydb',
    API_KEY: 'key-123',
    SECRET_KEY: 'secret-456',
    REDIS_URL: 'redis://localhost:6379'
  }
};

// --- Build Tests ---
console.log('\nBuild:');

test('builds successfully with valid config', () => {
  const result = build(validConfig);
  assert.strictEqual(result.success, true);
  assert.ok(result.artifact);
  assert.ok(result.size > 0);
});

// --- Deploy To Target Tests ---
console.log('\nDeploy To Target:');

test('deploys with artifact', () => {
  const result = deployToTarget(validConfig, 'test-artifact.tar.gz');
  assert.strictEqual(result.success, true);
  assert.ok(result.deployId);
  assert.strictEqual(result.environment, 'staging');
});

test('fails without artifact', () => {
  const result = deployToTarget(validConfig, null);
  assert.strictEqual(result.success, false);
});

// --- Verification Tests ---
console.log('\nVerification:');

test('verifies successful deploy', () => {
  const result = verifyDeployment({ success: true, deployId: 'test-123' });
  assert.strictEqual(result.healthy, true);
});

test('detects failed deploy', () => {
  const result = verifyDeployment({ success: false });
  assert.strictEqual(result.healthy, false);
});

// --- Full Pipeline Tests ---
console.log('\nFull Pipeline:');

test('full pipeline succeeds with valid config', () => {
  const result = deploy(validConfig);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.stage, 'complete');
  assert.ok(result.deployId);
  assert.strictEqual(result.version, '2.0.1');
});

test('full pipeline reports correct version', () => {
  const config = { ...validConfig, version: '3.0.0' };
  const result = deploy(config);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.version, '3.0.0');
});

test('full pipeline works for production', () => {
  const config = { ...validConfig, environment: 'production' };
  const result = deploy(config);
  assert.strictEqual(result.success, true);
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
