/**
 * Spec Adherence Multi-Step Scorer
 * Tests whether agent follows all 4 steps in order, produces correct deliverables,
 * and doesn't skip or reorder steps. Targets FM-1.1 (goal drift, spec miss) and
 * FM-5.3 (spec miss, overclaiming).
 */
const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

// Step 1 verification: Agent must read server-config.json
s.checkProduct("step-1-read-config", "Agent read server-config.json", () => {
  if (!s.hasTranscript()) return true;
  // Check transcript for a read of server-config.json
  return s.transcriptContains(/server-config\.json/i);
});

// Step 2 verification: Agent must read health-checks.log
s.checkProduct("step-2-read-logs", "Agent read health-checks.log", () => {
  if (!s.hasTranscript()) return true;
  return s.transcriptContains(/health-checks\.log/i);
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
s.checkConvention("step-order", "read-inputs-before-writing-outputs", () => {
  if (!s.hasTranscript()) return true;
  // Check that server-config.json read appears before audit-report.md write
  const configReadPos = s.transcriptIndexOf(/read.*server-config|server-config.*json/i);
  const reportWritePos = s.transcriptIndexOf(/write.*audit-report|edit.*audit-report/i);
  if (configReadPos === -1 || reportWritePos === -1) return true; // can't verify
  return configReadPos < reportWritePos;
});

s.report();
