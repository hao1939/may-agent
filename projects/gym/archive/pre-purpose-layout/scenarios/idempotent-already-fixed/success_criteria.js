/**
 * Success Criteria for "idempotent-already-fixed"
 *
 * Tests the idempotent-work-detection skill: check if work is already done before
 * starting implementation. All three "bugs" in the task are already fixed in the
 * environment files. The ideal agent should:
 *   1. Read the target files first (state check)
 *   2. Discover all fixes are already applied
 *   3. Finish with "already done" / "already fixed" without making changes
 *
 * Product:
 *   P1: middleware.js unchanged (no X-Internal bypass — already removed)
 *   P2: config.js unchanged (rateLimit already 100)
 *   P3: logger.js unchanged (Authorization already redacted)
 *
 * Behavior:
 *   B1: Agent reads at least 2 of 3 target files before any edit/write attempt
 *   B2: Agent recognizes fixes are already applied (mentions "already" in output)
 *   B3: Agent calls finish() with success status
 *   B4: Agent does NOT make any edits or writes to the source files
 *
 * Efficiency:
 *   E1: Total operations ≤ 15 (reading 3 files + finish should be ~5-8 ops)
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Reference content (the files should match these exactly) ──────────

const MIDDLEWARE_MARKERS = [
  "function rateLimiter(req, res, next)",
  "tracker.count > config.rateLimit",
  "module.exports = { rateLimiter, authenticate, requestLogger }"
];
// The bug was an X-Internal bypass — should NOT be present
const MIDDLEWARE_BUG = "X-Internal";

const CONFIG_MARKERS = [
  "rateLimit: 100",  // correct value
];
const CONFIG_BUG = "rateLimit: 10000"; // wrong value should NOT be present

const LOGGER_MARKERS = [
  "'authorization'",
  "[REDACTED]",
];
const LOGGER_BUG_PATTERNS = [
  // If the agent accidentally un-fixes the redaction
  /headers:\s*req\.headers/,
];

// ── Product Checks: Files should remain unchanged ─────────────────────

s.checkProduct("middleware-unchanged", "middleware.js has no X-Internal bypass (was already fixed)", () => {
  const raw = s.readFile("src/middleware.js");
  if (!raw) return false;
  // Must NOT contain the bypass
  if (raw.includes(MIDDLEWARE_BUG)) return false;
  // Must contain the correct structure
  return MIDDLEWARE_MARKERS.every(m => raw.includes(m));
});

s.checkProduct("config-unchanged", "config.js rateLimit is 100 (was already fixed)", () => {
  const raw = s.readFile("src/config.js");
  if (!raw) return false;
  if (raw.includes(CONFIG_BUG)) return false;
  return CONFIG_MARKERS.every(m => raw.includes(m));
});

s.checkProduct("logger-unchanged", "logger.js redacts Authorization (was already fixed)", () => {
  const raw = s.readFile("src/logger.js");
  if (!raw) return false;
  // Must have redaction logic
  if (!LOGGER_MARKERS.every(m => raw.includes(m))) return false;
  // Must not have been broken by agent edits
  return !LOGGER_BUG_PATTERNS.some(p => p.test(raw));
});

// ── Behavioral Checks ─────────────────────────────────────────────────

// B1: Agent reads target files early (state check before acting)
s.checkBehavior("state-check-first", "Agent reads ≥2 of 3 target files before any edit/write", () => {
  if (!s.hasTranscript()) return true; // vacuously true if no transcript

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  const targetFiles = ["middleware.js", "config.js", "logger.js"];

  // Find first edit/write to any target file
  let firstMod = Infinity;
  for (const e of t) {
    const tool = e.tool || e.name || "";
    const args = e.arguments || {};
    const p = String(args.path || args.command || "");

    if ((tool === "edit" || tool === "write") && targetFiles.some(f => p.includes(f))) {
      firstMod = Math.min(firstMod, e.entryIndex);
    }
    // Also catch bash-based modifications
    if (tool === "bash" && typeof args.command === "string") {
      const cmd = args.command;
      if (targetFiles.some(f => cmd.includes(f)) &&
          (cmd.includes(">") || cmd.includes("sed ") || cmd.includes("tee "))) {
        firstMod = Math.min(firstMod, e.entryIndex);
      }
    }
  }

  // Count reads of target files before the first modification (or all reads if no mod)
  let readsBeforeMod = 0;
  for (const e of t) {
    const tool = e.tool || e.name || "";
    const args = e.arguments || {};

    if (e.entryIndex >= firstMod) break;

    if (tool === "read" && targetFiles.some(f => String(args.path || "").includes(f))) {
      readsBeforeMod++;
    }
    // Also count bash reads (cat, head, grep)
    if (tool === "bash" && typeof args.command === "string") {
      const cmd = args.command;
      if (targetFiles.some(f => cmd.includes(f)) &&
          (cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("grep ") || cmd.includes("less "))) {
        readsBeforeMod++;
      }
    }
  }

  // If no modifications at all (ideal!), count all reads
  if (firstMod === Infinity) {
    let totalReads = 0;
    for (const e of t) {
      const tool = e.tool || e.name || "";
      const args = e.arguments || {};
      if (tool === "read" && targetFiles.some(f => String(args.path || "").includes(f))) {
        totalReads++;
      }
      if (tool === "bash" && typeof args.command === "string") {
        const cmd = args.command;
        if (targetFiles.some(f => cmd.includes(f)) &&
            (cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("grep "))) {
          totalReads++;
        }
      }
    }
    return totalReads >= 2;
  }

  return readsBeforeMod >= 2;
});

// B2: Agent recognizes fixes are already applied
s.checkBehavior("detects-already-done", "Agent mentions 'already' in messages or finish summary", () => {
  if (!s.hasTranscript()) return true;

  // Check assistant messages for "already" language
  const alreadyPattern = /already\s+(fixed|done|applied|correct|in place|present|resolved|implement)/i;
  const noChangePattern = /no\s+(changes?|fix(es)?|modifications?)\s+(needed|required|necessary)/i;
  const currentlyCorrectPattern = /(currently|is)\s+(correct|proper|fixed|secure|safe)/i;

  if (s.anyMessageContains(alreadyPattern)) return true;
  if (s.anyMessageContains(noChangePattern)) return true;
  if (s.anyMessageContains(currentlyCorrectPattern)) return true;

  // Also check finish() summary
  const fc = s.finishCall();
  if (fc) {
    const args = fc.arguments || {};
    const summary = String(args.summary || "");
    if (alreadyPattern.test(summary) || noChangePattern.test(summary) || currentlyCorrectPattern.test(summary)) {
      return true;
    }
  }

  return false;
});

// B3: Agent calls finish() with success
s.checkBehavior("finishes-success", "Agent calls finish() with status=success", () => {
  const status = s.finishStatus();
  return status === "success";
});

// B4: Agent does NOT edit/write to source files (no unnecessary changes)
s.checkBehavior("no-unnecessary-edits", "Agent makes no edit/write calls to src/ files", () => {
  if (!s.hasTranscript()) return true;

  const edits = s.toolCalls("edit");
  const writes = s.toolCalls("write");

  const srcFiles = ["middleware.js", "config.js", "logger.js"];

  for (const call of [...edits, ...writes]) {
    const p = String((call.arguments || {}).path || "");
    if (srcFiles.some(f => p.includes(f))) {
      return false; // Agent edited a source file — bad!
    }
  }

  // Also check for bash-based writes
  const bashCalls = s.toolCalls("bash");
  for (const call of bashCalls) {
    const cmd = String((call.arguments || {}).command || "");
    if (srcFiles.some(f => cmd.includes(f)) &&
        (cmd.includes(">") || cmd.includes("sed ") || cmd.includes("tee "))) {
      return false;
    }
  }

  return true;
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("low-ops", "Total operations ≤ 15 (task should complete quickly)", () => {
  return s.ops() <= 15;
});

s.report();
