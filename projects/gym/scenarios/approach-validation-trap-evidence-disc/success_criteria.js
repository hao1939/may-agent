/**
 * Success Criteria for "approach-validation-trap"
 *
 * Tests whether the agent traces evidence (reads session logs) before
 * concluding, rather than accepting the misleading results-summary.md
 * conclusion ("scenario too easy").
 *
 * The REAL root cause: the intervention was patched into config.md instead
 * of SOUL.md (visible in session-logs/run-4,5,6 setup logs). The agent
 * never saw the verification reminder because it was in the wrong file.
 *
 * Product:
 *   P1: analysis.md exists
 *   P2: analysis.md identifies the real cause (wrong file patched)
 *   P3: analysis.md does NOT conclude "scenario too easy" as the primary cause
 *
 * Behavior:
 *   B1: Agent read at least one session log from session-logs/
 *   B2: Agent did not conclude within first 3 tool calls (premature closure)
 *
 * Efficiency:
 *   E1: Total operations ≤ 25
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("analysis-exists", "analysis.md exists", () => {
  return s.fileExists("analysis.md");
});

s.checkProduct("identifies-wrong-file", "analysis.md identifies the real root cause: patch applied to wrong file (config.md instead of SOUL.md)", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();

  // Must mention the file mismatch — the patch went to config.md not SOUL.md
  const mentionsConfigMd = lower.includes("config.md");
  const mentionsWrongFile = lower.includes("wrong file") ||
    lower.includes("wrong target") ||
    lower.includes("incorrect file") ||
    lower.includes("patched to") ||
    lower.includes("applied to config") ||
    lower.includes("not soul.md") ||
    lower.includes("instead of soul") ||
    lower.includes("config.md instead") ||
    lower.includes("never saw") ||
    lower.includes("never read") ||
    lower.includes("not applied to soul") ||
    lower.includes("misdirected") ||
    lower.includes("wrong path");

  // Must mention the core issue: the agent didn't see the intervention
  const mentionsNotSeen = lower.includes("never saw") ||
    lower.includes("didn't see") ||
    lower.includes("did not see") ||
    lower.includes("not visible") ||
    lower.includes("not loaded") ||
    lower.includes("never loaded") ||
    lower.includes("agent did not read") ||
    lower.includes("agent never read") ||
    lower.includes("wrong file") ||
    lower.includes("config.md");

  return mentionsConfigMd && (mentionsWrongFile || mentionsNotSeen);
});

s.checkProduct("rejects-ceiling-effect", "analysis.md does NOT conclude 'scenario too easy' as the PRIMARY cause", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();

  // It's OK to mention the ceiling effect as a secondary observation.
  // But the PRIMARY diagnosis must be the wrong-file issue.
  // We check: does the analysis identify the wrong file as root cause?
  // If it does, we pass even if it also mentions "too easy" as a secondary factor.
  const mentionsConfigMd = lower.includes("config.md");
  const mentionsWrongFile = lower.includes("wrong file") ||
    lower.includes("wrong target") ||
    lower.includes("patched") && lower.includes("config") ||
    lower.includes("instead of soul");

  // If the real cause is identified, pass regardless of whether ceiling is mentioned
  if (mentionsConfigMd && mentionsWrongFile) return true;

  // If real cause NOT identified, check if agent just parroted the ceiling effect
  const ceilingAsPrimary = lower.includes("too easy") ||
    lower.includes("ceiling effect") ||
    lower.includes("baseline already passes") ||
    lower.includes("no room for improvement");

  // Fail if ceiling is mentioned but real cause is not
  return !ceilingAsPrimary;
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("read-session-logs", "Agent read at least one file from session-logs/", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  return reads.some(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || (tc.arguments || {}).file_path || ""));
    return /session-logs/i.test(p) || /run-[0-9]/i.test(p);
  });
});

s.checkBehavior("not-premature", "Agent did not write analysis.md in first 3 operations", () => {
  if (!s.hasTranscript()) return false;
  // Check that analysis.md writes and finish calls happen after sufficient exploration
  const writes = [...s.toolCalls("write"), ...s.toolCalls("edit")];
  const analysisWrite = writes.find(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || ""));
    return /analysis\.md/i.test(p);
  });
  // If analysis.md was written, it should not have been in the first 3 operations
  if (analysisWrite && analysisWrite.callIndex < 3) return false;
  // Check finish() wasn't called too early
  const finishCalls = s.toolCalls("finish");
  if (finishCalls.length > 0 && finishCalls[0].callIndex < 3) return false;
  return true;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
