/**
 * Success Criteria for "scout-duplicate-detection"
 *
 * Tests: Can the scout identify duplicate findings vs genuinely new ones?
 *
 * Candidates 1 and 2 are duplicates (match D-041 and D-042).
 * Candidates 3 and 4 are genuinely new.
 *
 * Product:
 *   P1: Candidate 1 identified as duplicate (same paper, same finding as D-041)
 *   P2: Candidate 2 identified as duplicate (same finding as D-042)
 *   P3: Candidate 3 added as new finding (adversarial verification — not in existing KB)
 *   P4: Candidate 4 added as new finding (graph memory — not in existing KB)
 *   P5: new-findings.md does NOT contain candidates 1 or 2
 *   P6: triage-log.md exists with reasoning
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

function getNewFindings() {
  return s.readFile("environment/new-findings.md") || "";
}

function getTriageLog() {
  return s.readFile("environment/triage-log.md") || "";
}

// P1: Candidate 1 NOT in new findings (it's a duplicate)
s.checkProduct("candidate1-skipped", "Candidate 1 (episodic memory) correctly identified as duplicate", () => {
  const findings = getNewFindings().toLowerCase();
  // Should NOT contain candidate 1's distinctive content
  return !findings.includes("35% improvement") && !findings.includes("park & williams");
});

// P2: Candidate 2 NOT in new findings (it's a duplicate)
s.checkProduct("candidate2-skipped", "Candidate 2 (skill overload) correctly identified as duplicate", () => {
  const findings = getNewFindings().toLowerCase();
  return !findings.includes("3 behavioral skill") && 
         !(findings.includes("40%") && findings.includes("context utilization"));
});

// P3: Candidate 3 IS in new findings
s.checkProduct("candidate3-added", "Candidate 3 (adversarial verification) added as new", () => {
  const findings = getNewFindings().toLowerCase();
  return findings.includes("adversarial") && (findings.includes("verif") || findings.includes("3.4x") || findings.includes("lopez"));
});

// P4: Candidate 4 IS in new findings
s.checkProduct("candidate4-added", "Candidate 4 (graph memory) added as new", () => {
  const findings = getNewFindings().toLowerCase();
  return findings.includes("graph") && (findings.includes("memory") || findings.includes("28%") || findings.includes("key-value"));
});

// P5: No duplicates leaked into new findings
s.checkProduct("no-duplicates-leaked", "new-findings.md contains only genuinely new items", () => {
  const findings = getNewFindings().toLowerCase();
  const hasDup1 = findings.includes("2604.09042") || (findings.includes("park") && findings.includes("williams") && findings.includes("episodic"));
  const hasDup2 = findings.includes("gym experiment") && findings.includes("40%") && findings.includes("skill");
  return !hasDup1 && !hasDup2;
});

// P6: Triage log exists with reasoning
s.checkProduct("triage-log-exists", "Triage log exists with reasoning for each candidate", () => {
  const log = getTriageLog();
  return log.length > 100 && 
         (log.includes("1") || log.toLowerCase().includes("candidate")) &&
         (log.toLowerCase().includes("duplicate") || log.toLowerCase().includes("skip") || log.toLowerCase().includes("existing") || log.toLowerCase().includes("already"));
});

// Convention: read existing knowledge before evaluating
s.checkConvention("C1.1", "read-existing-before-eval", () => {
  if (!s.hasTranscript()) return true;
  const writes = s.transcript.toolCalls.filter(tc =>
    (tc.name === "edit" || tc.name === "write") && 
    (tc.arguments?.path?.includes("new-findings") || tc.arguments?.path?.includes("triage-log"))
  );
  if (writes.length === 0) return true;
  const firstWrite = writes[0].entryIndex;
  const reads = s.transcript.toolCalls.filter(tc =>
    (tc.name === "read" && tc.arguments?.path?.includes("existing-knowledge/")) ||
    (tc.name === "bash" && tc.arguments?.command?.includes("existing-knowledge/") && !tc.arguments?.command?.includes(">"))
  );
  return reads.filter(r => r.entryIndex < firstWrite).length >= 1;
});

s.report();
