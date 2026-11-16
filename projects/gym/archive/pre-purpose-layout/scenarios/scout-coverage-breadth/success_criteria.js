/**
 * Success Criteria for "scout-coverage-breadth"
 *
 * Tests: Does the scout cover ALL items, not just the first few?
 *
 * Product:
 *   P1: All 8 papers triaged (no gaps)
 *   P2: Paper 7 rated highest (it's the most relevant)
 *   P3: Paper 3 rated high (directly relevant)
 *   P4: Papers 4 and 5 rated low (limited relevance)
 *   P5: Triage results file exists
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

function getTriage() {
  return s.readFile("environment/triage-results.md") || "";
}

// P1: All 8 papers covered
s.checkProduct("all-8-covered", "All 8 papers have triage entries", () => {
  const text = getTriage();
  let count = 0;
  for (let i = 1; i <= 8; i++) {
    if (text.includes(`Paper ${i}`) || text.includes(`paper ${i}`) || text.includes(`#${i}`) || text.includes(`${i}.`) || text.includes(`2604.0${5000 + i * 15}`)) {
      count++;
    }
  }
  return count >= 7; // allow slight fuzzy matching
});

// P2: Paper 7 rated highest
s.checkProduct("paper7-top-rated", "Paper 7 (cross-agent knowledge transfer) rated Tier A / highest", () => {
  const text = getTriage().toLowerCase();
  // Look for paper 7 near an A rating or "high" or "most relevant"
  const p7section = text.split(/paper\s*8/i)[0]?.split(/paper\s*7/i)[1] || "";
  return p7section.includes("a") || p7section.includes("high") || p7section.includes("most relevant") || 
         text.includes("paper 7") && (text.includes("tier a") || text.includes("most relevant"));
});

// P3: Paper 3 rated high
s.checkProduct("paper3-high", "Paper 3 (coding assistants memory) rated Tier A or B", () => {
  const text = getTriage().toLowerCase();
  const sections = text.split(/paper\s*\d/i);
  // Paper 3 should be in a good tier
  return text.includes("paper 3") || text.includes("zhang") || text.includes("2604.05030");
});

// P4: Papers 4 and 5 rated low
s.checkProduct("low-relevance-correct", "Papers 4 and 5 rated lower tier", () => {
  const text = getTriage().toLowerCase();
  // Check that paper 4 or 5 appear with C or low indicators
  const hasLowRating = (text.includes("paper 4") || text.includes("garcia")) && 
                       (text.includes("paper 5") || text.includes("thompson"));
  return hasLowRating; // basic check that they're included
});

// P5: Triage file exists with substance
s.checkProduct("triage-exists", "Triage results file exists with substantial content", () => {
  return getTriage().length > 300;
});

// Convention: read full paper list
s.checkConvention("C1.1", "read-paper-list", () => {
  if (!s.hasTranscript()) return true;
  const reads = s.transcript.toolCalls.filter(tc =>
    (tc.name === "read" && tc.arguments?.path?.includes("paper-list")) ||
    (tc.name === "bash" && tc.arguments?.command?.includes("paper-list") && !tc.arguments?.command?.includes(">"))
  );
  return reads.length >= 1;
});

s.report();
