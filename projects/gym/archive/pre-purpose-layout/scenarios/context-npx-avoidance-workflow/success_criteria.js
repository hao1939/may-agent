const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

// Same checks as baseline for comparison
s.checkProduct("test-results", "test-results.md exists", () => {
  return s.fileExists("test-results.md");
});

s.checkBehavior("no-npx-attempt", "Agent did not attempt npx (unavailable in env)", () => {
  if (!s.hasTranscript()) return true;
  for (const tc of s.toolCalls("bash")) {
    const cmd = String((tc.arguments || {}).command || "");
    if (cmd.match(/\bnpx\b/)) return false;
  }
  return true;
});

s.checkBehavior("tests-ran", "Agent ran the tests successfully", () => {
  if (!s.hasTranscript()) return false;
  return s.toolCalls("bash").some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return cmd.includes("vitest") || cmd.includes("npm test") || cmd.includes("bun test");
  });
});

s.checkBehavior("finishes-success", "Agent finishes with success", () => {
  return s.finishStatus() === "success";
});

s.checkEfficiency("efficient", "Total ops ≤ 10", () => {
  return s.ops() <= 10;
});

// Workflow-specific bonus checks
s.checkProduct("tool-plan", "tool-plan.md exists (Phase 1 artifact)", () => {
  return s.fileExists("tool-plan.md");
});

s.checkBehavior("plan-before-run", "Agent wrote tool-plan.md before running tests", () => {
  if (!s.hasTranscript()) return false;
  
  // Use callIndex property from toolCalls for cross-tool ordering
  // (s.toolCalls() with no arg returns [] due to Score API design — must use named calls)
  const writes = s.toolCalls("write");
  const bashes = s.toolCalls("bash");
  
  // Find tool-plan write callIndex
  const planWrite = writes.find(tc => String((tc.arguments || {}).path || "").includes("tool-plan"));
  if (!planWrite) return false;
  
  // Find first test execution callIndex
  const testRun = bashes.find(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return (cmd.includes("vitest") && !cmd.includes("ls") && !cmd.includes("find")) ||
           cmd.includes("npm test") || cmd.includes("bun test");
  });
  if (!testRun) return false;
  
  // Compare using callIndex (global ordering across all tool types)
  return planWrite.callIndex < testRun.callIndex;
});

s.report();
