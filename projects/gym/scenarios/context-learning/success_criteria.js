/**
 * Success Criteria for "context-learning"
 *
 * Tests that agents use finish(context_updates) to persist learned facts
 * after exploring a project.
 *
 * Product:
 *   P1: Agent read at least one project file
 *
 * Behavior:
 *   B1: finish() included context_updates with ≥2 add actions
 *   B2: At least one fact references actual project details (bun, sqlite, config, etc.)
 *
 * Efficiency:
 *   E1: Total operations ≤ 15
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("read-project-files", "Agent read at least one project file", () => {
  if (!s.hasTranscript()) return false;
  // Check read() tool calls
  const reads = s.toolCalls("read");
  if (reads.some(tc =>
    (tc.arguments || {}).path &&
    (String((tc.arguments || {}).path).includes("project.json") ||
     String((tc.arguments || {}).path).includes("README"))
  )) return true;
  // Also accept bash cat/head/less of these files (including wildcards in workDir)
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return cmd.includes("project.json") ||
     cmd.includes("README") ||
     // Accept wildcard reads that would capture project files (e.g. cat /tmp/gym-*/* )
     (cmd.match(/cat\s/) && cmd.includes("gym-"));
  });
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("has-context-updates", "finish() includes context_updates with ≥2 add actions", () => {
  if (!s.hasTranscript()) return false;
  const finishCalls = s.toolCalls("finish");
  let addCount = 0;
  for (const tc of finishCalls) {
    const updates = (tc.arguments || {}).context_updates;
    if (Array.isArray(updates)) {
      addCount += updates.filter(u => u.action === "add").length;
    }
  }
  return addCount >= 2;
});

s.checkBehavior("facts-are-relevant", "At least one fact mentions project-specific details", () => {
  if (!s.hasTranscript()) return false;
  const keywords = ["bun", "sqlite", "config", "pipeline", "toml", "csv", "migrate", "dry-run", "timestamp", "epoch"];
  const finishCalls = s.toolCalls("finish");
  for (const tc of finishCalls) {
    const updates = (tc.arguments || {}).context_updates;
    if (Array.isArray(updates)) {
      for (const u of updates) {
        if (u.action === "add" && keywords.some(kw => String(u.content).toLowerCase().includes(kw))) {
          return true;
        }
      }
    }
  }
  return false;
});

s.checkBehavior("finishes-success", "Agent finishes with success status", () => {
  return s.finishStatus() === "success";
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 15", () => {
  return s.ops() <= 15;
});

s.report();
