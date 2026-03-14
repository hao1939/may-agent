// Test: verify-strategy-extraction.js
// Verifies that 'extract-strategy' can process a log file.

const extractStrategy = require('../../../../agents/evaluator/skills/extract-strategy.cjs');
const path = require('path');
const fs = require('fs');

async function runTest() {
  const logPath = path.resolve(__dirname, 'fixtures/session_fail_recover.jsonl');
  
  console.log(`Testing extraction on: ${logPath}`);
  
  if (!fs.existsSync(logPath)) {
    console.error("Fixture not found!");
    process.exit(1);
  }

  const result = await extractStrategy({ logPath, type: 'recovery' });
  
  console.log("\n--- Result ---");
  console.log(JSON.stringify(result, null, 2));

  // Assertions
  if (!result.lessons || result.lessons.length === 0) {
    console.error("FAIL: No lessons extracted.");
    process.exit(1);
  }
  
  const hasErrorTrigger = result.lessons.some(l => l.trigger.includes("File not found: main.ts"));
  if (!hasErrorTrigger) {
    console.error("FAIL: Expected trigger 'File not found: main.ts' not found.");
    process.exit(1);
  }

  console.log("\nPASS: Strategy extraction verified.");
}

runTest();
