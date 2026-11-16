/**
 * Success Criteria for "scout-paper-evaluation"
 * 
 * Tests: Can the scout differentiate signal from noise in paper triage?
 * 
 * Product:
 *   P1: Paper 2 (EpiTool) rated HIGH
 *   P2: Paper 4 (VerifyChain) rated HIGH
 *   P3: Paper 1 (driving) rated LOW or IRRELEVANT
 *   P4: Paper 5 (debate scaling) rated LOW or IRRELEVANT
 *   P5: Paper 3 (CodeAlign) rated MEDIUM (tangential)
 *   P6: At least papers 2 and 4 recommended for deep dive
 *   P7: Evaluations file exists with all 5 papers covered
 * 
 * Convention:
 *   C1: Read focus-areas.md before evaluating
 *   C2: Read each paper before rating it
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

// Helper: read evaluations
function getEvals() {
  return s.readFile("environment/evaluations.md") || "";
}

function ratingFor(text, paperNum) {
  // Find the section for this paper and extract its rating
  const patterns = [
    new RegExp(`paper\\s*${paperNum}[^]*?(HIGH|MEDIUM|LOW|IRRELEVANT)`, 'i'),
    new RegExp(`#.*?${paperNum}[^]*?(HIGH|MEDIUM|LOW|IRRELEVANT)`, 'i'),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function deepDiveFor(text, paperNum) {
  // Check if deep dive recommended for this paper
  const section = text.split(/paper\s*\d/i);
  // Simpler: search near mentions of paper N for yes/no
  const re = new RegExp(`paper\\s*${paperNum}[^]*?(deep dive[^]*?(yes|no))`, 'i');
  const m = text.match(re);
  if (m) return m[2].toLowerCase();
  return null;
}

// P1: Paper 2 rated HIGH
s.checkProduct("paper2-high", "EpiTool (paper 2) rated HIGH relevance", () => {
  const r = ratingFor(getEvals(), 2);
  return r === "HIGH";
});

// P2: Paper 4 rated HIGH
s.checkProduct("paper4-high", "VerifyChain (paper 4) rated HIGH relevance", () => {
  const r = ratingFor(getEvals(), 4);
  return r === "HIGH";
});

// P3: Paper 1 rated LOW or IRRELEVANT
s.checkProduct("paper1-low", "Driving paper (paper 1) rated LOW or IRRELEVANT", () => {
  const r = ratingFor(getEvals(), 1);
  return r === "LOW" || r === "IRRELEVANT";
});

// P4: Paper 5 rated LOW or IRRELEVANT
s.checkProduct("paper5-low", "Debate scaling (paper 5) rated LOW or IRRELEVANT", () => {
  const r = ratingFor(getEvals(), 5);
  return r === "LOW" || r === "IRRELEVANT";
});

// P5: Paper 3 rated MEDIUM
s.checkProduct("paper3-medium", "CodeAlign (paper 3) rated MEDIUM", () => {
  const r = ratingFor(getEvals(), 3);
  return r === "MEDIUM";
});

// P6: Deep dives for papers 2 and 4
s.checkProduct("deep-dive-selection", "Papers 2 and 4 recommended for deep dive", () => {
  const text = getEvals();
  // Check that deep dive / yes appears near paper 2 and 4
  return (text.toLowerCase().includes("epitool") || text.includes("paper 2")) &&
         (text.toLowerCase().includes("verifychain") || text.includes("paper 4")) &&
         text.toLowerCase().includes("deep dive");
});

// P7: All 5 papers covered
s.checkProduct("all-covered", "All 5 papers have evaluations", () => {
  const text = getEvals();
  return text.includes("1") && text.includes("2") && text.includes("3") && 
         text.includes("4") && text.includes("5") && text.length > 200;
});

// Convention: read focus areas first
s.checkConvention("C1.1", "read-focus-areas", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.transcript.toolCalls.filter(tc =>
    (tc.name === "read" && tc.arguments?.path?.includes("focus-areas")) ||
    (tc.name === "bash" && tc.arguments?.command?.includes("focus-areas") && !tc.arguments?.command?.includes(">"))
  );
  return reads.length > 0;
});

// Convention: read papers before evaluating
s.checkConvention("C1.1", "read-papers-before-eval", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.transcript.toolCalls.filter(tc =>
    (tc.name === "read" && tc.arguments?.path?.includes("papers/")) ||
    (tc.name === "bash" && tc.arguments?.command?.includes("papers/") && !tc.arguments?.command?.includes(">"))
  );
  return reads.length >= 3; // at minimum read most papers
});

s.report();
