// Auth service tests
const { validateRequest, requireAdmin } = require('../src/auth');

// Helper: create a v2 format token
function makeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.fake-signature`;
}

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

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('Auth Service Tests:');

test('validates a valid token', () => {
  const token = makeToken({
    subject_id: 'user123',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    permissions: ['admin', 'write']
  });
  const result = validateRequest(token);
  assertEqual(result.valid, true, 'should be valid');
  assertEqual(result.userId, 'user123', 'should extract userId');
});

test('detects expired token', () => {
  const token = makeToken({
    subject_id: 'user123',
    expires_at: 1000000,  // long expired
    permissions: ['admin']
  });
  const result = validateRequest(token);
  assertEqual(result.valid, false, 'should be invalid');
});

test('detects admin permission', () => {
  const token = makeToken({
    subject_id: 'admin1',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    permissions: ['admin', 'write', 'read']
  });
  const result = requireAdmin(token);
  assertEqual(result.valid, true, 'admin should be valid');
  assertEqual(result.isAdmin, true, 'should detect admin');
});

test('rejects non-admin', () => {
  const token = makeToken({
    subject_id: 'regular',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    permissions: ['read']
  });
  const result = requireAdmin(token);
  assertEqual(result.valid, false, 'non-admin should fail');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
