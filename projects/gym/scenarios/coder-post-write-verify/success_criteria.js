/**
 * Success Criteria for "coder-post-write-verify"
 *
 * Targets FM-3.3 (Post-Write Verification Gap) — the production failure
 * mode C1.6 is intended to fix.
 *
 * Unlike verify-before-finish (which explicitly tells the agent to verify),
 * THIS task deliberately does NOT mention verification. The agent must
 * proactively run a verification command (read the written file, run the
 * tests, cat, diff, etc.) between their last write/edit and finish().
 *
 * Product:
 *   P1: typo is fixed (.lenght → .length)
 *
 * Behavior (THE critical check — this is what C1.6 targets):
 *   B1: After the LAST write/edit, BEFORE finish(), the agent ran at
 *       least one verify-ish tool call:
 *         - read() the written file, OR
 *         - bash with cat/node/git diff/tsc/npm test/grep on the file
 *   B2: Agent called finish() with status=success
 *
 * Efficiency:
 *   E1: ≤ 15 ops
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ───────────────────────────────────────────────────────────
s.checkProduct("typo-fixed", "The .lenght typo is corrected to .length", () => {
  const raw = s.readFile("src/processor.js");
  if (!raw) return false;
  return !raw.includes(".lenght") && raw.includes(".length");
});

// ── Behavior: the FM-3.3 check ────────────────────────────────────────
s.checkBehavior(
  "verify-between-last-write-and-finish",
  "Agent ran a verification tool call after its last write/edit and before finish()",
  () => {
    if (!s.hasTranscript()) return false;
    const t = s.transcript ? s.transcript.toolCalls : null;
    if (!t || !t.length) return false;

    // Find index of last write/edit against processor.js and index of finish.
    let lastWriteIdx = -1;
    let finishIdx = Infinity;

    for (const e of t) {
      const tool = e.tool || e.name || "";
      const args = e.arguments || {};
      const pathArg = String(args.path || args.file_path || "");
      const idx = e.entryIndex;

      if ((tool === "write" || tool === "edit") && pathArg.includes("processor.js")) {
        lastWriteIdx = idx;
      }
      if (tool === "finish" && finishIdx === Infinity) {
        finishIdx = idx;
      }
    }

    if (lastWriteIdx < 0) return false; // no write — separate failure
    if (finishIdx === Infinity) return false; // never finished

    // Look for a verify-ish action strictly between lastWriteIdx and finishIdx.
    const verifyBashPatterns = [
      /\bcat\b/,
      /\bnode\b/,
      /\bgrep\b/,
      /\btsc\b/,
      /npm\s+test/,
      /git\s+diff/,
      /\bhead\b/,
      /\btail\b/,
      /\bawk\b/,
      /\bsed\b\s+-n/,
    ];

    for (const e of t) {
      const idx = e.entryIndex;
      if (idx <= lastWriteIdx) continue;
      if (idx >= finishIdx) break;

      const tool = e.tool || e.name || "";
      const args = e.arguments || {};

      if (tool === "read") {
        const p = String(args.path || args.file_path || "");
        if (p.includes("processor.js")) return true;
      }
      if (tool === "bash") {
        const cmd = String(args.command || "");
        if (verifyBashPatterns.some((p) => p.test(cmd))) return true;
      }
      if (tool === "grep") return true;
    }

    return false;
  }
);

s.checkBehavior("finishes-success", "Agent calls finish() with status=success", () => {
  return s.finishStatus() === "success";
});

// ── Efficiency ────────────────────────────────────────────────────────
s.checkEfficiency("reasonable-ops", "Total operations ≤ 15", () => s.ops() <= 15);

s.report();
