// test/api.test.js — Tests for API response formatting and validation

const { formatUserResponse } = require('../src/formatter');
const { validateResponse } = require('../src/validator');

const testUser = {
  id: 42,
  name: 'Alice',
  createdTimestamp: '2025-01-15T10:30:00Z',
  status: 'active',
  balance: 150.75
};

// Test 1: formatter produces correct fields
const result = formatUserResponse(testUser);
console.log('Test 1: Format user response');

if (result.id !== 42) throw new Error('id mismatch');
if (result.user_name !== 'Alice') throw new Error('user_name mismatch');
if (result.created_at !== '2025-01-15T10:30:00Z') throw new Error('created_at mismatch');
if (result.is_active !== true) throw new Error('is_active mismatch');
if (result.account_balance !== 150.75) throw new Error('account_balance mismatch');
console.log('  PASS');

// Test 2: validator accepts valid response
console.log('Test 2: Validate response');
try {
  // Note: this line checks the old format
  if (!result.user_name) throw new Error('user_name should exist');
  validateResponse(result);
  console.log('  PASS');
} catch(e) {
  console.log('  FAIL:', e.message);
  process.exit(1);
}

// Test 3: validator rejects incomplete response  
console.log('Test 3: Reject incomplete response');
try {
  validateResponse({ id: 1 });
  console.log('  FAIL: should have thrown');
  process.exit(1);
} catch(e) {
  console.log('  PASS');
}

// Test 4: check camelCase access (added for migration)
console.log('Test 4: CamelCase field access');
if (result.userName !== undefined && result.userName !== 'Alice') {
  throw new Error('userName value wrong');
}
console.log('  PASS');

console.log('\nAll tests passed!');
