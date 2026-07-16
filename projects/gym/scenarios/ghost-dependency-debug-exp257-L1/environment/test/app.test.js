/**
 * Tests for the application — validates data records.
 * Run with: node test/app.test.js
 */

const { processRecord, processBatch, getAppInfo } = require('../src/app');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log(`  ✗ ${name}\n    ${err.message}`); }
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log('\nApp tests:');

test('app info returns correct name', () => {
  const info = getAppInfo();
  assertEqual(info.name, 'DataProcessor');
});

test('app info returns version', () => {
  const info = getAppInfo();
  assertEqual(info.version, '2.1.0');
});

test('registered types should include email, phone, zipcode', () => {
  const info = getAppInfo();
  const types = info.registeredTypes;
  if (!types.includes('email')) throw new Error(`Missing 'email' type. Registered: [${types}]`);
  if (!types.includes('phone')) throw new Error(`Missing 'phone' type. Registered: [${types}]`);
  if (!types.includes('zipcode')) throw new Error(`Missing 'zipcode' type. Registered: [${types}]`);
});

test('validates a good record', () => {
  const result = processRecord({
    email: 'alice@example.com',
    phone: '+1-555-0123',
    zipcode: '90210'
  });
  assertEqual(result.status, 'accepted');
});

test('rejects invalid email', () => {
  const result = processRecord({
    email: 'not-an-email',
    phone: '+1-555-0123',
    zipcode: '90210'
  });
  assertEqual(result.status, 'rejected');
  if (!result.errors.some(e => e.field === 'email')) {
    throw new Error('Expected email validation error');
  }
});

test('rejects invalid phone', () => {
  const result = processRecord({
    email: 'bob@test.com',
    phone: '123',
    zipcode: '90210'
  });
  assertEqual(result.status, 'rejected');
});

test('rejects invalid zipcode', () => {
  const result = processRecord({
    email: 'carol@test.com',
    phone: '+1-555-0199',
    zipcode: 'ABCDE'
  });
  assertEqual(result.status, 'rejected');
});

test('handles missing fields', () => {
  const result = processRecord({ email: 'test@test.com' });
  assertEqual(result.status, 'rejected');
  if (!result.errors.some(e => e.message === 'Missing required field')) {
    throw new Error('Expected missing field error');
  }
});

test('batch processes multiple records', () => {
  const results = processBatch([
    { email: 'a@b.com', phone: '+1-555-0000', zipcode: '12345' },
    { email: 'bad', phone: '+1-555-0000', zipcode: '12345' }
  ]);
  assertEqual(results.length, 2);
  assertEqual(results[0].status, 'accepted');
  assertEqual(results[1].status, 'rejected');
});

test('validates with custom schema', () => {
  const result = processRecord(
    { email: 'test@test.com' },
    { email: 'email' }
  );
  assertEqual(result.status, 'accepted');
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`)); }
process.exit(failed > 0 ? 1 : 0);
