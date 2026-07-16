/**
 * Success Criteria for "scout-actionability-assessment"
 *
 * Tests: Can scout distinguish actionable from non-actionable findings?
 *
 * Finding 1: IMMEDIATELY_ACTIONABLE (prompt prefix, no infra needed)
 * Finding 2: NOT_ACTIONABLE (needs GPU training we don't have)
 * Finding 3: NEEDS_EXPERIMENT (could analyze our transcripts)
 * Finding 4: IMMEDIATELY_ACTIONABLE (simple prompt change)
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

function getAssessment() {
  return s.readFile("environment/assessment.md") || "";
}

// P1: Finding 1 rated actionable
s.checkProduct("finding1-actionable", "Finding 1 (task plans) rated actionable", () => {
  const text = getAssessment().toLowerCase();
  const f1area = text.split(/finding\s*2/i)[0] || text;
  return f1area.includes("actionable") || f1area.includes("immediately") || f1area.includes("implement");
});

// P2: Finding 2 rated NOT actionable
s.checkProduct("finding2-not-actionable", "Finding 2 (fine-tuning) rated not actionable due to infra constraints", () => {
  const text = getAssessment().toLowerCase();
  // Find section about finding 2
  const parts = text.split(/finding\s*3/i);
  const f2area = parts[0]?.split(/finding\s*2/i)[1] || "";
  return f2area.includes("not actionable") || f2area.includes("not_actionable") || f2area.includes("cannot") || 
         f2area.includes("don't have") || f2area.includes("no gpu") || f2area.includes("infra") ||
         f2area.includes("not relevant") || f2area.includes("interesting_but");
});

// P3: Finding 3 rated needs experiment
s.checkProduct("finding3-needs-experiment", "Finding 3 (early prediction) rated needs experiment", () => {
  const text = getAssessment().toLowerCase();
  const parts = text.split(/finding\s*4/i);
  const f3area = parts[0]?.split(/finding\s*3/i)[1] || "";
  return f3area.includes("experiment") || f3area.includes("needs") || f3area.includes("test") || f3area.includes("analyz");
});

// P4: Finding 4 rated actionable
s.checkProduct("finding4-actionable", "Finding 4 (known issues section) rated immediately actionable", () => {
  const text = getAssessment().toLowerCase();
  const f4area = text.split(/finding\s*4/i)[1] || "";
  return f4area.includes("actionable") || f4area.includes("immediately") || f4area.includes("implement") || f4area.includes("simple");
});

// P5: Assessment addresses system constraints
s.checkProduct("constraints-considered", "Assessment references system constraints", () => {
  const text = getAssessment().toLowerCase();
  return (text.includes("constraint") || text.includes("infra") || text.includes("fine-tun") || 
          text.includes("gpu") || text.includes("don't have") || text.includes("api"));
});

// Convention: read constraints before assessing
s.checkConvention("C1.1", "read-constraints", () => {
  if (!s.hasTranscript()) return true;
  const writes = s.transcript.toolCalls.filter(tc =>
    (tc.name === "edit" || tc.name === "write") && tc.arguments?.path?.includes("assessment")
  );
  if (writes.length === 0) return true;
  const firstWrite = writes[0].entryIndex;
  const reads = s.transcript.toolCalls.filter(tc =>
    (tc.name === "read" && tc.arguments?.path?.includes("system-constraints")) ||
    (tc.name === "bash" && tc.arguments?.command?.includes("system-constraints") && !tc.arguments?.command?.includes(">"))
  );
  return reads.filter(r => r.entryIndex < firstWrite).length >= 1;
});

s.report();
