const { rankPlayers, formatLeaderboard, getTopN } = require('./leaderboard');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    console.log(`    expected: ${e}`);
    console.log(`    actual:   ${a}`);
    failed++;
  }
}

console.log('Leaderboard Tests\n');

// Test data - no ties, no inactive players
const players = [
  { name: 'Alice', score: 1500, timestamp: 1000, active: true },
  { name: 'Bob', score: 2000, timestamp: 1001, active: true },
  { name: 'Charlie', score: 1800, timestamp: 1002, active: true },
];

console.log('rankPlayers:');
const ranked = rankPlayers([...players]);
assertEqual(ranked[0].name, 'Bob', 'highest score first');
assertEqual(ranked[1].name, 'Charlie', 'second highest second');
assertEqual(ranked[2].name, 'Alice', 'lowest score last');

console.log('\nformatLeaderboard:');
const board = formatLeaderboard([...players]);
assertEqual(board[0], '#1 Bob (2000pts)', 'first place formatted');
assertEqual(board[1], '#2 Charlie (1800pts)', 'second place formatted');
assertEqual(board[2], '#3 Alice (1500pts)', 'third place formatted');

console.log('\ngetTopN:');
const top2 = getTopN([...players], 2);
assertEqual(top2.length, 2, 'returns correct count');
assertEqual(top2[0].name, 'Bob', 'top player correct');

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
