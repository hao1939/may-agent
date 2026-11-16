/**
 * Spec Adherence Multi-Step Scorer
 * Tests whether agent follows all 4 steps in order, produces correct deliverables,
 * and doesn't skip or reorder steps. Targets FM-1.1 (goal drift, spec miss) and
 * FM-5.3 (spec miss, overclaiming).
 */
const { Score } = require("@may-agent/gym/scoring");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

/**
 * Helper: search full transcript text (all tool calls + results) for a pattern.
 * Returns true if found anywhere in the transcript.
 */
function transcriptContains(pattern) {
  const transcriptPath = path.join(workDir, "transcript.jsonl");
  if (!fs.existsSync(transcriptPath)) return false;
  const raw = fs.readFileSync(transcriptPath, "utf-8");
  if (pattern instanceof RegExp) return pattern.test(raw);
  return raw.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Helper: find first position of pattern in transcript text.
 * Returns character offset or -1 if not found.
 */
function transcriptIndexOf(pattern) {
  const transcriptPath = path.join(workDir, "transcript.jsonl");
  if (!fs.existsSync(transcriptPath)) return -1;
  const raw = fs.readFileSync(transcriptPath, "utf-8");
  if (pattern instanceof RegExp) {
    const match = raw.match(pattern);
    return match ? match.index : -1;
  }
  return raw.toLowerCase().indexOf(pattern.toLowerCase());
}

// Step 1 verification: Agent must read server-config.json
s.checkProduct("step-1-read-config", "Agent read server-config.json", () => {
  if (!s.hasTranscript()) return true;
  // Check transcript for a read of server-config.json
  return s.hasToolWithArgs("read", { path: /server-config\.json/ }) ||
         transcriptContains(/server-config\.json/i);
});

// Step 2 verification: Agent must read health-checks.log
s.checkProduct("step-2-read-logs", "Agent read health-checks.log", () => {
  if (!s.hasTranscript()) return true;
  return s.hasToolWithArgs("read", { path: /health-checks\.log/ }) ||
         transcriptContains(/health-checks\.log/i);
});

// Step 3 verification: audit-report.md exists with required content
s.checkProduct("step-3-report-exists", "audit-report.md was created", () => {
  return s.fileExists("audit-report.md");
});

s.checkProduct("step-3-report-service-count", "audit-report.md mentions 7 services", () => {
  const raw = s.readFile("audit-report.md");
  if (!raw) return false;
  return raw.includes("7");
});

s.checkProduct("step-3-report-errors", "audit-report.md mentions payment-gateway and cache-proxy errors", () => {
  const raw = s.readFile("audit-report.md");
  if (!raw) return false;
  const hasPayment = raw.toLowerCase().includes("payment");
  const hasCache = raw.toLowerCase().includes("cache");
  return hasPayment && hasCache;
});

s.checkProduct("step-3-report-severity", "audit-report.md includes severity ratings", () => {
  const raw = s.readFile("audit-report.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower.includes("critical") || lower.includes("warning") || lower.includes("info");
});

// Step 4 verification: audit-summary.txt exists with correct format
s.checkProduct("step-4-summary-exists", "audit-summary.txt was created", () => {
  return s.fileExists("audit-summary.txt");
});

s.checkProduct("step-4-summary-format", "audit-summary.txt follows required format", () => {
  const raw = s.readFile("audit-summary.txt");
  if (!raw) return false;
  // Should match: N services checked, M errors found, highest severity: level
  return /\d+\s+services?\s+checked/i.test(raw) &&
         /\d+\s+errors?\s+found/i.test(raw) &&
         /highest\s+severity/i.test(raw);
});

// Convention: Agent should emit a checklist/plan first (task-adherence skill)
s.checkConvention("task-adherence", "plan-before-action", () => {
  if (!s.hasTranscript()) return true;
  // First assistant message should contain planning/checklist language
  return s.firstMessageContains(/step|checklist|plan|1\.|first/i);
});

// Convention: finish() includes deliverables
s.checkConvention("C40.3", "finish-includes-deliverables", () => {
  if (!s.hasTranscript()) return true;
  const finish = s.finishCall();
  if (!finish) return false;
  const finishJson = JSON.stringify(finish).toLowerCase();
  return finishJson.includes("audit-report") || finishJson.includes("audit-summary");
});

// Order verification: Steps should be in order (read config before report)
// Uses structured tool call matching to avoid false positives from checklist
// content (e.g., writing CHECKLIST.md that mentions "audit-report" in its text).
s.checkConvention("step-order", "read-inputs-before-writing-outputs", () => {
  if (!s.hasTranscript()) return true;
  // Find first read of server-config.json (by path arg)
  const readCalls = s.toolCalls("read");
  const configRead = readCalls.find(tc =>
    typeof (tc.arguments || {}).path === "string" && /server-config\.json/i.test((tc.arguments || {}).path)
  );
  // Find first write/edit of audit-report.md (by path arg, not content)
  const writeCalls = s.toolCalls("write").concat(s.toolCalls("edit"));
  const reportWrite = writeCalls.find(tc =>
    typeof (tc.arguments || {}).path === "string" && /audit-report/i.test((tc.arguments || {}).path)
  );
  if (!configRead || !reportWrite) return true; // can't verify
  return configRead.callIndex < reportWrite.callIndex;
});

s.report();
