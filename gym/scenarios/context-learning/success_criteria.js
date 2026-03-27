/**
 * success_criteria.js — Context Learning scenario
 * 
 * Tests that the agent:
 * 1. Read the project files to understand them
 * 2. Called finish() with context_updates containing learned facts
 * 3. The facts are relevant to what was in the files
 */

module.exports = function evaluate(transcript, workDir) {
  const checks = [];
  
  // Parse tool calls from transcript
  const toolCalls = [];
  for (const entry of transcript) {
    if (entry.role === "assistant" && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === "tool_use") {
          toolCalls.push({ name: block.name, input: block.input || {} });
        }
      }
    }
  }
  
  // Check 1: Agent read at least one project file
  const readCalls = toolCalls.filter(tc => 
    tc.name === "read" && tc.input.path && 
    (tc.input.path.includes("project.json") || tc.input.path.includes("README"))
  );
  checks.push({
    name: "read-project-files",
    passed: readCalls.length >= 1,
    detail: readCalls.length >= 1 
      ? `Read ${readCalls.length} project file(s)` 
      : "Did not read any project files"
  });
  
  // Check 2: Agent called finish()
  const finishCalls = toolCalls.filter(tc => tc.name === "finish");
  checks.push({
    name: "called-finish",
    passed: finishCalls.length >= 1,
    detail: finishCalls.length >= 1 ? "Called finish()" : "Did not call finish()"
  });
  
  // Check 3: finish() included context_updates
  const hasContextUpdates = finishCalls.some(tc => {
    const updates = tc.input.context_updates;
    return Array.isArray(updates) && updates.length >= 1;
  });
  checks.push({
    name: "has-context-updates",
    passed: hasContextUpdates,
    detail: hasContextUpdates 
      ? "finish() includes context_updates" 
      : "finish() missing context_updates field"
  });
  
  // Check 4: context_updates has at least 2 facts
  let updateCount = 0;
  for (const tc of finishCalls) {
    if (Array.isArray(tc.input.context_updates)) {
      updateCount += tc.input.context_updates.filter(u => u.action === "add").length;
    }
  }
  checks.push({
    name: "at-least-2-facts",
    passed: updateCount >= 2,
    detail: `${updateCount} fact(s) added via context_updates (need ≥2)`
  });
  
  // Check 5: facts are relevant (mention bun, sqlite, config, or pipeline)
  let relevantFacts = 0;
  const keywords = ["bun", "sqlite", "config", "pipeline", "toml", "csv", "migrate", "dry-run", "timestamp", "epoch"];
  for (const tc of finishCalls) {
    if (Array.isArray(tc.input.context_updates)) {
      for (const u of tc.input.context_updates) {
        if (u.action === "add" && keywords.some(kw => u.content.toLowerCase().includes(kw))) {
          relevantFacts++;
        }
      }
    }
  }
  checks.push({
    name: "facts-are-relevant",
    passed: relevantFacts >= 1,
    detail: relevantFacts >= 1 
      ? `${relevantFacts} fact(s) mention project-specific details` 
      : "No facts reference actual project details (bun, sqlite, config, etc.)"
  });
  
  return checks;
};
