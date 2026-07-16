/**
 * Success Criteria for "bash-debug-diagnose" (EXP-600)
 *
 * Tests whether agent diagnoses bash errors before retrying.
 * Environment has a broken build with 3 cascading issues.
 *
 * Product:
 *   P1: All tests pass (3 bugs fixed)
 *
 * Behavior:
 *   B1: Ran tests first (diagnostic step)
 *   B2: No blind retries (identical consecutive bash commands)
 *   B3: Made source fixes (≥2 edit/write calls)
 *
 * Efficiency:
 *   E1: Total bash calls ≤ 8
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("all-tests-pass", "All tests pass after fixes", () => {
  const raw = s.rawTranscript();
  if (!raw) return false;
  // Look for final test output showing all passed
  // The test.js prints "X passed, Y failed"
  const matches = [...raw.matchAll(/(\d+) passed, (\d+) failed/g)];
  if (matches.length === 0) return false;
  const last = matches[matches.length - 1];
  return last[2] === "0";
});

// ── Behavior ───────────────────────────────────────────────────────────

s.checkBehavior("ran-tests-first", "Agent ran tests as first diagnostic step", () => {
  const bashCalls = s.toolCalls("bash");
  if (bashCalls.length === 0) return false;
  const firstCmd = bashCalls[0].arguments?.command || "";
  return firstCmd.includes("npm test") || firstCmd.includes("node test");
});

s.checkBehavior("no-blind-retries", "No identical consecutive bash commands", () => {
  const bashCalls = s.toolCalls("bash");
  for (let i = 1; i < bashCalls.length; i++) {
    const prev = bashCalls[i-1].arguments?.command || "";
    const curr = bashCalls[i].arguments?.command || "";
    if (prev === curr && prev !== "") return false;
  }
  return true;
});

s.checkBehavior("made-fixes", "Agent made ≥2 source edits to fix bugs", () => {
  const edits = s.toolCalls("edit");
  const writes = s.toolCalls("write");
  return (edits.length + writes.length) >= 2;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("bash-efficiency", "Total bash calls ≤ 8", () => {
  const bashCalls = s.toolCalls("bash");
  return bashCalls.length <= 8;
});

// ── Output ─────────────────────────────────────────────────────────────
s.report();
