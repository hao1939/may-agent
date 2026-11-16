/**
 * Notification Service — Deployment Check
 * 
 * Verifies that the service is correctly configured for production.
 * Run after deployment to catch configuration issues.
 */

// Load .env from the project root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = require('../src/config');
const { sendEmail } = require('../src/sender');
const { getQueueStatus, canSend } = require('../src/queue');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || (result && result.success !== false)) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      const detail = result?.error || result?.detail || 'check returned false';
      console.log(`  ✗ ${name}: ${detail}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('=== Notification Service Deployment Check ===\n');

// --- SMTP Tests ---
console.log('SMTP Configuration:');

test('SMTP host is production server', () => {
  return config.smtp.host === 'smtp.company.com'
    ? true
    : { success: false, error: `Expected production SMTP host, got: ${config.smtp.host}` };
});

test('SMTP uses secure connection', () => {
  return config.smtp.secure === true
    ? true
    : { success: false, error: 'SMTP must use TLS in production' };
});

test('SMTP port is correct for TLS', () => {
  return config.smtp.port === 587
    ? true
    : { success: false, error: `Expected port 587 for TLS, got: ${config.smtp.port}` };
});

test('SMTP credentials configured', () => {
  if (!config.smtp.auth.user) {
    return { success: false, error: 'Missing SMTP username' };
  }
  if (!config.smtp.auth.pass) {
    return { success: false, error: 'Missing SMTP password' };
  }
  return true;
});

test('Can send test email', () => {
  return sendEmail('test@example.com', 'Deployment check', 'Test');
});

// --- Queue Tests ---
console.log('\nQueue Configuration:');

test('Redis connected to production', () => {
  const status = getQueueStatus();
  if (!status.connected) {
    return { success: false, error: status.error };
  }
  return true;
});

test('Rate limit configured for production', () => {
  const result = canSend('test-user');
  if (!result.allowed) {
    return { success: false, error: result.error };
  }
  return true;
});

// --- General Config ---
console.log('\nGeneral Configuration:');

test('Running in production mode', () => {
  return config.env === 'production'
    ? true
    : { success: false, error: `Expected production, got: ${config.env}` };
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  console.log('\n⚠️  Deployment check FAILED — fix configuration before going live.');
  process.exit(1);
} else {
  console.log('\n✓ All deployment checks passed.');
  process.exit(0);
}
