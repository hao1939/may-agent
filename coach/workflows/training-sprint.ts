/// <reference path="../../../src/workflow-defs.d.ts" />

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
    const skipRecord = await ctx.runAgent("coach",
      `Record a ceiling-effect skip for the training sprint.\n\n` +
      `## Plan Results\n${ctx.summarize(plan)}\n\n` +
      `## Instructions\n` +
      `The ceiling-effect gate eliminated ALL candidate experiments.\n` +
      `All baselines pass — no room for improvement with current scenarios.\n\n` +
      `1. Append ONE JSON line to \`agents/coach/workspace/experiments.jsonl\`:\n` +
      `   \`\`\`json\n` +
      `   {"timestamp":"<ISO>","type":"sprint","error_pattern":"multiple","agent":"multiple","method":"N/A","scenarios":[],"decision":"skipped","reason":"ceiling-effect gate: all sprint candidates pass baseline"}\n` +
      `   \`\`\`\n` +
      `2. Report: what was skipped and recommend creating harder scenarios.`
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

  // Step 3: Run all gym tests — use bash to run them, potentially in parallel
  const test = await ctx.runAgent("coach",
    `Run gym tests for all experiments from the sprint.\n\n` +
    `## Forks Created\n${ctx.summarize(patch)}\n\n` +
    `## Instructions\n` +
    `Read \`agents/coach/workspace/sprint-plan.md\` for scenarios per experiment.\n\n` +
    `For EACH experiment, run baseline and patched:\n` +
    `\`\`\`bash\n` +
    `# Baseline (only need one per agent+scenario combo)\n` +
    `scripts/gym-run.sh <scenario> --agent <agent> --timeout 3\n\n` +
    `# Patched\n` +
    `scripts/gym-run.sh <scenario> --agent <agent> --lab <fork-name> --timeout 3\n` +
    `\`\`\`\n\n` +
    `Collect all results. Write them to \`agents/coach/workspace/sprint-results.md\`.\n\n` +
    `Format per experiment:\n` +
    `- Fork: <name>\n` +
    `- Scenario: <name>\n` +
    `- Baseline: PASS/FAIL (checks: X/Y)\n` +
    `- Patched: PASS/FAIL (checks: X/Y)\n` +
    `- Delta: +N/-N checks\n\n` +
    `IMPORTANT: Do NOT use git stash, git checkout, or git branch.\n` +
    `If a gym run fails, record the error and move to the next one.`
  );
  if (test.status === "error") {
    return ctx.escalate("gym testing failed", { error: test.error });
  }

  // Step 4: Record all results, promote winners, discard losers
  const record = await ctx.runAgent("coach",
    `Record sprint results and make promote/discard decisions.\n\n` +
    `## Test Results\n${ctx.summarize(test)}\n\n` +
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
    `## Results\n${test.lastAssistantText}\n\n` +
    `## Decisions\n${record.lastAssistantText}`
  );
}
