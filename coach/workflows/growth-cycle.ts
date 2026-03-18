/// <reference path="../../../src/lib/workflow-defs.d.ts" />

export const name: string = "growth-cycle";

export const description: string =
  "Evidence-based agent improvement. Diagnose a problem (or pick a method " +
  "to learn), fork agent, apply one change, test via gym, record results. " +
  "Pass 'learn:<method>' as the task to run in learning mode (always discards).";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const isLearning = ctx.task.startsWith("learn:");

  // Step 1: Diagnose / Study
  const step1Prompt = isLearning
    ? `Study an improvement method you haven't used before.\n\n` +
      `## Method to Learn\n${ctx.task.slice(6).trim()}\n\n` +
      `## Instructions\n` +
      `1. Read \`agents/coach/knowledge/method-catalog.md\` — find this method's entry.\n` +
      `2. Read documentation and examples related to this method:\n` +
      `   - For skills: read \`agents/shared/skills/\` for examples\n` +
      `   - For workflows: read existing workflows in \`agents/*/workflows/\`\n` +
      `   - For heartbeat steps: read \`agents/*/heartbeat.md\` examples\n` +
      `   - For knowledge files: read \`agents/*/knowledge/\` examples\n` +
      `   - For agent.json: read the agent-loader source for config options\n` +
      `3. Pick a simple gym scenario to test with: \`ls test/gym/scenarios/\`\n` +
      `4. Pick a target agent (preferably coder — simplest agent).\n` +
      `5. Design a small experiment: what change will you make using this method?\n` +
      `6. Report: what you learned about the method, your experiment plan.`
    : `Diagnose an error pattern and select an improvement method.\n\n` +
      `## Error Pattern\n${ctx.task}\n\n` +
      `## Instructions\n` +
      `1. Read the error examples from the task description above. Identify the behavioral pattern.\n` +
      `2. Read \`agents/coach/knowledge/method-catalog.md\` — understand available methods.\n` +
      `3. Read \`agents/coach/workspace/experiments.jsonl\` (if it exists) — check if this pattern was already tested.\n` +
      `4. Choose ONE method from the catalog that best fits this error pattern.\n` +
      `   - If the catalog has evidence for this pattern → use the proven method.\n` +
      `   - If no evidence → pick the method you think fits best (you'll test it).\n` +
      `5. Identify which agent needs the fix.\n` +
      `6. Identify which gym scenarios can test this fix (check \`test/gym/scenarios/\` with \`ls\`).\n` +
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

  // Step 1b: Ceiling-effect gate — run baseline BEFORE forking
  const baselineGate = await ctx.runAgent("coach",
    `Run baseline gym tests to check for ceiling effect BEFORE forking.\n\n` +
    `## Diagnosis\n${ctx.summarize(step1)}\n\n` +
    `## Instructions (Ceiling-Effect Gate)\n` +
    `Before we fork and patch, we must verify the baseline actually FAILS.\n` +
    `If all agents pass all scenarios at baseline, the experiment is pointless.\n\n` +
    `1. Run baseline (no --lab) for each scenario identified in the diagnosis:\n` +
    `   \`\`\`bash\n` +
    `   scripts/gym-run.sh <scenario> --agent <agent> --timeout 3\n` +
    `   \`\`\`\n` +
    `2. Parse the JSON output. Record pass/fail for each.\n` +
    `3. **DECISION:**\n` +
    `   - If ANY scenario FAILS baseline → output "GATE: PROCEED" and list the failing scenarios.\n` +
    `   - If ALL scenarios PASS baseline → output "GATE: SKIP — ceiling effect detected".\n` +
    `4. Report: per-scenario baseline results and the gate decision.\n\n` +
    `IMPORTANT: This gate saves ~3 wasted LLM sessions when experiments would show no improvement.`
  );
  if (baselineGate.status === "error") {
    return ctx.escalate("baseline gate failed", { error: baselineGate.error });
  }

  // Check if the gate says SKIP
  const gateText = (baselineGate.lastAssistantText || "").toUpperCase();
  if (gateText.includes("GATE: SKIP") || gateText.includes("CEILING EFFECT DETECTED")) {
    // Log the skip to experiments.jsonl via a quick recording step
    const skipRecord = await ctx.runAgent("coach",
      `Record a ceiling-effect skip in the experiment log.\n\n` +
      `## Baseline Results\n${ctx.summarize(baselineGate)}\n\n` +
      `## Instructions\n` +
      `The baseline gate detected ceiling effect — all scenarios pass at baseline.\n` +
      `This experiment would produce no measurable improvement.\n\n` +
      `1. Append ONE JSON line to \`agents/coach/workspace/experiments.jsonl\`:\n` +
      `   \`\`\`json\n` +
      `   {"timestamp":"<ISO>","error_pattern":"<FM-X.X from diagnosis>","agent":"<name>","method":"<method from diagnosis>","scenarios":[],"decision":"skipped","reason":"ceiling-effect gate: all baseline scenarios pass"}\n` +
      `   \`\`\`\n` +
      `2. Report: what was skipped and why.`
    );
    return ctx.done(
      `Growth cycle SKIPPED (ceiling-effect gate).\n\n` +
      `## Diagnosis\n${step1.lastAssistantText}\n\n` +
      `## Baseline Gate\n${baselineGate.lastAssistantText}\n\n` +
      `All scenarios pass at baseline — no room for improvement. ` +
      `Create harder scenarios before retrying this pattern.`
    );
  }

  // Step 2: Fork and apply
  const patch = await ctx.runAgent("coach",
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
    `IMPORTANT: The fork lives in agents/.lab/<fork-name>/. Verify it exists.`
  );
  if (patch.status === "error") {
    return ctx.escalate("fork/patch failed", { error: patch.error });
  }

  // Step 3: Gym test
  const test = await ctx.runAgent("coach",
    `Test the forked agent against gym scenarios using the gym runner.\n\n` +
    `## Patch Summary\n${ctx.summarize(patch)}\n\n` +
    `## Instructions\n` +
    `The gym runner can test .lab/ forks directly. Use \`--lab <fork-name>\`.\n\n` +
    `1. Run the gym for each relevant scenario with the fork:\n` +
    `   \`\`\`bash\n` +
    `   scripts/gym-run.sh <scenario> --agent <agent> --lab <fork-name> --timeout 3\n` +
    `   \`\`\`\n\n` +
    `2. Parse the JSON output. Record pass/fail for each scenario.\n\n` +
    `3. Also run baseline (no --lab) for comparison if no baseline exists yet:\n` +
    `   \`\`\`bash\n` +
    `   scripts/gym-run.sh <scenario> --agent <agent> --timeout 3\n` +
    `   \`\`\`\n\n` +
    `4. Report: per-scenario pass/fail for both baseline and patched agent.\n` +
    `   Format: "scenario: baseline=PASS/FAIL, patched=PASS/FAIL"\n\n` +
    `IMPORTANT: Do NOT use git stash, git checkout, or git branch in the agents/ repo.\n` +
    `The --lab flag handles everything. If the gym runner exits non-zero, capture and\n` +
    `report the JSON output anyway.`
  );
  if (test.status === "error") {
    return ctx.escalate("gym testing failed", { error: test.error });
  }

  // Step 4: Record and decide
  const decidePrompt = isLearning
    ? `Record what you learned about this method.\n\n` +
      `## Test Results\n${ctx.summarize(test)}\n\n` +
      `## Instructions (Learning Mode — always discard)\n` +
      `1. Update \`agents/coach/knowledge/method-catalog.md\`:\n` +
      `   - Update the Evidence section for this method\n` +
      `   - Add concrete observations from your experiment\n` +
      `   - Update "When to use" and "When NOT to use" based on what you observed\n` +
      `   - Change Status from "untested" to "tested" with date\n` +
      `2. Log to \`agents/coach/workspace/experiments.jsonl\`:\n` +
      `   \`\`\`json\n` +
      `   {"timestamp":"<ISO>","type":"learn-method","method":"<method>","agent":"<agent>","scenario":"<scenario>","baseline_passed":<bool>,"patched_passed":<bool>,"observations":"<what you learned>"}\n` +
      `   \`\`\`\n` +
      `3. Discard the fork: \`discard_agent({ fork: "<fork-name>" })\`\n` +
      `4. Report: updated catalog entry, key insights about this method.`
    : `Record experiment results and decide whether to promote or discard.\n\n` +
      `## Test Results\n${ctx.summarize(test)}\n\n` +
      `## Instructions\n` +
      `1. Evaluate the gym results:\n` +
      `   - If patched agent passed MORE scenarios than baseline → PROMOTE\n` +
      `   - If patched agent passed SAME as baseline → DISCARD (method didn't help)\n` +
      `   - If patched agent passed FEWER → DISCARD (method made things worse)\n\n` +
      `2. Record the experiment to \`agents/coach/workspace/experiments.jsonl\`:\n` +
      `   Append ONE JSON line:\n` +
      `   \`\`\`json\n` +
      `   {"timestamp":"<ISO>","error_pattern":"<FM-X.X>","agent":"<name>","method":"<method>","scenarios":[{"name":"<s>","baseline":<bool>,"patched":<bool>}],"decision":"promote|discard","reason":"<why>"}\n` +
      `   \`\`\`\n\n` +
      `3. If PROMOTE:\n` +
      `   - Run \`promote_agent({ fork: "<fork-name>", target: "<agent>" })\`\n` +
      `   - Update \`agents/coach/knowledge/method-catalog.md\` with evidence\n\n` +
      `4. If DISCARD:\n` +
      `   - Run \`discard_agent({ fork: "<fork-name>" })\`\n` +
      `   - Update method-catalog.md noting this method didn't work for this pattern\n\n` +
      `5. Clean up: verify .lab/<fork-name> is removed.\n\n` +
      `6. Report: decision, evidence summary, catalog updates made.`;

  const decide = await ctx.runAgent("coach", decidePrompt);
  if (decide.status === "error") {
    return ctx.escalate("decision step failed", { error: decide.error });
  }

  return ctx.done(
    `Growth cycle completed (${isLearning ? "learning" : "fix"} mode).\n\n` +
    `## ${isLearning ? "Study" : "Diagnosis"}\n${step1.lastAssistantText}\n\n` +
    `## Results\n${test.lastAssistantText}\n\n` +
    `## Decision\n${decide.lastAssistantText}`
  );
}
