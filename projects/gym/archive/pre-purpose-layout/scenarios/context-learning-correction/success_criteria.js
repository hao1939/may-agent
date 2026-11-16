/**
 * Success Criteria for "context-learning-correction"
 *
 * Tests that agents can identify wrong facts and correct them using
 * both "remove" and "add" actions in context_updates.
 *
 * The task gives 4 "previously learned" facts, all wrong:
 *   - "Node.js runtime" → actually Bun
 *   - "PostgreSQL" → actually SQLite  
 *   - "config/settings.yaml" → actually config/pipeline.toml
 *   - "Jest" → actually vitest
 *
 * Product:
 *   P1: Agent read project files to verify facts
 *
 * Behavior:
 *   B1: finish() used at least 2 "remove" actions (correcting wrong facts)
 *   B2: finish() used at least 2 "add" actions (replacing with correct facts)
 *   B3: Removals target the actually wrong facts (Node.js, PostgreSQL, yaml, Jest)
 *   B4: Additions contain correct info (Bun, SQLite, toml, vitest)
 *   B5: Agent finishes with success
 *
 * Efficiency:
 *   E1: Total operations ≤ 15
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// Helper: extract all context_updates from finish calls
function getContextUpdates() {
  if (!s.hasTranscript()) return [];
  const all = [];
  for (const tc of s.toolCalls("finish")) {
    const updates = (tc.arguments || {}).context_updates;
    if (Array.isArray(updates)) all.push(...updates);
  }
  return all;
}

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("read-project-files", "Agent read at least one project file to verify facts", () => {
  if (!s.hasTranscript()) return false;
  const fileKeywords = ["package.json", "README", "pipeline.toml"];
  // Check read() tool calls
  const reads = s.toolCalls("read");
  if (reads.some(tc =>
    (tc.arguments || {}).path &&
    fileKeywords.some(kw => String((tc.arguments || {}).path).includes(kw))
  )) return true;
  // Also accept bash cat/head/less
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return fileKeywords.some(kw => cmd.includes(kw));
  });
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("has-remove-actions", "finish() includes ≥2 remove actions (correcting wrong facts)", () => {
  const updates = getContextUpdates();
  return updates.filter(u => u.action === "remove").length >= 2;
});

s.checkBehavior("has-add-actions", "finish() includes ≥2 add actions (replacing with correct facts)", () => {
  const updates = getContextUpdates();
  return updates.filter(u => u.action === "add").length >= 2;
});

s.checkBehavior("removals-target-wrong-facts", "Removals target the actually wrong facts", () => {
  const updates = getContextUpdates();
  const removes = updates.filter(u => u.action === "remove").map(u => String(u.content).toLowerCase());
  // At least 2 of the 4 wrong facts should be targeted
  const wrongKeywords = ["node", "postgresql", "yaml", "jest"];
  let hits = 0;
  for (const kw of wrongKeywords) {
    if (removes.some(r => r.includes(kw))) hits++;
  }
  return hits >= 2;
});

s.checkBehavior("additions-are-correct", "Additions contain correct project details", () => {
  const updates = getContextUpdates();
  const adds = updates.filter(u => u.action === "add").map(u => String(u.content).toLowerCase());
  // At least 2 of the correct facts should appear
  const correctKeywords = ["bun", "sqlite", "toml", "vitest"];
  let hits = 0;
  for (const kw of correctKeywords) {
    if (adds.some(a => a.includes(kw))) hits++;
  }
  return hits >= 2;
});

s.checkBehavior("finishes-success", "Agent finishes with success status", () => {
  return s.finishStatus() === "success";
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 15", () => {
  return s.ops() <= 15;
});

s.report();
