/// <reference path="../../../src/lib/workflow-defs.d.ts" />

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  promoteAgent,
  discardAgent,
  type GrowthConfig,
} from "../../../src/lib/growth.js";
import {
  runGym,
  runGymBatch,
  listScenarios,
  findLabForks,
  extractScenarios,
  extractAgentFromText,
  agentFromFork,
  extractFMCode,
  extractMethod,
  formatGymResults,
  appendSkipRecord,
  type GymResult,
  LAB_DIR,
  AGENTS_ROOT,
  PROJECT_ROOT,
} from "./gym-helpers.js";

export const name: string = "growth-cycle";

export const description: string =
  "Evidence-based agent improvement. Diagnose a problem (or pick a method " +
  "to learn), fork agent, apply one change, test via gym, record results. " +
  "Pass 'learn:<method>' as the task to run in learning mode (always discards).";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const isLearning = ctx.task.startsWith("learn:");

  // Environment facts — injected into every LLM step to prevent FM-2.1 path-guessing
  const ENV_FACTS =
    `## ENVIRONMENT FACTS (do NOT guess paths — use these)\n` +
    `- Working directory: /app\n` +
    `- No npm — use bun or ./node_modules/.bin/\n` +
    `- Agent files: /app/agents/<name>/\n` +
    `- Gym scenarios: /app/agents/gym/scenarios/\n` +
    `- Lab forks: /app/agents/.lab/<fork-name>/\n` +
    `- Scripts: /app/scripts/\n` +
    `- Do NOT use /root/, /home/, /Users/, or ~/ paths\n\n`;

  // Step 1: Diagnose / Study
  const step1Prompt = isLearning
    ? ENV_FACTS +
      `## ⚠️ TURN BUDGET: MAX 25 TOOL CALLS\n` +
      `Budget 25 tool calls. If you can't finish, call finish({status: "partial"}).\n\n` +
      `Study an improvement method you haven't used before.\n\n` +
      `## Method to Learn\n${ctx.task.slice(6).trim()}\n\n` +
      `## Instructions\n` +
      `1. Read \`agents/coach/knowledge/method-catalog.md\` — find this method's entry.\n` +
      `2. Read documentation and examples related to this method:\n` +
      `   - For skills: read \`agents/shared/skills/\` for examples\n` +
      `   - For workflows: read existing workflows in \`agents/*/workflows/\`\n` +
      `   - For heartbeat steps: read \`agents/*/heartbeat.md\` examples\n` +
      `   - For knowledge files: read \`agents/*/knowledge/\` examples\n` +
      `   - For agent.json: read the agent-loader source for config options\n` +
      `3. Pick a simple gym scenario to test with: \`ls agents/gym/scenarios/\`\n` +
      `4. Pick a target agent (preferably coder — simplest agent).\n` +
      `5. Design a small experiment: what change will you make using this method?\n` +
      `6. Report: what you learned about the method, your experiment plan.`
    : ENV_FACTS +
      `## ⚠️ TURN BUDGET: MAX 25 TOOL CALLS\n` +
      `Budget 25 tool calls. If you can't finish, call finish({status: "partial"}).\n\n` +
      `Diagnose an error pattern and select an improvement method.\n\n` +
      `## Error Pattern\n${ctx.task}\n\n` +
      `## Instructions\n` +
      `1. Read the error examples from the task description above. Identify the behavioral pattern.\n` +
      `2. Read \`agents/coach/knowledge/method-catalog.md\` — understand available methods.\n` +
      `3. Read \`agents/coach/workspace/experiments.jsonl\` (if it exists) — check if this pattern was already tested.\n` +
      `4. Choose ONE method from the catalog that best fits this error pattern.\n` +
      `   - If the catalog has evidence for this pattern → use the proven method.\n` +
      `   - If no evidence → pick the method you think fits best (you'll test it).\n` +
      `5. Identify which agent needs the fix.\n` +
      `6. Identify which gym scenarios can test this fix (check \`agents/gym/scenarios/\` with \`ls\`).\n` +
      `7. Report:\n` +
      `   - Error pattern (FM code + description)\n` +
      `   - Target agent\n` +
      `   - Selected method (from catalog)\n` +
      `   - Why this method (reasoning)\n` +
      `   - Gym scenarios to test against\n` +
      `   - What specifically you'll change`;

  const step1 = await ctx.runAgent("coach", step1Prompt);
  if (step1.status === "error") {
    return ctx.escalate("step 1 failed", { error: step1.error });
  }
  // Interrupted sessions may still have useful partial output — proceed
  // with whatever the agent produced before being cut off.

  // Step 1b: Ceiling-effect gate — run baseline BEFORE forking (JS, no LLM)
  ctx.emit({ type: "step_start", step: "ceiling-gate" });

  const diagnosisText = step1.lastAssistantText ?? "";
  const gateScenarios = extractScenarios(ctx.task + "\n" + diagnosisText);
  const gateAgent = extractAgentFromText(ctx.task + "\n" + diagnosisText);

  if (gateScenarios.length === 0 || !gateAgent) {
    // Can't run gate without scenarios/agent — fall through to fork step
    // (the LLM diagnosis didn't mention recognizable scenarios or agents)
    ctx.emit({ type: "step_done", step: "ceiling-gate" } as any);
  } else {
    const gateResults: GymResult[] = [];
    let anyFails = false;
    for (const scenario of gateScenarios) {
      const result = runGym(scenario, gateAgent);
      gateResults.push(result);
      if (!result.passed) anyFails = true;
    }

    const gateReport = gateResults
      .map(r => `- ${r.scenario}: ${r.passed ? "PASS" : "FAIL"} (${r.checks.filter(c => c.passed).length}/${r.checks.length})`)
      .join("\n");

    ctx.emit({ type: "step_done", step: "ceiling-gate" } as any);

    if (!anyFails) {
      // Ceiling effect — all pass, skip the experiment
      appendSkipRecord(gateAgent, gateScenarios, diagnosisText);

      return ctx.done(
        `Growth cycle SKIPPED (ceiling-effect gate).\n\n` +
        `## Diagnosis\n${diagnosisText}\n\n` +
        `## Baseline Gate Results\n${gateReport}\n\n` +
        `All scenarios pass at baseline — no room for improvement. ` +
        `Create harder scenarios before retrying this pattern.`
      );
    }
  }

  // Step 2: Fork and apply
  const patch = await ctx.runAgent("coach",
    ENV_FACTS +
    `## ⚠️ TURN BUDGET: MAX 20 TOOL CALLS\n` +
    `Budget 20 tool calls. Fork, patch, verify — be efficient.\n\n` +
    `Fork the target agent and apply exactly ONE improvement method.\n\n` +
    `## ${isLearning ? "Study Results" : "Diagnosis"}\n${ctx.summarize(step1)}\n\n` +
    `## Instructions\n` +
    `1. Fork the target agent: \`fork_agent({ source: "<agent>", dest: "<agent>-<experiment>" })\`\n` +
    `2. Apply the selected method to the fork. Be specific and minimal:\n` +
    `   - SOUL guard → add 5-15 lines max\n` +
    `   - Heartbeat step → add one numbered step\n` +
    `   - Skill → create one SKILL.md file\n` +
    `   - Workflow → create one workflow .ts file\n` +
    `   - Knowledge → create one .md file\n` +
    `3. Read back the changed file(s) to confirm the edit worked.\n` +
    `4. Do NOT apply multiple methods — one method per experiment.\n` +
    `5. Report: what you changed, the fork name, and the file(s) modified.\n\n` +
    `IMPORTANT: The fork lives in agents/.lab/<fork-name>/. Verify it exists.\n\n` +
    `⚠️ Do NOT delete or discard the fork — even if you discover the baseline already passes. ` +
    `The workflow manages fork lifecycle (promote/discard) automatically after testing.`
  );
  if (patch.status === "error") {
    return ctx.escalate("fork/patch failed", { error: patch.error });
  }


  // Step 3: Gym test (direct script execution — no LLM session needed)
  ctx.emit({ type: "step_start", step: "gym-test" });

  // Discover fork from .lab/ directory (Step 2 should have created one)
  const forks = findLabForks();
  const patchText = patch.lastAssistantText ?? "";
  // Find the fork that was just created — prefer one mentioned in patch output
  let forkName = forks.find(f => patchText.includes(f)) ?? forks[0];
  if (!forkName) {
    // Check if coach found ceiling effect and discarded (common pattern)
    const lowerPatch = patchText.toLowerCase();
    const ceilingDiscarded = lowerPatch.includes("discard") || lowerPatch.includes("ceiling") ||
      lowerPatch.includes("baseline") && lowerPatch.includes("pass");

    if (ceilingDiscarded) {
      return ctx.done(
        `Growth cycle ended — coach found ceiling effect during patch step.\n\n` +
        `## Patch Step Output\n${patchText.slice(0, 1000)}\n\n` +
        `The baseline already passes. Fork was discarded by coach. ` +
        `Consider creating harder scenarios for this pattern.`
      );
    }

    return ctx.escalate("No fork found in agents/.lab/ after patch step", {
      labDir: LAB_DIR,
      patchOutput: patchText.slice(0, 500),
    });
  }

  // Extract agent name from the fork
  const agentName = agentFromFork(forkName);

  // Extract scenarios from task description + Step 1 + patch output.
  // Include ctx.task so the target scenario from the original request is always found —
  // previous bug: LLM outputs sometimes omit the scenario name, causing fallback to
  // alphabetically-first scenarios (which are unrelated to the target).
  const combinedText =
    ctx.task + "\n" +
    (step1.lastAssistantText ?? "") + "\n" +
    patchText;
  let scenarios = extractScenarios(combinedText);
  if (scenarios.length === 0) {
    // Fallback: use first 3 scenarios to keep runtime reasonable
    scenarios = listScenarios().slice(0, 3);
  }

  // Run baseline + patched via single batch invocation
  const allResults = runGymBatch(scenarios, agentName, forkName);

  // Separate results into baseline vs patched by lab_fork field
  const baselineResults = allResults.filter(r => r.lab_fork === null);
  const patchedResults = allResults.filter(r => r.lab_fork !== null);

  const gymResultsText = formatGymResults(baselineResults, patchedResults, forkName);

  ctx.emit({ type: "step_done", step: "gym-test" });

  // Step 4: Record and decide (pure JS — no LLM session needed)
  // Compare pass counts to determine promote/discard
  const baselinePassed = baselineResults.filter(r => r.passed).length;
  const patchedPassed = patchedResults.filter(r => r.passed).length;
  const improved = patchedPassed > baselinePassed;

  // In learning mode, always discard. In fix mode, promote only if improved.
  const decision = isLearning ? "discard" as const : (improved ? "promote" as const : "discard" as const);
  const reason = isLearning
    ? "learning mode — always discard after recording observations"
    : improved
      ? `patched passed ${patchedPassed}/${scenarios.length} vs baseline ${baselinePassed}/${scenarios.length}`
      : patchedPassed === baselinePassed
        ? `no improvement — patched ${patchedPassed}/${scenarios.length} same as baseline`
        : `regression — patched ${patchedPassed}/${scenarios.length} worse than baseline ${baselinePassed}/${scenarios.length}`;

  // Execute promote/discard via growth.ts pure functions
  const growthConfig: GrowthConfig = { agentsRoot: AGENTS_ROOT };
  let decisionReport: string;

  try {
    if (decision === "promote") {
      const result = promoteAgent(growthConfig, forkName, agentName);
      decisionReport = `PROMOTED "${forkName}" → "${agentName}". Copied: ${result.promoted.join(", ")}. Reason: ${reason}`;
    } else {
      discardAgent(growthConfig, forkName);
      decisionReport = `DISCARDED "${forkName}". Reason: ${reason}`;
    }
  } catch (err: any) {
    decisionReport = `${decision.toUpperCase()} attempted but failed: ${err.message}. Reason: ${reason}`;
  }

  // Record to experiments.jsonl
  const diagText = step1.lastAssistantText ?? "";
  const experimentEntry = isLearning
    ? {
        timestamp: new Date().toISOString(),
        type: "learn-method",
        method: extractMethod(diagText),
        agent: agentName,
        scenarios: scenarios.map(s => {
          const b = baselineResults.find(r => r.scenario === s);
          const p = patchedResults.find(r => r.scenario === s);
          return { name: s, baseline: b?.passed ?? false, patched: p?.passed ?? false };
        }),
        decision,
        reason,
      }
    : {
        timestamp: new Date().toISOString(),
        error_pattern: extractFMCode(diagText),
        agent: agentName,
        method: extractMethod(diagText),
        scenarios: scenarios.map(s => {
          const b = baselineResults.find(r => r.scenario === s);
          const p = patchedResults.find(r => r.scenario === s);
          return { name: s, baseline: b?.passed ?? false, patched: p?.passed ?? false };
        }),
        decision,
        reason,
      };

  const experimentsPath = join(PROJECT_ROOT, "agents/coach/workspace/experiments.jsonl");
  appendFileSync(experimentsPath, JSON.stringify(experimentEntry) + "\n");

  // For learning mode, still use a lightweight LLM session to update method-catalog.md
  // (this is the only part that benefits from LLM judgment — cataloging observations)
  let catalogUpdate = "";
  if (isLearning) {
    const catalogPrompt =
      `Update the method catalog with what you learned.\n\n` +
      `## Test Results Summary\n` +
      `Baseline passed: ${baselinePassed}/${scenarios.length}, Patched passed: ${patchedPassed}/${scenarios.length}\n` +
      `Decision: ${decision} (${reason})\n\n` +
      `## Instructions\n` +
      `1. Read \`agents/coach/knowledge/method-catalog.md\`\n` +
      `2. Find the entry for method: ${extractMethod(diagText)}\n` +
      `3. Update its Evidence section with these concrete observations\n` +
      `4. Change Status from "untested" to "tested" with today's date\n` +
      `5. Report what you updated.`;

    const catalogResult = await ctx.runAgent("coach", catalogPrompt);
    catalogUpdate = catalogResult.lastAssistantText ?? "(catalog update session failed)";
  }

  return ctx.done(
    `Growth cycle completed (${isLearning ? "learning" : "fix"} mode).\n\n` +
    `## ${isLearning ? "Study" : "Diagnosis"}\n${step1.lastAssistantText}\n\n` +
    `## Results\n${gymResultsText}\n\n` +
    `## Decision (automated)\n${decisionReport}\n` +
    `Recorded to experiments.jsonl.` +
    (catalogUpdate ? `\n\n## Catalog Update\n${catalogUpdate}` : "")
  );
}
