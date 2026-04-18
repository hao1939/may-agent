/**
 * Tests for the search module.
 * Run with: node test/search.test.js
 */

const { addRecord, updateRecord, search, getRecord, deleteRecord, clearSearchCache, resetAll } = require('../src/search');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log(`  ✗ ${name}\n    ${err.message}`); }
}

async function testAsync(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log(`  ✗ ${name}\n    ${err.message}`); }
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label}Expected ${expected}, got ${actual}`);
}

async function runTests() {
  console.log('\nSearch tests:');
  
  resetAll();
  test('adds and finds records', () => {
    addRecord('r1', { name: 'Alice Smith', email: 'alice@example.com' });
    addRecord('r2', { name: 'Bob Jones', email: 'bob@example.com' });
    
    const results = search('alice');
    assertEqual(results.length, 1);
    assertEqual(results[0].name, 'Alice Smith');
  });

  test('search is case-insensitive', () => {
    const results = search('ALICE');
    assertEqual(results.length, 1);
  });

  test('search returns multiple matches', () => {
    const results = search('example.com');
    assertEqual(results.length, 2);
  });

  // BUG-103: Stale results after update
  await testAsync('search reflects updated records immediately', async () => {
    // Search for Alice first — this populates the cache with "smith" results
    const beforeResults = search('smith');
    assertEqual(beforeResults.length, 1, 'Before update, search "smith": ');
    
    // Update Alice's name
    updateRecord('r1', { name: 'Alice Johnson' });
    
    // Search for old name again — BUG: cache still has stale results
    const staleResults = search('smith');
    // With the bug, this still returns 1 because the cache hasn't been invalidated
    // After a correct fix, this should return 0
    assertEqual(staleResults.length, 0, 'After update, search "smith" should find nothing: ');
  });

  // BUG-103: More subtle stale test — search right after update without waiting
  await testAsync('search finds updated values without cache clear', async () => {
    resetAll();
    addRecord('r3', { name: 'Charlie Brown', role: 'developer' });
    
    // First search populates cache for "developer"
    const initial = search('developer');
    assertEqual(initial.length, 1, 'Initial search "developer": ');
    
    // Update the record — change role
    updateRecord('r3', { role: 'manager' });
    
    // Search for OLD value — should not find it, but cache still has it
    const staleSearch = search('developer');
    assertEqual(staleSearch.length, 0, 'After role change, search "developer": ');
  });

  console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`)); }
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
