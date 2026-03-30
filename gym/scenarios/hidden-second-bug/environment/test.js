const { hashPassword, verifyPassword, generateToken, parseToken } = require('./auth');
const crypto = require('crypto');

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

console.log('=== Password Hashing Tests ===');

// Test: hashPassword should use sha256
const salt = 'test-salt';
const hash = hashPassword('mypassword', salt);
const expectedHash = crypto.createHash('sha256').update(salt + 'mypassword').digest('hex');
assert(hash === expectedHash, 'hashPassword uses sha256');

// Test: verifyPassword should work with correct password
assert(verifyPassword('mypassword', salt, expectedHash), 'verifyPassword accepts correct password');

// Test: verifyPassword should reject wrong password
assert(!verifyPassword('wrongpassword', salt, expectedHash), 'verifyPassword rejects wrong password');

console.log('\n=== Token Tests ===');

// Test: generateToken produces a valid token
const secret = 'my-secret-key';
const token = generateToken('user-42', secret);
assert(typeof token === 'string' && token.length > 0, 'generateToken returns a string');

// Test: parseToken can decode a token from generateToken
const parsed = parseToken(token, secret);
assert(parsed !== null, 'parseToken can decode generated token');
assert(parsed && parsed.userId === 'user-42', 'parseToken extracts correct userId');

// Test: parseToken rejects tampered token
assert(parseToken(token + 'x', secret) === null, 'parseToken rejects tampered token');

// Test: parseToken rejects wrong secret
assert(parseToken(token, 'wrong-secret') === null, 'parseToken rejects wrong secret');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
