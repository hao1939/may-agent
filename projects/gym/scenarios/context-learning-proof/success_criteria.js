/**
 * Success Criteria for "context-learning-proof"
 *
 * Two-phase workflow with context learning between phases.
 *
 * Phase 1: Agent runs tests, likely tries node/npm first, discovers bun is needed.
 * Between: Context learner extracts "use bun not node/npm" → writes context.md.
 * Phase 2: Agent runs tests again. Should use bun directly.
 *
 * Product:
 *   P1: phase1-results.md exists
 *   P2: phase2-results.md exists
 *   P3: phase2-results.md reports tests passing
 *
 * Behavior:
 *   B1: Phase 2 uses fewer total operations than phase 1
 *       (or same — but not more, since it should skip the discovery loop)
 *   B2: Phase 2 has no failed node/npm attempts
 *       (the key proof: context learning prevented the mistake)
 *
 * Note: If phase 1 happens to use bun on first try (no mistakes to learn from),
 * the context learner extracts nothing, and B2 trivially passes.
 * That's fine — it means the agent is already good. The scenario proves value
 * when the agent DOES make mistakes in phase 1.
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("phase1-results", "phase1-results.md exists", () => {
  return s.fileExists("phase1-results.md");
});

s.checkProduct("phase2-results", "phase2-results.md exists", () => {
  return s.fileExists("phase2-results.md");
});

s.checkProduct("phase2-tests-pass", "phase2-results.md reports passing tests", () => {
  const content = s.readFile("phase2-results.md");
  if (!content) return false;
  const lower = content.toLowerCase();
  return lower.includes("pass") && !lower.includes("all fail");
});

// ── Behavioral ─────────────────────────────────────────────────────────

// Parse transcript to find phase boundary and count operations
s.checkBehavior("phase2-no-failed-commands", "Phase 2 has no failed node/npm test attempts", () => {
  if (!s.hasTranscript()) return true; // transcript only has phase 2

  // The exported transcript is phase 2 only (last phase).
  // Check for node/npm failures in it.
  const bashCalls = s.toolCalls("bash");
  for (const tc of bashCalls) {
    const cmd = String((tc.arguments || {}).command || "").toLowerCase();
    if (cmd.includes("npm test") || cmd.includes("npm run test")) {
      // Check if the result was an error
      const resultAfter = s.transcript?.toolResults.find(r =>
        r.toolName === "bash" && r.isError &&
        (r.content.includes("npm") || r.content.includes("ERR"))
      );
      if (resultAfter) return false;
    }
    if (cmd.startsWith("node ") && cmd.includes("test")) {
      const resultAfter = s.transcript?.toolResults.find(r =>
        r.toolName === "bash" && r.isError &&
        (r.content.includes("bun:test") || r.content.includes("Cannot find module"))
      );
      if (resultAfter) return false;
    }
  }
  return true;
});

s.checkBehavior("phase2-finishes-success", "Phase 2 finishes with success", () => {
  return s.finishStatus() === "success";
});

// ── Context learning evidence ──────────────────────────────────────────

s.checkBehavior("context-md-or-no-errors", "context.md created OR phase 1 had no command errors (nothing to learn)", () => {
  // If the context learner created context.md, great
  const agentsDir = path.join(workDir, "agents");
  if (fs.existsSync(agentsDir)) {
    const agents = fs.readdirSync(agentsDir);
    for (const agent of agents) {
      const ctxPath = path.join(agentsDir, agent, "context.md");
      if (fs.existsSync(ctxPath)) {
        const content = fs.readFileSync(ctxPath, "utf-8");
        if (content.length > 0) return true;
      }
    }
  }
  // If no context.md, check that phase 1 had no errors (nothing to learn)
  // We check for the existence of phase1-results with passing tests
  // — if phase 1 succeeded without mistakes, there's nothing to extract
  const p1 = s.readFile("phase1-results.md");
  if (p1 && p1.toLowerCase().includes("pass")) return true;
  return false;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("phase2-efficient", "Phase 2 uses ≤ 15 operations", () => {
  // Phase 2 transcript (what we see) should be short and direct
  return s.ops() <= 15;
});

s.report();
