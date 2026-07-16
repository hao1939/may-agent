// data-processor.test.js
// Test suite for data-processor

const { paginate, filterByScore, getActive, summarize } = require('./data-processor.ts');

const testRecords = [
  { id: 1, name: 'Alice', active: true, score: 85 },
  { id: 2, name: 'Bob', active: false, score: 72 },
  { id: 3, name: 'Charlie', active: true, score: 91 },
  { id: 4, name: 'Diana', active: true, score: 68 },
  { id: 5, name: 'Eve', active: false, score: 95 },
  { id: 6, name: 'Frank', active: true, score: 77 },
  { id: 7, name: 'Grace', active: true, score: 88 },
  { id: 8, name: 'Hank', active: false, score: 60 },
  { id: 9, name: 'Ivy', active: true, score: 93 },
  { id: 10, name: 'Jack', active: true, score: 81 },
];

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${expectedStr}`);
    console.log(`    Actual:   ${actualStr}`);
    failed++;
  }
}

console.log('Data Processor Test Results');
console.log('==========================\n');

// Pagination tests
console.log('paginate():');
assert('page 1, size 3 returns 3 records', 
  paginate(testRecords, 1, 3).length, 3);
assert('page 1, size 3 returns correct records',
  paginate(testRecords, 1, 3).map(r => r.id), [1, 2, 3]);
assert('page 2, size 3 returns correct records',
  paginate(testRecords, 2, 3).map(r => r.id), [4, 5, 6]);
assert('last page with partial fill',
  paginate(testRecords, 4, 3).map(r => r.id), [10]);
assert('page 0 returns empty', paginate(testRecords, 0, 3), []);
assert('negative page returns empty', paginate(testRecords, -1, 3), []);
assert('page beyond total returns empty', paginate(testRecords, 5, 3), []);
assert('page size 1 returns single record',
  paginate(testRecords, 1, 1).map(r => r.id), [1]);
assert('full page returns all',
  paginate(testRecords, 1, 10).length, 10);

console.log('\nfilterByScore():');
assert('min 90 returns 3 records',
  filterByScore(testRecords, 90).length, 3);
assert('min 0 returns all',
  filterByScore(testRecords, 0).length, 10);
assert('min 100 returns none',
  filterByScore(testRecords, 100).length, 0);

console.log('\ngetActive():');
assert('returns 7 active records',
  getActive(testRecords).length, 7);
assert('all returned are active',
  getActive(testRecords).every(r => r.active), true);

console.log('\nsummarize():');
assert('count is correct',
  summarize(testRecords).count, 10);
assert('empty records returns zeros',
  summarize([]), { count: 0, avgScore: 0, activeCount: 0 });

console.log('\n==========================');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
