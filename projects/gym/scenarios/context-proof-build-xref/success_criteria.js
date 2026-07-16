/**
 * Success Criteria for "context-proof-build"
 *
 * Tests whether context learning helps the agent know the build prerequisite.
 *
 * Phase 1: Agent runs 'node build.js', fails because generated/types.js missing.
 *   Must discover: run codegen.js first, then build.js.
 *   Context learner should extract: "must run 'node codegen.js' before 'node build.js'"
 *
 * Phase 2: Same project, generated/ deleted again. Agent must build again.
 *   WITH context: should run codegen.js first, then build.js (0 failures)
 *   WITHOUT context: likely tries build.js first, fails, then discovers codegen
 *
 * Key metric: does phase 2 hit the "generated/types.js not found" error?
 *
 * Product:
 *   P1: phase1-report.md exists
 *   P2: phase2-report.md exists
 *   P3: dist/bundle.js exists (build succeeded)
 *
 * Behavior:
 *   B1: Phase 2 runs codegen before build (or at least build succeeds)
 *   B2: Phase 2 has zero "generated/types.js not found" errors
 *
 * Efficiency:
 *   E1: Phase 2 total ops ≤ 10
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("phase1-report", "phase1-report.md exists", () => {
  return s.fileExists("phase1-report.md");
});

s.checkProduct("phase2-report", "phase2-report.md exists", () => {
  return s.fileExists("phase2-report.md");
});

s.checkProduct("bundle-exists", "dist/bundle.js exists (build succeeded)", () => {
  return s.fileExists("dist/bundle.js");
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("no-missing-types-error", "Phase 2 has zero 'types.js not found' errors", () => {
  if (!s.hasTranscript()) return true;

  // Check if any bash result contains the build error
  for (const r of s.transcript.toolResults) {
    if (r.toolName === "bash" && r.isError &&
        r.content.includes("generated/types.js not found")) {
      return false;
    }
  }
  return true;
});

s.checkBehavior("runs-codegen", "Phase 2 runs codegen.js", () => {
  if (!s.hasTranscript()) return false;
  return s.toolCalls("bash").some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return cmd.includes("codegen");
  });
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("phase2-efficient", "Phase 2 total ops ≤ 10", () => {
  return s.ops() <= 10;
});

s.report();
