const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock dependencies - using absolute path relative to project root since tests can run anywhere
const delegationMetrics = require(path.resolve(process.cwd(), 'agents/evaluator/skills/delegation-metrics.cjs'));

// Test data
const MOCK_DATA = [
  { timestamp: "2026-03-25T10:00:00Z", parent: "may", child: "coder", method: "call", status: "success", durationMs: 1000 },
  { timestamp: "2026-03-25T10:00:01Z", parent: "may", child: "coder", method: "call", status: "success", durationMs: 2000 },
  { timestamp: "2026-03-25T10:00:02Z", parent: "may", child: "coder", method: "call", status: "error", durationMs: 500 },
  { timestamp: "2026-03-25T10:00:03Z", parent: "may", child: "coder", method: "call", status: "success", durationMs: 3000 },
  { timestamp: "2026-03-25T10:00:04Z", parent: "may", child: "qa", method: "send", status: "sent", durationMs: null }
];

// Setup
const TEST_DIR = path.resolve(process.cwd(), '.state');
const TEST_FILE = path.join(TEST_DIR, 'delegations.jsonl');

// Ensure directory exists
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

async function runTest() {
  console.log("Running Delegation Metrics Test...");
  
  // Write mock data (reverse order as if appended)
  // We write it here to ensure it's fresh for the test
  fs.writeFileSync(TEST_FILE, MOCK_DATA.map(JSON.stringify).join('\n'));
  
  try {
    const result = await delegationMetrics({ limit: 10 });
    // console.log("Result:\n" + result); // Uncomment for debug

    // Assertions
    // We expect the result to be a markdown table.
    // The exact format depends on the implementation, but we can check for key strings.
    
    // Check may->coder stats: 4 total, 3 success (75%)
    // P50 of [1000, 2000, 3000] is 2000 (2.0s)
    // P90 of [1000, 2000, 3000] is 3000 (3.0s) (index 2.7 -> 2)
    
    // The previous implementation used exact string matching which is fragile to whitespace.
    // Let's use regex or includes for key parts.
    
    // Check for "may->coder" row
    if (!result.includes("may->coder")) {
      throw new Error("Missing 'may->coder' row");
    }
    
    // Check for 75.0% success rate
    if (!result.includes("75.0%")) {
      throw new Error("Incorrect success rate for may->coder (expected 75.0%)");
    }
    
    // Check for P50/P90
    if (!result.includes("2.0s") || !result.includes("3.0s")) {
       throw new Error("Incorrect P50/P90 latency");
    }

    console.log("PASS: Delegation Metrics Test");
  } catch (err) {
    console.error("FAIL:", err);
    process.exit(1);
  } finally {
    // Cleanup - removed to allow manual inspection if failed, or kept clean?
    // Let's clean up to be nice.
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
  }
}

runTest();
