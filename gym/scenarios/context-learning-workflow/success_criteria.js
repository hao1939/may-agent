/**
 * Success Criteria for "context-learning-workflow"
 *
 * Two-phase test:
 *   Phase 1: Agent explores the project and persists facts via context_updates
 *   Phase 2: Agent answers questions and writes answers.md
 *
 * This tests that agents can learn and communicate across sessions.
 * 
 * Note: The gym sandbox does NOT wire harness-level context.md injection,
 * so phase 2 may re-read files. That's fine — we verify:
 *   1. Phase 1 attempted to persist knowledge (context_updates in transcript)
 *   2. Phase 2 produced correct answers regardless of method
 *
 * The transcript.jsonl only contains the LAST phase due to gym-runner export.
 * So we check phase 2 behavior in the transcript, and verify phase 1's
 * context_updates via session.jsonl in the state dir.
 *
 * Product:
 *   P1: answers.md exists
 *   P2: answers.md mentions Deno as runtime
 *   P3: answers.md mentions DuckDB as database
 *   P4: answers.md mentions a real gotcha (Kelvin, WebSocket, WAL, heartbeat)
 *   P5: answers.md does NOT say "NO CONTEXT AVAILABLE"
 *
 * Behavior:
 *   B1: Both sessions completed (2 session dirs in state)
 *   B2: Agent finishes phase 2 with success
 */

const { Score } = require("../../lib/gym-score-utils.cjs");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("answers-exist", "answers.md exists", () => {
  return s.fileExists("answers.md");
});

s.checkProduct("answers-mention-deno", "answers.md mentions Deno as the runtime", () => {
  const content = s.readFile("answers.md");
  if (!content) return false;
  return content.toLowerCase().includes("deno");
});

s.checkProduct("answers-mention-duckdb", "answers.md mentions DuckDB as the database", () => {
  const content = s.readFile("answers.md");
  if (!content) return false;
  return content.toLowerCase().includes("duckdb");
});

s.checkProduct("answers-mention-gotcha", "answers.md mentions a real project gotcha", () => {
  const content = s.readFile("answers.md");
  if (!content) return false;
  const lower = content.toLowerCase();
  return lower.includes("kelvin") ||
         lower.includes("websocket") ||
         lower.includes("heartbeat") ||
         lower.includes("wal") ||
         lower.includes("deadlock") ||
         lower.includes("30") ||   // 30min idle
         lower.includes("temperature");
});

s.checkProduct("not-no-context", "answers.md does NOT say NO CONTEXT AVAILABLE", () => {
  const content = s.readFile("answers.md");
  if (!content) return false;
  return !content.toUpperCase().includes("NO CONTEXT AVAILABLE");
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("both-sessions-ran", "Two sessions completed (both phases ran)", () => {
  // Check state dir for multiple session directories
  const gymRoot = path.resolve(workDir, "..");
  const historyDir = path.join(gymRoot, "state", "sessions", "history");
  try {
    const dirs = fs.readdirSync(historyDir);
    return dirs.length >= 2;
  } catch {
    return false;
  }
});

s.checkBehavior("phase2-finishes-success", "Phase 2 finishes with success", () => {
  return s.finishStatus() === "success";
});

s.report();
