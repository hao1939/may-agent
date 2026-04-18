const path = require("path");
const { readScores } = require("../src/reader");
const { calcStats } = require("../src/stats");

const DATA_FILE = path.join(__dirname, "..", "data", "scores.txt");

// ── Test helpers ──
let passed = 0;
let failed = 0;

function assertEqual(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

// ── Load and compute ──
const scores = readScores(DATA_FILE);
const stats = calcStats(scores);

// ═══════════════════════════════════
console.log("\n=== Data Loading Tests ===");

// The data file has 5 scores (after the header line)
assertEqual("score count", scores.length, 5);
assertEqual("includes highest score (12.5)", scores.includes(12.5), true);

// ═══════════════════════════════════
console.log("\n=== Statistics Sanity Tests ===");

// Basic sanity: sum should equal the sum of all loaded scores
const manualSum = scores.reduce((a, b) => a + b, 0);
assertEqual("sum matches loaded data",
  stats.sum, Math.round(manualSum * 100) / 100);

// Mean should equal sum/count
assertEqual("mean = sum/count",
  stats.mean, Math.round((stats.sum / stats.count) * 100) / 100);

// Min should be <= all scores
assert("min <= all scores",
  scores.every(s => stats.min <= s));

// Max should be >= all scores
assert("max >= all scores",
  scores.every(s => stats.max >= s));

// Median should be between min and max
assert("median in range",
  stats.median >= stats.min && stats.median <= stats.max);

// ── Results ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
