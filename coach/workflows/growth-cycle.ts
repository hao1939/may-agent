/// <reference path="../../../src/lib/workflow-defs.d.ts" />

import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const name: string = "growth-cycle";

export const description: string =
  "Evidence-based agent improvement. Diagnose a problem (or pick a method " +
  "to learn), fork agent, apply one change, test via gym, record results. " +
  "Pass 'learn:<method>' as the task to run in learning mode (always discards).";

// ── Gym runner helpers (replaces LLM session for mechanical test step) ─

const PROJECT_ROOT = resolve(join(import.meta.dirname ?? ".", "../../.."));
const SCENARIOS_DIR = join(PROJECT_ROOT, "test/gym/scenarios");
const LAB_DIR = join(PROJECT_ROOT, "agents/.lab");

interface GymResult {
  scenario: string;
  agent: string;
  lab_fork: string | null;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
  summary: string;
  agent_status: string;
  duration: string;
  gym_root: string;
}

/** Run a single gym scenario and parse the JSON result. */
function runGym(scenario: string, agent: string, labFork?: string): GymResult {
  const args = [scenario, "--agent", agent, "--timeout", "3"];
  if (labFork) args.push("--lab", labFork);
  const cmd = `scripts/gym-run.sh ${args.map(a => `'${a}'`).join(" ")}`;

  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 4 * 60 * 1000, // 4 min timeout
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(stdout.trim());
  } catch (err: any) {
    // gym-run.sh may exit non-zero on score failure but still produce JSON
    const stdout = (err.stdout ?? "").trim();
    try {
      return JSON.parse(stdout);
    } catch {
      return {
        scenario,
        agent,
        lab_fork: labFork ?? null,
        passed: false,
        checks: [],
        summary: `gym-run error: ${(err.stderr ?? err.message ?? "unknown").toString().slice(0, 500)}`,
        agent_status: "error",
        duration: "0s",
        gym_root: "",
      };
    }
  }
}

/** List known gym scenario names. */
function listScenarios(): string[] {
  try {
    return readdirSync(SCENARIOS_DIR).filter(d =>
      existsSync(join(SCENARIOS_DIR, d, "task.md"))
    );
  } catch { return []; }
}

/** Find lab forks currently in .lab/ directory. */
function findLabForks(): string[] {
  try {
    return readdirSync(LAB_DIR).filter(d =>
      existsSync(join(LAB_DIR, d, "agent.json")) ||
      existsSync(join(LAB_DIR, d, "SOUL.md"))
    );
  } catch { return []; }
}

/** Extract scenario names mentioned in text by matching against known scenarios. */
function extractScenarios(text: string): string[] {
  const known = listScenarios();
  return known.filter(s => text.includes(s));
}

/** Extract agent name from fork name (e.g., "coder-sprint-1" → "coder"). */
function agentFromFork(forkName: string): string {
  // Common pattern: <agent>-<experiment-suffix>
  const knownAgents = ["coder", "tech-lead", "optimizer", "evaluator", "coach", "qa", "may"];
  for (const agent of knownAgents) {
    if (forkName.startsWith(agent + "-") || forkName === agent) return agent;
  }
  // Fallback: first segment before hyphen
  return forkName.split("-")[0];
}

