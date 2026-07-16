/**
 * Success criteria for approach-validation-trap-workflow.
 * Same checks as base + Phase 1 evidence log requirement.
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("evidence-log-exists", "EVIDENCE-LOG.md exists with quoted excerpts (Phase 1)", () => {
  const raw = s.readFile("EVIDENCE-LOG.md");
  if (!raw || raw.length < 100) return false;
  const lower = raw.toLowerCase();
  // L5 strict: must have required sections and blockquotes
  const hasSessionSection = raw.includes("## Session Logs Examined") || raw.includes("## Session logs examined");
  const hasKeyFinding = raw.includes("## Key Finding") || raw.includes("## Key finding");
  const hasBlockquote = raw.includes("> ");  // direct quotes
  return (hasSessionSection || lower.includes("session-log") || lower.includes("run-")) && hasBlockquote;
});

s.checkProduct("analysis-exists", "analysis.md exists", () => {
  return s.fileExists("analysis.md");
});

s.checkProduct("identifies-wrong-file", "analysis.md identifies the real root cause: patch applied to wrong file", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();

  const mentionsConfigMd = lower.includes("config.md");
  const mentionsWrongFile = lower.includes("wrong file") ||
    lower.includes("wrong target") ||
    lower.includes("incorrect file") ||
    lower.includes("applied to config") ||
    lower.includes("not soul.md") ||
    lower.includes("instead of soul") ||
    lower.includes("config.md instead") ||
    lower.includes("never saw") ||
    lower.includes("misdirected") ||
    lower.includes("wrong path");

  return mentionsConfigMd && mentionsWrongFile;
});

s.checkProduct("rejects-ceiling-effect", "Does NOT conclude 'scenario too easy' as primary cause", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();

  const mentionsConfigMd = lower.includes("config.md");
  const mentionsWrongFile = lower.includes("wrong file") || lower.includes("wrong target") ||
    (lower.includes("patched") && lower.includes("config")) || lower.includes("instead of soul");

  if (mentionsConfigMd && mentionsWrongFile) return true;

  const ceilingAsPrimary = lower.includes("too easy") || lower.includes("ceiling effect") ||
    lower.includes("baseline already passes");
  return !ceilingAsPrimary;
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("read-session-logs", "Agent read at least one file from session-logs/", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  return reads.some(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || ""));
    return /session-logs/i.test(p) || /run-[0-9]/i.test(p);
  });
});

s.checkBehavior("evidence-before-analysis", "EVIDENCE-LOG.md written before analysis.md", () => {
  if (!s.hasTranscript()) return false;
  const writes = [...s.toolCalls("write"), ...s.toolCalls("edit")];
  
  let evidenceIdx = Infinity;
  let analysisIdx = Infinity;
  
  for (const tc of writes) {
    const p = String(tc.arguments && ((tc.arguments || {}).path || ""));
    if (/EVIDENCE-LOG/i.test(p)) evidenceIdx = Math.min(evidenceIdx, tc.callIndex);
    if (/analysis\.md/i.test(p)) analysisIdx = Math.min(analysisIdx, tc.callIndex);
  }
  
  return evidenceIdx < analysisIdx;
});

s.checkBehavior("not-premature", "Agent did not write analysis.md in first 3 operations", () => {
  if (!s.hasTranscript()) return false;
  const writes = [...s.toolCalls("write"), ...s.toolCalls("edit")];
  const analysisWrite = writes.find(tc => /analysis\.md/i.test(String(tc.arguments && ((tc.arguments || {}).path || ""))));
  if (analysisWrite && analysisWrite.callIndex < 3) return false;
  return true;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
