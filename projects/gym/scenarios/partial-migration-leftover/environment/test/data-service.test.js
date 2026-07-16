const { fetchAndFormat, fetchAndFormatByUser, getSummary, getRecord } = require('../src/data-service');

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

async function runTests() {
  console.log('=== Record Fetch Tests ===');

  // Test 1: getRecord returns correct record
  const rec = getRecord('rec_001');
  assert(rec !== null && rec.userId === 'usr_001', 'getRecord returns correct record');

  // Test 2: getRecord returns null for missing ID
  assert(getRecord('rec_999') === null, 'getRecord returns null for missing ID');

  console.log('\n=== Single Record Format Tests ===');

  // Test 3: fetchAndFormat returns a string containing the display name
  const formatted = await fetchAndFormat('rec_001');
  assert(
    typeof formatted === 'string' && formatted.includes('Alice Johnson'),
    `fetchAndFormat includes display name (got: ${JSON.stringify(formatted)})`
  );

  // Test 4: fetchAndFormat includes the status label
  assert(
    typeof formatted === 'string' && formatted.includes('Active'),
    'fetchAndFormat includes status label'
  );

  // Test 5: fetchAndFormat includes the formatted amount
  assert(
    typeof formatted === 'string' && formatted.includes('$150.00'),
    'fetchAndFormat includes formatted amount'
  );

  // Test 6: fetchAndFormat returns null for missing record
  const missing = await fetchAndFormat('rec_999');
  assert(missing === null, 'fetchAndFormat returns null for missing record');

  console.log('\n=== User Records Tests ===');

  // Test 7: fetchAndFormatByUser returns formatted records for user
  const userRecords = await fetchAndFormatByUser('usr_001');
  assert(
    Array.isArray(userRecords) && userRecords.length === 2,
    `User usr_001 has 2 records (got ${userRecords ? userRecords.length : 0})`
  );

  // Test 8: fetchAndFormatByUser returns empty array for unknown user
  const noRecords = await fetchAndFormatByUser('usr_999');
  assert(Array.isArray(noRecords) && noRecords.length === 0, 'Unknown user returns empty array');

  // Test 9: Each formatted user record is a string containing "Record:"
  assert(
    userRecords.every(r => typeof r === 'string' && r.startsWith('Record:')),
    'All user records are formatted strings'
  );

  console.log('\n=== Summary Tests ===');

  // Test 10: getSummary returns correct total count
  const summary = getSummary();
  assert(summary.totalRecords === 5, `Total records is 5 (got ${summary.totalRecords})`);

  // Test 11: getSummary returns correct total amount
  assert(summary.totalAmount === 775.75, `Total amount is 775.75 (got ${summary.totalAmount})`);

  // Test 12: getSummary returns formatted total
  assert(summary.formattedTotal === '$775.75', `Formatted total is $775.75 (got ${summary.formattedTotal})`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
