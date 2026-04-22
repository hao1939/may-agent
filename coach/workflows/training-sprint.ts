/// <reference path="../../../src/workflow-defs.d.ts" />

import { writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  promoteAgent,
  discardAgent,
  type GrowthConfig,
} from "../../shared/agent-sdk.js";
import {
  runGym,
  findLabForks,
  extractScenarios,
  agentFromFork,
  formatGymResults,
  extractFMCode,
  extractMethod,
  type GymResult,
  PROJECT_ROOT,
  AGENTS_ROOT,
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
    `## ⚠️ TURN BUDGET: MAX 30 TOOL CALLS\n` +
    `This session has a strict budget of 30 tool calls. Plan efficiently.\n` +
    `If you cannot finish within 30 calls, call finish({status: "partial"}) with what you have.\n\n` +
    `## Context\n${ctx.task}\n\n` +
    `## Instructions\n` +
    `1. Read \`agents/coach/workspace/todo.md\` — find all growth cycle candidates.\n` +
    `2. Read \`agents/*/ERROR_LOG.jsonl\` — find error patterns worth fixing.\n` +
    `3. Read \`agents/coach/knowledge/method-catalog.md\` — check for untested methods\n` +
    `   AND check for "hypothesis" entries (invented methods) that need testing.\n` +
    `4. Read \`agents/coach/workspace/experiments.jsonl\` — skip patterns already tested.\n` +
    `   For patterns with 2+ failures: try a DIFFERENT method or an invented one.\n` +
    `5. **CEILING-EFFECT GATE (MANDATORY):** For each candidate experiment, run baseline:\n` +
    `   \`test/gym/run-gym.sh <scenario> --agent <agent> --timeout 3\`\n` +
    `   If baseline PASSES all checks → REMOVE that experiment from the plan.\n` +
    `   Only keep experiments where baseline FAILS at least one check.\n` +
    `   If ALL candidates are removed by this gate, your output should be:\n` +
    `   "GATE: ALL SKIPPED — ceiling effect on all candidates. Need harder scenarios."\n` +
    `   This gate prevents wasting ~4 LLM sessions per experiment on zero-improvement cycles.\n` +
    `6. Select 3-5 experiments. For each, specify:\n` +
    `   - Target agent\n` +
    `   - Error pattern (FM code) or method to learn\n` +
    `   - Method to apply (can be a hypothesis from the catalog)\n` +
    `   - Gym scenario(s) to test against (check \`ls agents/gym/scenarios/\`)\n` +
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

  // Verify sprint-plan.md was actually created by Phase 1
  const sprintPlanPath = join(PROJECT_ROOT, "agents/coach/workspace/sprint-plan.md");
  if (!existsSync(sprintPlanPath)) {
    return ctx.escalate(
      "Sprint plan Phase 1 failed: Coach did not create agents/coach/workspace/sprint-plan.md. " +
      "Cannot proceed to Phase 2 (fork/patch) without the plan file.",
      { planOutput: plan.lastAssistantText?.substring(0, 500) }
    );
  }

  // Step 2: Fork and patch all experiments
  const patch = await ctx.runAgent("coach",
    `Execute all forks and patches from the sprint plan.\n\n` +
    `## ⚠️ TURN BUDGET: MAX 25 TOOL CALLS\n` +
    `This session has a strict budget of 25 tool calls. Fork, patch, verify, move on.\n` +
    `If you cannot finish within 25 calls, call finish({status: "partial"}) with what you have.\n\n` +
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
  // Budget cap: max 20 gym sessions (10 baseline + 10 patched) to prevent runaway loops.
  // On 2026-04-10, an uncapped run spawned 43 sessions in 41 minutes (~200 ops).
  const MAX_GYM_SESSIONS = 20;
  let gymSessionCount = 0;

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
      if (gymSessionCount >= MAX_GYM_SESSIONS) {
        resultLines.push(`- ${scenario}: SKIPPED (gym session budget exhausted: ${gymSessionCount}/${MAX_GYM_SESSIONS})`);
        continue;
      }
      const baseline = runGym(scenario, exp.agent);
      gymSessionCount++;
      const patched = runGym(scenario, exp.agent, exp.forkName);
      gymSessionCount++;
      const bPassed = baseline.checks.filter(c => c.passed).length;
      const pPassed = patched.checks.filter(c => c.passed).length;
      const delta = pPassed - bPassed;

      sprintResults.push({ fork: exp.forkName, scenario, baseline, patched, delta });

      resultLines.push(`- ${scenario}: baseline=${baseline.passed ? "PASS" : "FAIL"} (${bPassed}/${baseline.checks.length}), patched=${patched.passed ? "PASS" : "FAIL"} (${pPassed}/${patched.checks.length}), delta=${delta >= 0 ? "+" : ""}${delta}`);
    }
    resultLines.push("");
  }

  if (gymSessionCount >= MAX_GYM_SESSIONS) {
    resultLines.push(`\n⚠️ Gym session budget exhausted (${gymSessionCount}/${MAX_GYM_SESSIONS}). Some scenarios were skipped.\n`);
  }

  // Write results to file for Step 4 to read
  const resultsText = resultLines.join("\n");
  writeFileSync(join(PROJECT_ROOT, "agents/coach/workspace/sprint-results.md"), resultsText);

  ctx.emit({ type: "step_done", step: "sprint-gym-tests" } as any);

  // Step 4: Record results, promote winners, discard losers (pure JS — no LLM session)
  const growthConfig: GrowthConfig = { agentsRoot: AGENTS_ROOT };
  const decisionLines: string[] = ["# Sprint Decisions (automated — no LLM session)\n"];
  let promoted = 0;
  let discarded = 0;

  // Group results by fork
  const resultsByFork = new Map<string, SprintResult[]>();
  for (const r of sprintResults) {
    const arr = resultsByFork.get(r.fork) ?? [];
    arr.push(r);
    resultsByFork.set(r.fork, arr);
  }

  for (const exp of experiments) {
    const forkResults = resultsByFork.get(exp.forkName) ?? [];
    const baselinePassed = forkResults.filter(r => r.baseline.passed).length;
    const patchedPassed = forkResults.filter(r => r.patched.passed).length;
    const improved = patchedPassed > baselinePassed;
    const decision = improved ? "promote" as const : "discard" as const;
    const reason = improved
      ? `patched ${patchedPassed}/${forkResults.length} vs baseline ${baselinePassed}/${forkResults.length}`
      : patchedPassed === baselinePassed
        ? `no improvement — both ${baselinePassed}/${forkResults.length}`
        : `regression — patched ${patchedPassed}/${forkResults.length} < baseline ${baselinePassed}/${forkResults.length}`;

    // Execute promote or discard
    try {
      if (decision === "promote") {
        const result = promoteAgent(growthConfig, exp.forkName, exp.agent);
        decisionLines.push(`## ${exp.forkName} → PROMOTED`);
        decisionLines.push(`Copied: ${result.promoted.join(", ")}. ${reason}\n`);
        promoted++;
      } else {
        discardAgent(growthConfig, exp.forkName);
        decisionLines.push(`## ${exp.forkName} → DISCARDED`);
        decisionLines.push(`${reason}\n`);
        discarded++;
      }
    } catch (err: any) {
      decisionLines.push(`## ${exp.forkName} → ERROR`);
      decisionLines.push(`${decision} failed: ${err.message}\n`);
    }

    // Record to experiments.jsonl
    const diagText = planText2;  // Use plan text for FM/method extraction
    const entry = {
      timestamp: new Date().toISOString(),
      type: "sprint",
      error_pattern: extractFMCode(diagText),
      agent: exp.agent,
      method: extractMethod(diagText),
      scenarios: forkResults.map(r => ({
        name: r.scenario,
        baseline: r.baseline.passed,
        patched: r.patched.passed,
      })),
      decision,
      reason,
    };
    appendFileSync(
      join(PROJECT_ROOT, "agents/coach/workspace/experiments.jsonl"),
      JSON.stringify(entry) + "\n",
    );
  }

  // Handle experiments with no gym results (no scenarios matched)
  // These weren't processed in the main loop, so discard to clean up
  const processedForks = new Set(
    experiments.filter(e => (resultsByFork.get(e.forkName)?.length ?? 0) > 0).map(e => e.forkName)
  );
  for (const exp of experiments) {
    if (!processedForks.has(exp.forkName)) {
      try {
        discardAgent(growthConfig, exp.forkName);
        decisionLines.push(`## ${exp.forkName} → DISCARDED (no test results)`);
        discarded++;
      } catch {
        // Fork may already have been removed
      }
    }
  }

  const decisionsText = decisionLines.join("\n");

  return ctx.done(
    `Training sprint completed: ${promoted} promoted, ${discarded} discarded.\n\n` +
    `## Plan\n${plan.lastAssistantText}\n\n` +
    `## Results\n${resultsText}\n\n` +
    `## Decisions\n${decisionsText}`
  );
}