/** Format gym results into a readable summary string. */
function formatGymResults(
  baselineResults: GymResult[],
  patchedResults: GymResult[],
  forkName: string,
): string {
  const lines: string[] = ["## Gym Test Results (automated — no LLM session)", ""];
  lines.push(`Fork: ${forkName}`);
  lines.push(`Agent: ${agentFromFork(forkName)}`);
  lines.push("");

  // Build a map of scenario → { baseline, patched }
  const byScenario = new Map<string, { baseline?: GymResult; patched?: GymResult }>();

  for (const r of baselineResults) {
    const entry = byScenario.get(r.scenario) ?? {};
    entry.baseline = r;
    byScenario.set(r.scenario, entry);
  }
  for (const r of patchedResults) {
    const entry = byScenario.get(r.scenario) ?? {};
    entry.patched = r;
    byScenario.set(r.scenario, entry);
  }

  for (const [scenario, { baseline, patched }] of byScenario) {
    const bStatus = baseline ? (baseline.passed ? "PASS" : "FAIL") : "N/A";
    const pStatus = patched ? (patched.passed ? "PASS" : "FAIL") : "N/A";
    const bChecks = baseline ? `${baseline.checks.filter(c => c.passed).length}/${baseline.checks.length}` : "-";
    const pChecks = patched ? `${patched.checks.filter(c => c.passed).length}/${patched.checks.length}` : "-";
    lines.push(`- ${scenario}: baseline=${bStatus} (${bChecks}), patched=${pStatus} (${pChecks})`);

    // Show individual check details for patched
    if (patched) {
      for (const check of patched.checks) {
        lines.push(`  - [${check.passed ? "✓" : "✗"}] ${check.name}${check.message ? ": " + check.message : ""}`);
      }
    }
  }

  lines.push("");
  lines.push("### Raw JSON Results");
  lines.push("```json");
  lines.push(JSON.stringify({ baseline: baselineResults, patched: patchedResults }, null, 2));
  lines.push("```");

  return lines.join("\n");
}

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


  // Step 3: Gym test (direct script execution — no LLM session needed)
  ctx.emit({ type: "step_start", step: "gym-test" });

  // Discover fork from .lab/ directory (Step 2 should have created one)
  const forks = findLabForks();
  const patchText = patch.lastAssistantText ?? "";
  // Find the fork that was just created — prefer one mentioned in patch output
  let forkName = forks.find(f => patchText.includes(f)) ?? forks[0];
  if (!forkName) {
    return ctx.escalate("No fork found in agents/.lab/ after patch step", {
      labDir: LAB_DIR,
      patchOutput: patchText.slice(0, 500),
    });
  }

  // Extract agent name from the fork
  const agentName = agentFromFork(forkName);

  // Extract scenarios from Step 1 + Step 1b + patch output
  const combinedText =
    (step1.lastAssistantText ?? "") + "\n" +
    (baselineGate.lastAssistantText ?? "") + "\n" +
    patchText;
  let scenarios = extractScenarios(combinedText);
  if (scenarios.length === 0) {
    // Fallback: use first 3 scenarios to keep runtime reasonable
    scenarios = listScenarios().slice(0, 3);
  }

  // Run baseline tests
  const baselineResults: GymResult[] = [];
  for (const scenario of scenarios) {
    baselineResults.push(runGym(scenario, agentName));
  }

  // Run patched (fork) tests
  const patchedResults: GymResult[] = [];
  for (const scenario of scenarios) {
    patchedResults.push(runGym(scenario, agentName, forkName));
  }

  const gymResultsText = formatGymResults(baselineResults, patchedResults, forkName);

  ctx.emit({ type: "step_done", step: "gym-test" });

  // Step 4: Record and decide
  const decidePrompt = isLearning
    ? `Record what you learned about this method.\n\n` +
      `## Test Results\n${gymResultsText}\n\n` +
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
      `3. Discard the fork: \`discard_agent({ fork: "${forkName}" })\`\n` +
      `4. Report: updated catalog entry, key insights about this method.`
    : `Record experiment results and decide whether to promote or discard.\n\n` +
      `## Test Results\n${gymResultsText}\n\n` +
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
      `   - Run \`promote_agent({ fork: "${forkName}", target: "${agentName}" })\`\n` +
      `   - Update \`agents/coach/knowledge/method-catalog.md\` with evidence\n\n` +
      `4. If DISCARD:\n` +
      `   - Run \`discard_agent({ fork: "${forkName}" })\`\n` +
      `   - Update method-catalog.md noting this method didn\'t work for this pattern\n\n` +
      `5. Clean up: verify .lab/${forkName} is removed.\n\n` +
      `6. Report: decision, evidence summary, catalog updates made.`;

  const decide = await ctx.runAgent("coach", decidePrompt);
  if (decide.status === "error") {
    return ctx.escalate("decision step failed", { error: decide.error });
  }

  return ctx.done(
    `Growth cycle completed (${isLearning ? "learning" : "fix"} mode).\n\n` +
    `## ${isLearning ? "Study" : "Diagnosis"}\n${step1.lastAssistantText}\n\n` +
    `## Results\n${gymResultsText}\n\n` +
    `## Decision\n${decide.lastAssistantText}`
  );
}
