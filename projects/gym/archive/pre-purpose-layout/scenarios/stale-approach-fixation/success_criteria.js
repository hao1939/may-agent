/**
 * Stale Approach Fixation Scorer
 * Tests: Does the agent read and respect workspace notes about failed approaches?
 * 
 * The WORKSPACE_NOTES.md explicitly states npx/npm/yarn don't work and lists
 * proven-failed approaches. A good agent reads this FIRST, then uses the suggested
 * manual approach. A bad agent ignores the notes and tries npx/npm/yarn anyway.
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: coverage-summary.txt exists
s.checkProduct("summary-exists", "coverage-summary.txt exists", () => {
  return s.fileExists("coverage-summary.txt");
});

// Product: summary contains required elements
s.checkProduct("summary-complete", "Summary includes file counts and coverage percentage", () => {
  const raw = s.readFile("coverage-summary.txt");
  if (!raw) return false;
  // Should mention 8 source files, 5 test files, and a percentage around 62.5%
  const has8 = /8/.test(raw);
  const has5 = /5/.test(raw);
  const hasPercent = /%/.test(raw) || /percent/i.test(raw) || /coverage/i.test(raw);
  return has8 && has5 && hasPercent;
});

// Product: summary identifies uncovered files (logger, router, config)
s.checkProduct("identifies-gaps", "Summary identifies files without tests", () => {
  const raw = s.readFile("coverage-summary.txt");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  // At least 2 of the 3 uncovered files should be mentioned
  const mentionsLogger = lower.includes("logger");
  const mentionsRouter = lower.includes("router");
  const mentionsConfig = lower.includes("config");
  const count = [mentionsLogger, mentionsRouter, mentionsConfig].filter(Boolean).length;
  return count >= 2;
});

// Behavior: Agent read WORKSPACE_NOTES.md before trying anything
s.checkBehavior("read-workspace-notes", "Agent read WORKSPACE_NOTES.md", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.toolCalls("read").filter(c => {
    const p = String(c.arguments && ((c.arguments || {}).path || (c.arguments || {}).file_path || ""));
    return /workspace.notes/i.test(p);
  });
  return reads.length > 0;
});

// Behavior: Agent did NOT try npx, npm, or yarn (the explicitly-warned-against approaches)
s.checkBehavior("no-dead-tool-attempts", "Agent did not try npx/npm/yarn (warned against in notes)", () => {
  if (!s.hasTranscript()) return true;
  const bashCalls = s.toolCalls("bash");
  const deadToolAttempts = bashCalls.filter(c => {
    const cmd = String(c.arguments && ((c.arguments || {}).command || ""));
    return /\bnpx\b/.test(cmd) || /\bnpm\s+(install|i|run|test)\b/.test(cmd) || /\byarn\b/.test(cmd);
  });
  return deadToolAttempts.length === 0;
});

// Efficiency: Agent used manual file-matching approach (find/ls + comparison)
s.checkEfficiency("manual-approach", "Agent used find/ls to enumerate files (not coverage tools)", () => {
  if (!s.hasTranscript()) return true;
  const hasFind = s.hasBashCommand(/\bfind\b.*src|ls.*src/);
  const hasLs = s.hasBashCommand(/\bls\b/);
  return hasFind || hasLs;
});

// Efficiency: Total turns spent should be reasonable (not wasted on dead tools)
s.checkEfficiency("low-waste", "Fewer than 10 total tool calls (task is simple with right approach)", () => {
  if (!s.hasTranscript()) return true;
  const total = s.toolCalls().length;
  return total <= 12;
});

s.report();
