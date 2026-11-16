const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

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

s.report();
