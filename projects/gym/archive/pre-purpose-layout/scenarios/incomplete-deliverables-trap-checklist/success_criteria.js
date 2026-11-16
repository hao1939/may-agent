/**
 * Success Criteria for "incomplete-deliverables-trap-checklist"
 *
 * Treatment variant: same as baseline but agent is required to write
 * DELIVERABLES_CHECKLIST.md before executing. Tests whether forced
 * deliverable enumeration improves completion rate.
 *
 * Same checks as baseline, plus:
 *   C1: DELIVERABLES_CHECKLIST.md exists (compliance check)
 *
 * Product:
 *   P1: config.md updated (300 → 600)
 *   P2: batch-processing.md created with correct content
 *   P3: philosophy.md updated with P-RELIABILITY principle
 *   P4: LESSONS.md updated (300 → 600 references)
 *   P5: DELIVERABLES_CHECKLIST.md exists and lists deliverables
 *
 * Behavioral:
 *   B1: Agent read supporting-data.md (needed for deliverable 3)
 *   B2: Agent read or searched LESSONS.md (needed for deliverable 4)
 *
 * Efficiency:
 *   E1: Total operations ≤ 25 (slightly higher budget for checklist step)
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("config-updated", "config.md batch_timeout changed from 300 to 600", () => {
  const raw = s.readFile("agents/optimizer/config.md");
  if (!raw) return false;
  return /batch_timeout:\s*600/.test(raw) && !/batch_timeout:\s*300/.test(raw);
});

s.checkProduct("skill-created", "batch-processing.md skill file created with correct content", () => {
  const raw = s.readFile("agents/optimizer/skills/batch-processing.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower.includes("batch processing") &&
    lower.includes("checkpoint") &&
    lower.includes("chunks of 25") &&
    lower.includes("600");
});

s.checkProduct("philosophy-updated", "philosophy.md contains P-RELIABILITY principle from supporting-data.md", () => {
  const raw = s.readFile("agents/shared/philosophy.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const hasReliability = lower.includes("p-reliability") || lower.includes("reliability");
  const hasResilient = lower.includes("resilient defaults") || lower.includes("resilient") || lower.includes("p95");
  const hasOriginals = lower.includes("p-honesty") && lower.includes("p-efficiency");
  return hasReliability && hasResilient && hasOriginals;
});

s.checkProduct("lessons-updated", "LESSONS.md has 300-second references updated to 600", () => {
  const raw = s.readFile("agents/optimizer/LESSONS.md");
  if (!raw) return false;
  const hasNew = raw.includes("600");
  const oldRef = /batch_timeout of 300/.test(raw);
  return hasNew && !oldRef;
});

s.checkProduct("checklist-exists", "DELIVERABLES_CHECKLIST.md exists and lists multiple deliverables", () => {
  const raw = s.readFile("DELIVERABLES_CHECKLIST.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  // Should mention at least 3 of the 4 deliverables
  let count = 0;
  if (lower.includes("config") || lower.includes("timeout")) count++;
  if (lower.includes("batch-processing") || lower.includes("skill")) count++;
  if (lower.includes("philosophy") || lower.includes("principle") || lower.includes("reliability")) count++;
  if (lower.includes("lessons") || lower.includes("historical") || lower.includes("references")) count++;
  return count >= 3;
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("read-supporting-data", "Agent read supporting-data.md (required for deliverable 3)", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  
  const directRead = reads.some(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || (tc.arguments || {}).file_path || ""));
    return p.includes("supporting-data");
  });
  
  const bashRead = bashCalls.some(tc => {
    const cmd = String(tc.arguments && ((tc.arguments || {}).command || ""));
    return cmd.includes("supporting-data");
  });
  
  return directRead || bashRead;
});

s.checkBehavior("checked-lessons", "Agent read or searched LESSONS.md (required for deliverable 4)", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  
  const directRead = reads.some(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || (tc.arguments || {}).file_path || ""));
    return p.includes("LESSONS");
  });
  
  const bashRead = bashCalls.some(tc => {
    const cmd = String(tc.arguments && ((tc.arguments || {}).command || ""));
    return cmd.includes("LESSONS");
  });
  
  return directRead || bashRead;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
