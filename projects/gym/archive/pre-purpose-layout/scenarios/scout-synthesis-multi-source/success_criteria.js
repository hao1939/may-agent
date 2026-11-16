/**
 * Success Criteria for "scout-synthesis-multi-source"
 *
 * Tests: Can the scout synthesize multiple sources into coherent insights?
 *
 * Product:
 *   P1: Synthesis file exists and is 200-400 words
 *   P2: Identifies the pruning contradiction (source 1 says LRU best; source 3 says pruning hurts)
 *   P3: Mentions shared vs. isolated memory tradeoff
 *   P4: Extracts actionable insights (not just summaries)
 *   P5: References all 3 sources
 *
 * Convention:
 *   C1.1: Read all 3 sources before writing synthesis
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

function getSynthesis() {
  return s.readFile("environment/synthesis.md") || "";
}

function wordCount(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// P1: Synthesis exists and is right length
s.checkProduct("synthesis-length", "Synthesis is 200-400 words", () => {
  const text = getSynthesis();
  const wc = wordCount(text);
  return wc >= 150 && wc <= 500; // slight tolerance
});

// P2: Identifies pruning contradiction
s.checkProduct("pruning-contradiction", "Identifies contradiction about pruning effectiveness", () => {
  const text = getSynthesis().toLowerCase();
  return (text.includes("contradict") || text.includes("conflict") || text.includes("disagree") || 
          text.includes("tension") || text.includes("however") || text.includes("contrast")) &&
         (text.includes("prun") && (text.includes("lru") || text.includes("hurt") || text.includes("degrad")));
});

// P3: Shared vs isolated memory
s.checkProduct("shared-memory-tradeoff", "Discusses shared vs isolated memory tradeoff", () => {
  const text = getSynthesis().toLowerCase();
  return (text.includes("shared") || text.includes("common memory")) &&
         (text.includes("isolat") || text.includes("per-agent") || text.includes("pollut") || text.includes("individual"));
});

// P4: Actionable insights
s.checkProduct("actionable-insights", "Contains actionable insights for our system", () => {
  const text = getSynthesis().toLowerCase();
  return (text.includes("our system") || text.includes("we should") || text.includes("recommend") ||
          text.includes("actionable") || text.includes("implication") || text.includes("suggest") ||
          text.includes("insight"));
});

// P5: References all sources
s.checkProduct("all-sources-referenced", "References all 3 sources", () => {
  const text = getSynthesis().toLowerCase();
  const hasSource1 = text.includes("bounded") || text.includes("source 1") || text.includes("arxiv") || text.includes("paper");
  const hasSource2 = text.includes("agentops") || text.includes("source 2") || text.includes("blog") || text.includes("production") || text.includes("10,000");
  const hasSource3 = text.includes("benchmark") || text.includes("source 3") || text.includes("agent-mem") || text.includes("github");
  return hasSource1 && hasSource2 && hasSource3;
});

// C1.1: Read all sources before writing
s.checkConvention("C1.1", "read-all-sources", () => {
  if (!s.hasTranscript()) return true;
  const writes = s.transcript.toolCalls.filter(tc =>
    (tc.name === "edit" || tc.name === "write") && tc.arguments?.path?.includes("synthesis")
  );
  if (writes.length === 0) return true;
  const firstWrite = writes[0].entryIndex;
  const reads = s.transcript.toolCalls.filter(tc =>
    (tc.name === "read" && tc.arguments?.path?.includes("sources/")) ||
    (tc.name === "bash" && tc.arguments?.command?.includes("sources/") && !tc.arguments?.command?.includes(">"))
  );
  return reads.filter(r => r.entryIndex < firstWrite).length >= 2;
});

s.report();
