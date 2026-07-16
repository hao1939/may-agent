const { validateEmail, validateUsername, validatePassword, validateRegistration } = require('../src/validator');
const { UserService } = require('../src/user-service');

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

console.log('=== Email Validation Tests ===');

// Test 1: Standard email should be valid
assert(validateEmail('user@example.com').valid === true, 'Standard email is valid');

// Test 2: Email with + tag should be valid
assert(validateEmail('user+tag@example.com').valid === true, 'Email with + tag is valid');

// Test 3: Email with dots in local part should be valid
assert(validateEmail('first.last@example.com').valid === true, 'Email with dots is valid');

// Test 4: Email without @ should be invalid
assert(validateEmail('notanemail').valid === false, 'Missing @ is invalid');

// Test 5: Empty email should be invalid
assert(validateEmail('').valid === false, 'Empty email is invalid');

// Test 6: Email with subdomain should be valid
assert(validateEmail('user@mail.example.co.uk').valid === true, 'Subdomain email is valid');

console.log('\n=== Username Validation Tests ===');

// Test 7: Valid username
assert(validateUsername('john_doe').valid === true, 'Valid username accepted');

// Test 8: Username too short
assert(validateUsername('ab').valid === false, 'Too-short username rejected');

// Test 9: Username with valid characters
assert(validateUsername('user-123').valid === true, 'Hyphens and numbers accepted');

// Test 10: Username with invalid characters
assert(validateUsername('user@name').valid === false, 'Special chars rejected');

console.log('\n=== Password Validation Tests ===');

// Test 11: Valid password
assert(validatePassword('SecurePass1').valid === true, 'Valid password accepted');

// Test 12: Too short password
assert(validatePassword('Short1').valid === false, 'Too-short password rejected');

// Test 13: No uppercase
assert(validatePassword('nouppercase1').valid === false, 'No-uppercase rejected');

// Test 14: No number
assert(validatePassword('NoNumberHere').valid === false, 'No-number rejected');

console.log('\n=== Registration Integration Tests ===');

// Test 15: Valid registration
const result = validateRegistration({
  email: 'user+test@example.com',
  username: 'testuser',
  password: 'SecurePass1'
});
assert(result.valid === true, 'Valid registration passes');

// Test 16: Registration with invalid email
const badEmail = validateRegistration({
  email: 'invalid',
  username: 'testuser',
  password: 'SecurePass1'
});
assert(badEmail.valid === false, 'Invalid email fails registration');

// Test 17: UserService integration
const service = new UserService();
const regResult = service.register({
  email: 'new+user@example.com',
  username: 'newuser',
  password: 'GoodPass1'
});
assert(regResult.success === true, 'UserService registration succeeds');

// Test 18: Duplicate email
const dupResult = service.register({
  email: 'new+user@example.com',
  username: 'different',
  password: 'GoodPass1'
});
assert(dupResult.success === false, 'Duplicate email rejected');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
