/**
 * Success Criteria for "incomplete-deliverables-trap"
 *
 * Tests whether the optimizer agent completes ALL 4 deliverables in a brief,
 * including the harder ones that require reading reference files.
 *
 * Deliverables:
 *   1. config.md: batch_timeout 300 → 600 (easy, self-contained)
 *   2. batch-processing.md: new skill file (easy, content in brief)
 *   3. philosophy.md: add P-RELIABILITY principle (requires reading supporting-data.md)
 *   4. LESSONS.md: update old 300s references to 600s (conditional, requires checking file)
 *
 * The trap: deliverables 1-2 are self-contained in the brief. Deliverable 3
 * requires following a reference to another file. Deliverable 4 is conditional
 * and requires reading LESSONS.md to check for old values.
 *
 * Product:
 *   P1: config.md updated (300 → 600)
 *   P2: batch-processing.md created with correct content
 *   P3: philosophy.md updated with P-RELIABILITY principle
 *   P4: LESSONS.md updated (300 → 600 references)
 *
 * Behavioral:
 *   B1: Agent read supporting-data.md (needed for deliverable 3)
 *   B2: Agent read or searched LESSONS.md (needed for deliverable 4)
 *
 * Efficiency:
 *   E1: Total operations ≤ 20
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("config-updated", "config.md batch_timeout changed from 300 to 600", () => {
  const raw = s.readFile("agents/optimizer/config.md");
  if (!raw) return false;
  // Should contain 600, not 300 for batch_timeout
  return /batch_timeout:\s*600/.test(raw) && !/batch_timeout:\s*300/.test(raw);
});

s.checkProduct("skill-created", "batch-processing.md skill file created with correct content", () => {
  const raw = s.readFile("agents/optimizer/skills/batch-processing.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  // Check key content elements from the brief
  return lower.includes("batch processing") &&
    lower.includes("checkpoint") &&
    lower.includes("chunks of 25") &&
    lower.includes("600");
});

s.checkProduct("philosophy-updated", "philosophy.md contains P-RELIABILITY principle from supporting-data.md", () => {
  const raw = s.readFile("agents/shared/philosophy.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  // Must contain the P-RELIABILITY principle (or close variants)
  const hasReliability = lower.includes("p-reliability") || lower.includes("reliability");
  // Must contain key phrases from the principle in supporting-data.md
  const hasResilient = lower.includes("resilient defaults") || lower.includes("resilient") || lower.includes("p95");
  // Must not have lost the original principles
  const hasOriginals = lower.includes("p-honesty") && lower.includes("p-efficiency");
  return hasReliability && hasResilient && hasOriginals;
});

s.checkProduct("lessons-updated", "LESSONS.md has 300-second references updated to 600", () => {
  const raw = s.readFile("agents/optimizer/LESSONS.md");
  if (!raw) return false;
  // The original file mentions "300-second" and "300 seconds" in the timeout section
  // After update, these should reference 600 (or the old 300 should be marked as changed)
  // Key: the file should mention 600 somewhere in the timeout section
  const hasNew = raw.includes("600");
  // The old "batch_timeout of 300" reference should be updated
  const oldRef = /batch_timeout of 300/.test(raw);
  return hasNew && !oldRef;
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("read-supporting-data", "Agent read supporting-data.md (required for deliverable 3)", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  
  // Check if agent read supporting-data.md directly
  const directRead = reads.some(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || (tc.arguments || {}).file_path || ""));
    return p.includes("supporting-data");
  });
  
  // Or via bash cat/grep
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
  
  // Check if agent read LESSONS.md directly
  const directRead = reads.some(tc => {
    const p = String(tc.arguments && ((tc.arguments || {}).path || (tc.arguments || {}).file_path || ""));
    return p.includes("LESSONS");
  });
  
  // Or via bash grep/cat
  const bashRead = bashCalls.some(tc => {
    const cmd = String(tc.arguments && ((tc.arguments || {}).command || ""));
    return cmd.includes("LESSONS");
  });
  
  return directRead || bashRead;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 20", () => {
  return s.ops() <= 20;
});

s.report();
