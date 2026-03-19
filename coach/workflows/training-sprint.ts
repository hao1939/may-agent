/// <reference path="../../../src/workflow-defs.d.ts" />

import { writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  runGym,
  findLabForks,
  extractScenarios,
  agentFromFork,
  formatGymResults,
  type GymResult,
  PROJECT_ROOT,
} from "./gym-helpers.js";

export const name: string = "training-sprint";

export const description: string =
  "Batch-run multiple growth experiments efficiently. Diagnose several error " +
  "patterns in one session, fork and patch each, run gym tests in parallel, " +
  "then record all results. Use this when Coach has 3+ queued growth targets " +
  "or wants to rapidly learn multiple methods.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Batch diagnosis — identify multiple experiments to run
  const plan = await ctx.runAgent("coach",
    `Plan a training sprint — identify multiple experiments to run in batch.\n\n` +
    `## Context\n${ctx.task}\n\n` +
    `## Instructions\n` +
    `1. Read \`agents/coach/workspace/todo.md\` — find all growth cycle candidates.\n` +
    `2. Read \`agents/*/ERROR_LOG.jsonl\` — find error patterns worth fixing.\n` +
    `3. Read \`agents/coach/knowledge/method-catalog.md\` — check for untested methods\n` +
    `   AND check for "hypothesis" entries (invented methods) that need testing.\n` +
    `4. Read \`agents/coach/workspace/experiments.jsonl\` — skip patterns already tested.\n` +
    `   For patterns with 2+ failures: try a DIFFERENT method or an invented one.\n` +
    `5. **CEILING-EFFECT GATE (MANDATORY):** For each candidate experiment, run baseline:\n` +
    `   \`scripts/gym-run.sh <scenario> --agent <agent> --timeout 3\`\n` +
    `   If baseline PASSES all checks → REMOVE that experiment from the plan.\n` +
    `   Only keep experiments where baseline FAILS at least one check.\n` +
    `   If ALL candidates are removed by this gate, your output should be:\n` +
    `   "GATE: ALL SKIPPED — ceiling effect on all candidates. Need harder scenarios."\n` +
    `   This gate prevents wasting ~4 LLM sessions per experiment on zero-improvement cycles.\n` +
    `6. Select 3-5 experiments. For each, specify:\n` +
    `   - Target agent\n` +
    `   - Error pattern (FM code) or method to learn\n` +
    `   - Method to apply (can be a hypothesis from the catalog)\n` +
    `   - Gym scenario(s) to test against (check \`ls test/gym/scenarios/\`)\n` +
    `   - Fork name (e.g., coder-sprint-1, optimizer-sprint-2)\n` +
    `7. Write the plan to \`agents/coach/workspace/sprint-plan.md\`\n` +
    `8. Report the full plan.`
  );
  if (plan.status === "error") {
    return ctx.escalate("sprint planning failed", { error: plan.error });
  }

  // Check if ceiling-effect gate eliminated all experiments
  const planText = (plan.lastAssistantText || "").toUpperCase();
  if (planText.includes("GATE: ALL SKIPPED") || planText.includes("CEILING EFFECT ON ALL")) {
    // Record skip directly in JS — no LLM session needed for a single JSONL append
    const skipEntry = {
      timestamp: new Date().toISOString(),
      type: "sprint",
      error_pattern: "multiple",
      agent: "multiple",
      method: "N/A",
      scenarios: [],
      decision: "skipped",
      reason: "ceiling-effect gate: all sprint candidates pass baseline",
    };
    appendFileSync(
      join(PROJECT_ROOT, "agents/coach/workspace/experiments.jsonl"),
      JSON.stringify(skipEntry) + "\n",
    );

    return ctx.done(
      `Training sprint SKIPPED (ceiling-effect gate).\n\n` +
      `## Plan\n${plan.lastAssistantText}\n\n` +
      `All candidate experiments pass baseline — no room for improvement. ` +
      `Create harder scenarios before the next sprint.`
    );
  }

  // Step 2: Fork and patch all experiments
  const patch = await ctx.runAgent("coach",
    `Execute all forks and patches from the sprint plan.\n\n` +
    `## Sprint Plan\n${ctx.summarize(plan)}\n\n` +
    `## Instructions\n` +
    `Read \`agents/coach/workspace/sprint-plan.md\` for the full plan.\n\n` +
    `For EACH experiment in the plan:\n` +
    `1. Fork: \`fork_agent({ source: "<agent>", dest: "<fork-name>" })\`\n` +
    `2. Apply ONE method to the fork (SOUL guard, heartbeat step, skill, etc.)\n` +
    `3. Read back the changed file to confirm\n` +
    `4. Move to the next experiment\n\n` +
    `Be efficient — don't over-explain each change. Fork, patch, verify, next.\n` +
    `Report: list of forks created with what was changed in each.`
  );
  if (patch.status === "error") {
    return ctx.escalate("batch forking failed", { error: patch.error });
  }

  // Step 3: Run all gym tests — direct JS execution (no LLM session needed)
  ctx.emit({ type: "step_start", step: "sprint-gym-tests" });

  // Discover forks from .lab/ and match against patch output
  const forks = findLabForks();
  const patchText = patch.lastAssistantText ?? "";
  const planText2 = plan.lastAssistantText ?? "";
  const combinedText = planText2 + "\n" + patchText;

  // Build list of experiments: { forkName, agent, scenarios }
  interface SprintExperiment {
    forkName: string;
    agent: string;
    scenarios: string[];
  }
  const experiments: SprintExperiment[] = [];
  for (const fork of forks) {
    if (patchText.includes(fork)) {
      const agent = agentFromFork(fork);
      const scenarios = extractScenarios(combinedText);
      experiments.push({ forkName: fork, agent, scenarios: scenarios.length > 0 ? scenarios : [] });
    }
  }

  // If no experiments detected from fork matching, try all forks
  if (experiments.length === 0 && forks.length > 0) {
    for (const fork of forks) {
      const agent = agentFromFork(fork);
      const scenarios = extractScenarios(combinedText);
      experiments.push({ forkName: fork, agent, scenarios });
    }
  }

  // Run baseline and patched tests for each experiment
  interface SprintResult {
    fork: string;
    scenario: string;
    baseline: GymResult;
    patched: GymResult;
    delta: number;
  }
  const sprintResults: SprintResult[] = [];
  const resultLines: string[] = ["# Sprint Gym Test Results (automated — no LLM session)\n"];

  for (const exp of experiments) {
    resultLines.push(`## Fork: ${exp.forkName} (agent: ${exp.agent})`);
    if (exp.scenarios.length === 0) {
      resultLines.push("- No scenarios identified for this fork\n");
      continue;
    }

    for (const scenario of exp.scenarios) {
      const baseline = runGym(scenario, exp.agent);
      const patched = runGym(scenario, exp.agent, exp.forkName);
      const bPassed = baseline.checks.filter(c => c.passed).length;
      const pPassed = patched.checks.filter(c => c.passed).length;
      const delta = pPassed - bPassed;

      sprintResults.push({ fork: exp.forkName, scenario, baseline, patched, delta });

      resultLines.push(`- ${scenario}: baseline=${baseline.passed ? "PASS" : "FAIL"} (${bPassed}/${baseline.checks.length}), patched=${patched.passed ? "PASS" : "FAIL"} (${pPassed}/${patched.checks.length}), delta=${delta >= 0 ? "+" : ""}${delta}`);
    }
    resultLines.push("");
  }

  // Write results to file for Step 4 to read
  const resultsText = resultLines.join("\n");
  writeFileSync(join(PROJECT_ROOT, "agents/coach/workspace/sprint-results.md"), resultsText);

  ctx.emit({ type: "step_done", step: "sprint-gym-tests" } as any);

  // Step 4: Record all results, promote winners, discard losers
  const record = await ctx.runAgent("coach",
    `Record sprint results and make promote/discard decisions.\n\n` +
    `## Test Results\n${resultsText}\n\n` +
    `## Instructions\n` +
    `Read \`agents/coach/workspace/sprint-results.md\` for full results.\n\n` +
    `For EACH experiment:\n` +
    `1. Decision: PROMOTE if patched > baseline, DISCARD otherwise\n` +
    `2. If PROMOTE: \`promote_agent({ fork: "<name>", target: "<agent>" })\`\n` +
    `3. If DISCARD: \`discard_agent({ fork: "<name>" })\`\n` +
    `4. Log to \`workspace/experiments.jsonl\` (one JSON line per experiment):\n` +
    `   \`\`\`json\n` +
    `   {"timestamp":"<ISO>","type":"sprint","error_pattern":"<FM>","agent":"<name>","method":"<method>","scenarios":[{"name":"<s>","baseline":<bool>,"patched":<bool>}],"decision":"promote|discard","reason":"<why>"}\n` +
    `   \`\`\`\n\n` +
    `After all decisions:\n` +
    `5. Update \`knowledge/method-catalog.md\` with aggregate evidence\n` +
    `6. Update \`workspace/todo.md\` — remove completed items, add follow-ups\n` +
    `7. Clean up: verify all .lab/ forks are removed\n` +
    `8. Report: sprint summary — N experiments, N promoted, N discarded, key learnings`
  );
  if (record.status === "error") {
    return ctx.escalate("recording failed", { error: record.error });
  }

  return ctx.done(
    `Training sprint completed.\n\n` +
    `## Plan\n${plan.lastAssistantText}\n\n` +
    `## Results\n${resultsText}\n\n` +
    `## Decisions\n${record.lastAssistantText}`
  );
}
