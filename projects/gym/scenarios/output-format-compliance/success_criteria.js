/**
 * Success Criteria for "output-format-compliance"
 *
 * Tests whether the agent outputs GOAL/PLAN/DONE WHEN structure
 * BEFORE making any tool calls, as required by OUTPUT FORMAT rules.
 *
 * Product:
 *   P1: utils.test.js exists with a formatDate test
 *   P2: finish() was called
 *
 * Behavior:
 *   B1: First assistant message contains GOAL + PLAN + DONE WHEN
 *   B2: Agent read the project file (api-refactor.md)
 *
 * Efficiency:
 *   E1: Total operations ≤ 20
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Behavior (70%) ─────────────────────────────────────────────────────

s.checkBehavior("output-format-compliance", "First message has GOAL/PLAN/DONE WHEN before tool calls", () => {
  const raw = s.rawTranscript();
  if (!raw) return false;
  
  // Transcript is JSONL — parse lines and find first assistant content
  const lines = raw.trim().split("\n");
  let firstAssistantText = "";
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Look for assistant message content (various formats)
      if (entry.role === "assistant" && entry.content) {
        firstAssistantText = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
        break;
      }
      // Alternative: text field from transcript format
      if (entry.type === "assistant" || entry.type === "text") {
        firstAssistantText = entry.text || entry.content || "";
        break;
      }
    } catch { continue; }
  }
  
  if (!firstAssistantText) {
    // Fallback: search raw text (covers non-JSONL transcripts)
    firstAssistantText = raw;
  }
  
  const hasGoal = /GOAL:/m.test(firstAssistantText);
  const hasPlan = /PLAN:/m.test(firstAssistantText);
  const hasDoneWhen = /DONE WHEN:/m.test(firstAssistantText);
  
  return hasGoal && hasPlan && hasDoneWhen;
});

s.checkBehavior("project-checked", "Agent read api-refactor.md", () => {
  const reads = s.toolCalls("read");
  const bashes = s.toolCalls("bash");
  const allCalls = [...reads, ...bashes];
  return allCalls.some(tc => {
    const args = tc.arguments || {};
    const p = String(args.path || args.command || "");
    return /api-refactor/i.test(p);
  });
});

// ── Product (20%) ──────────────────────────────────────────────────────

s.checkProduct("test-written", "utils.test.js created with formatDate test", () => {
  return s.fileExists("utils.test.js") || s.fileExists("environment/utils.test.js");
});

s.checkProduct("finish-called", "finish() called with structured results", () => {
  const finishCalls = s.toolCalls("finish");
  return finishCalls.length > 0;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 20", () => {
  return s.ops() <= 20;
});

s.report();
