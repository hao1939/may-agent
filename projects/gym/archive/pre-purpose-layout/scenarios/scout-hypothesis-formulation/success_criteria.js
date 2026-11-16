/**
 * Success Criteria for "scout-hypothesis-formulation"
 *
 * Tests: Can the scout formulate a testable, actionable hypothesis from a paper?
 *
 * Product:
 *   P1: Hypothesis file exists
 *   P2: Has a specific testable claim (not vague)
 *   P3: References the paper's findings
 *   P4: Maps to our system's architecture
 *   P5: Includes experiment design with control/treatment/metric
 *   P6: Includes expected effect size with reasoning
 *   P7: Follows template format
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

function getHypothesis() {
  return s.readFile("environment/hypothesis.md") || "";
}

s.checkProduct("hypothesis-exists", "Hypothesis file exists with content", () => {
  return getHypothesis().length > 200;
});

s.checkProduct("testable-claim", "Contains a specific testable claim", () => {
  const text = getHypothesis().toLowerCase();
  return (text.includes("claim") || text.includes("hypothesis") || text.includes("predict") || text.includes("expect")) &&
         (text.includes("skill") || text.includes("inject")) &&
         (text.includes("improve") || text.includes("increase") || text.includes("reduce") || text.includes("decrease"));
});

s.checkProduct("references-paper", "References specific paper findings", () => {
  const text = getHypothesis().toLowerCase();
  return (text.includes("40%") || text.includes("23%") || text.includes("rivera") || text.includes("2604.07500") || 
          text.includes("adaptive skill")) &&
         (text.includes("bulk") || text.includes("selective") || text.includes("context utilization"));
});

s.checkProduct("maps-to-system", "Maps finding to our system architecture", () => {
  const text = getHypothesis().toLowerCase();
  return (text.includes("coder") || text.includes("skill file") || text.includes("agents/")) &&
         (text.includes("our") || text.includes("system") || text.includes("current"));
});

s.checkProduct("experiment-design", "Includes experiment with control/treatment/metric", () => {
  const text = getHypothesis().toLowerCase();
  return (text.includes("control") || text.includes("baseline")) &&
         (text.includes("treatment") || text.includes("intervention") || text.includes("change")) &&
         (text.includes("metric") || text.includes("measure") || text.includes("pass_rate") || text.includes("token"));
});

s.checkProduct("expected-effect", "Includes expected effect size with reasoning", () => {
  const text = getHypothesis().toLowerCase();
  return (text.includes("expected") || text.includes("predict") || text.includes("estimate")) &&
         (text.includes("%") || text.includes("percent") || text.includes("point"));
});

s.checkProduct("follows-template", "Follows the hypothesis template structure", () => {
  const text = getHypothesis();
  return (text.includes("Claim") || text.includes("claim")) &&
         (text.includes("Experiment") || text.includes("experiment")) &&
         (text.includes("Priority") || text.includes("priority") || text.includes("Risk") || text.includes("risk"));
});

// Convention: read sources before writing
s.checkConvention("C1.1", "read-before-write", () => {
  if (!s.hasTranscript()) return true;
  const writes = s.transcript.toolCalls.filter(tc =>
    (tc.name === "edit" || tc.name === "write") && tc.arguments?.path?.includes("hypothesis")
  );
  if (writes.length === 0) return true;
  const firstWrite = writes[0].entryIndex;
  const reads = s.transcript.toolCalls.filter(tc =>
    tc.name === "read" && (tc.arguments?.path?.includes("paper") || tc.arguments?.path?.includes("system") || tc.arguments?.path?.includes("template"))
  );
  return reads.filter(r => r.entryIndex < firstWrite).length >= 2;
});

s.report();
