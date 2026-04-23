/// <reference path="../../../src/workflow-defs.d.ts" />

/**
 * enhance-cron workflow
 *
 * Safely extends the Cron system through a structured, test-gated pipeline.
 * Each step is verified with `npx vitest run run/cron.test.ts` before proceeding.
 *
 * Steps:
 *   1. Analysis    — Read cron.ts, handler-context.ts, agent-loader.ts; produce a plan
 *   2. State       — Add new state fields + initial values to Cron class
 *   3. Methods     — Implement private/public methods for the new capability
 *   4. Lifecycle   — Hook into fireHeartbeat / fireHandler / fireDetachedJob / startEntry
 *   5. Context     — Expose via HandlerContext interface + agent-loader.ts wiring
 *   6. Verify      — Final cross-cutting check: tsc + full test suite
 *
 * Enforces P19 (test after every step) — each step runs tests before handing off.
 * Escalates on first test failure after one retry.
 *
 * Source: agents/shared/workflow-proposals/enhance-cron.md
 */

export const name: string = "enhance-cron";

export const description: string =
  "Safely extend the Cron system with a new capability. " +
  "Structured pipeline: state → methods → lifecycle hook → context exposure. " +
  "Tests run after every step. Task should describe the new feature.";

// ── Key files the workflow operates on ─────────────────────────────────

const CRON_TS = "run/cron.ts";
const CRON_TEST = "run/cron.test.ts";
const HANDLER_CONTEXT = "run/handler-context.ts";
const AGENT_LOADER = "run/agent-loader.ts";
const CRON_TOOL = "src/cron-tool.ts";

const KEY_FILES = [CRON_TS, HANDLER_CONTEXT, AGENT_LOADER, CRON_TOOL];

const TEST_CMD = `npx vitest run ${CRON_TEST} 2>&1; echo "EXIT:$?"`;
const TSC_CMD = `npx tsc --noEmit 2>&1 | head -60; echo "EXIT:\${PIPESTATUS[0]}"`;

// ── Helpers ────────────────────────────────────────────────────────────

function testInstructions(stepName: string): string {
  return (
    `\n\n## MANDATORY: Test After This Step\n` +
    `After completing the ${stepName} changes, run:\n` +
    `  npx vitest run ${CRON_TEST}\n` +
    `If no test file exists yet, run: npx tsc --noEmit\n` +
    `If tests fail, fix the issue before finishing. ` +
    `Report the test outcome (PASS/FAIL + output) at the end of your response.`
  );
}

function noFullFileWrite(): string {
  return (
    `\n\n## CRITICAL: Large File Protocol\n` +
    `${CRON_TS} is 450+ lines. Do NOT read the full file or write the full file.\n` +
    `Use grep -n to locate, read with startLine/endLine for context, ` +
    `and sed/perl for surgical edits. Same applies to ${AGENT_LOADER} (500+ lines).`
  );
}

function stepFailed(step: string, result: TaskResult): WorkflowResult {
  return {
    type: "escalate",
    reason: `Step "${step}" failed`,
    context: {
      step,
      error: result.error,
      output: result.lastAssistantText,
    },
  };
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const feature = ctx.task;

  // ── Step 1: Analysis & Plan ──────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "analysis" });

  const analysisTask =
    `You are extending the Cron system with a new capability.\n\n` +
    `## Feature Request\n${feature}\n\n` +
    `## Instructions\n` +
    `1. Read these files to understand the current Cron architecture:\n` +
    `   - ${KEY_FILES.join("\n   - ")}\n` +
    `2. Produce a DETAILED PLAN (not code yet) with these sections:\n\n` +
    `### New State\n` +
    `What fields to add to the Cron class, their types, and initial values.\n\n` +
    `### New Methods\n` +
    `Method signatures, visibility (private/public), and behavior.\n\n` +
    `### Lifecycle Hooks\n` +
    `Where in the existing lifecycle (fireHeartbeat, fireHandler, fireDetachedJob, ` +
    `startEntry, stop, reload) the new logic needs to be called.\n\n` +
    `### Context Exposure\n` +
    `What to add to HandlerContext interface and how to wire it in agent-loader.ts.\n\n` +
    `### Test Cases\n` +
    `Key scenarios to test (will go in ${CRON_TEST}).\n\n` +
    `### Risk Assessment\n` +
    `What existing behavior could break and how to avoid it.\n\n` +
    `DO NOT write any code yet. Only produce the plan. Be specific about line numbers ` +
    `and exact insertion points.`;

  const analysis = await ctx.runAgent("optimizer", analysisTask);
  if (analysis.status === "error") {
    return ctx.escalate("analysis step failed", { error: analysis.error });
  }
  const plan = analysis.lastAssistantText ?? "(no plan)";

  // ── Step 2: State Definition ─────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "state-definition" });

  const stateTask =
    `## Cron Enhancement: Step 2 — Add State Fields\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Plan (from analysis step)\n${plan}\n\n` +
    `## Instructions\n` +
    `Implement ONLY the "New State" portion of the plan:\n` +
    `1. Add the new fields to the Cron class in ${CRON_TS}\n` +
    `2. Initialize them in the constructor or as field initializers\n` +
    `3. If the feature needs new types in ${CRON_TOOL}, add them\n` +
    `4. Do NOT implement methods or lifecycle hooks yet\n` +
    noFullFileWrite() +
    testInstructions("state definition");

  const stateResult = await ctx.runAgent("coder", stateTask);
  if (stateResult.status === "error") {
    return stepFailed("state-definition", stateResult);
  }

  // Check if coder reported test failure
  const stateText = stateResult.lastAssistantText ?? "";
  if (hasTestFailure(stateText)) {
    // One retry
    const fixResult = await retryStep(ctx, "state-definition", stateText, feature, plan);
    if (fixResult.type === "escalate") return fixResult;
  }

  // ── Step 3: Method Implementation ────────────────────────────────────

  ctx.emit({ type: "step_start", step: "methods" });

  const methodsTask =
    `## Cron Enhancement: Step 3 — Implement Methods\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Plan\n${plan}\n\n` +
    `## Previous Step (state added)\n${summarize(stateResult)}\n\n` +
    `## Instructions\n` +
    `Implement the "New Methods" from the plan:\n` +
    `1. Add private/public methods to the Cron class in ${CRON_TS}\n` +
    `2. Methods should use the state fields added in the previous step\n` +
    `3. Do NOT hook into lifecycle methods yet — just define the methods\n` +
    `4. Ensure methods handle edge cases (null, empty, concurrent access)\n` +
    noFullFileWrite() +
    testInstructions("method implementation");

  const methodsResult = await ctx.runAgent("coder", methodsTask);
  if (methodsResult.status === "error") {
    return stepFailed("methods", methodsResult);
  }

  const methodsText = methodsResult.lastAssistantText ?? "";
  if (hasTestFailure(methodsText)) {
    const fixResult = await retryStep(ctx, "methods", methodsText, feature, plan);
    if (fixResult.type === "escalate") return fixResult;
  }

  // ── Step 4: Lifecycle Hook ───────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "lifecycle" });

  const lifecycleTask =
    `## Cron Enhancement: Step 4 — Wire Into Lifecycle\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Plan\n${plan}\n\n` +
    `## Previous Steps\n` +
    `State: ${summarize(stateResult)}\n` +
    `Methods: ${summarize(methodsResult)}\n\n` +
    `## Instructions\n` +
    `Wire the new methods into the Cron lifecycle:\n` +
    `1. Hook into the specific lifecycle methods identified in the plan\n` +
    `   (fireHeartbeat, fireHandler, fireDetachedJob, startEntry, stop, reload — as applicable)\n` +
    `2. Be SURGICAL — add only the necessary calls, don't restructure existing code\n` +
    `3. Preserve all existing overlap protection, error handling, and skip logic\n` +
    `4. If the feature affects stop()/reload(), update those too\n` +
    noFullFileWrite() +
    testInstructions("lifecycle hook");

  const lifecycleResult = await ctx.runAgent("coder", lifecycleTask);
  if (lifecycleResult.status === "error") {
    return stepFailed("lifecycle", lifecycleResult);
  }

  const lifecycleText = lifecycleResult.lastAssistantText ?? "";
  if (hasTestFailure(lifecycleText)) {
    const fixResult = await retryStep(ctx, "lifecycle", lifecycleText, feature, plan);
    if (fixResult.type === "escalate") return fixResult;
  }

  // ── Step 5: Context Exposure ─────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "context-exposure" });

  const contextTask =
    `## Cron Enhancement: Step 5 — Expose via HandlerContext\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Plan\n${plan}\n\n` +
    `## Instructions\n` +
    `Expose the new capability to cron handlers:\n` +
    `1. Add the method/property to the HandlerContext interface in ${HANDLER_CONTEXT}\n` +
    `   (include JSDoc describing behavior and return type)\n` +
    `2. Wire it in ${AGENT_LOADER} where HandlerContext is constructed\n` +
    `   (search for "const ctx: HandlerContext" to find the spot)\n` +
    `3. If the feature requires new exports from ${CRON_TS}, add them\n` +
    noFullFileWrite() +
    testInstructions("context exposure");

  const contextResult = await ctx.runAgent("coder", contextTask);
  if (contextResult.status === "error") {
    return stepFailed("context-exposure", contextResult);
  }

  const contextText = contextResult.lastAssistantText ?? "";
  if (hasTestFailure(contextText)) {
    const fixResult = await retryStep(ctx, "context-exposure", contextText, feature, plan);
    if (fixResult.type === "escalate") return fixResult;
  }

  // ── Step 6: Final Verification ───────────────────────────────────────

  ctx.emit({ type: "step_start", step: "final-verify" });

  const verifyTask =
    `## Cron Enhancement: Step 6 — Final Verification\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Instructions\n` +
    `Run a complete verification of the Cron enhancement:\n\n` +
    `1. Run \`npx tsc --noEmit\` — ALL type errors must pass\n` +
    `2. Run \`npx vitest run ${CRON_TEST}\` — ALL tests must pass\n` +
    `3. Read the modified sections of these files and confirm consistency:\n` +
    `   - ${CRON_TS}: new state + methods + lifecycle hooks\n` +
    `   - ${HANDLER_CONTEXT}: new interface members\n` +
    `   - ${AGENT_LOADER}: wiring\n` +
    `4. Check for: unused imports, missing cleanup in stop(), ` +
    `   missing reset in reload(), overlap protection gaps\n\n` +
    `Report:\n` +
    `- tsc result: PASS/FAIL\n` +
    `- test result: PASS/FAIL (with counts)\n` +
    `- consistency: any issues found\n` +
    `- verdict: PASS or FAIL with details`;

  const verifyResult = await ctx.runAgent("qa", verifyTask);
  if (verifyResult.status === "error") {
    return ctx.escalate("final verification failed", { error: verifyResult.error });
  }

  const verifyText = verifyResult.lastAssistantText ?? "";
  const verifyUpper = verifyText.toUpperCase();

  if (verifyUpper.includes("FAIL") && !verifyUpper.includes("PASS")) {
    return ctx.escalate("Final verification failed", {
      plan,
      verifyOutput: verifyText,
    });
  }

  // ── Done ─────────────────────────────────────────────────────────────

  return ctx.done(
    `## Cron Enhancement Complete\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Plan\n${plan}\n\n` +
    `## Final Verification\n${verifyText}\n\n` +
    `## ACTION REQUIRED\n` +
    `Run: git diff --stat\n` +
    `Then: git add <changed files> && git commit -m "feat(cron): <description>"\n` +
    `Do this NOW. Do not summarize, do not explain — just commit.`
  );
}

// ── Utilities ──────────────────────────────────────────────────────────

/** Check if the coder's output indicates test failures. */
function hasTestFailure(text: string): boolean {
  const upper = text.toUpperCase();
  // Look for explicit failure markers
  if (upper.includes("FAIL") && !upper.includes("FAIL: 0") && !upper.includes("0 FAIL")) {
    // But not if it also says all tests pass
    if (!upper.includes("ALL TESTS PASS") && !upper.includes("TESTS PASSED")) {
      return true;
    }
  }
  return false;
}

/** Summarize a step result concisely for handoff. */
function summarize(result: TaskResult): string {
  const text = result.lastAssistantText ?? "(no output)";
  // Truncate to 2000 chars for handoff context
  return text.length > 2000 ? text.slice(0, 2000) + "\n... (truncated)" : text;
}

/** Retry a failed step once. Returns escalate result if retry also fails. */
async function retryStep(
  ctx: WorkflowContext,
  stepName: string,
  failureOutput: string,
  feature: string,
  plan: string,
): Promise<WorkflowResult> {
  ctx.emit({ type: "step_start", step: `${stepName}-retry` });

  const retryTask =
    `## Cron Enhancement: Retry — ${stepName}\n\n` +
    `## Feature\n${feature}\n\n` +
    `## Plan\n${plan}\n\n` +
    `## Problem\n` +
    `The previous attempt at "${stepName}" caused test/type failures:\n\n` +
    `${failureOutput}\n\n` +
    `## Instructions\n` +
    `1. Read the current state of ${CRON_TS} (relevant sections only)\n` +
    `2. Identify and fix the issue\n` +
    `3. Run tests to confirm the fix\n` +
    noFullFileWrite() +
    testInstructions(`${stepName} retry`);

  const retry = await ctx.runAgent("coder", retryTask);
  if (retry.status === "error") {
    return ctx.escalate(`${stepName} retry failed`, {
      originalFailure: failureOutput,
      retryError: retry.error,
    });
  }

  const retryText = retry.lastAssistantText ?? "";
  if (hasTestFailure(retryText)) {
    return ctx.escalate(`${stepName} still failing after retry`, {
      originalFailure: failureOutput,
      retryOutput: retryText,
    });
  }

  // Retry succeeded — return done so caller knows to continue
  return { type: "done", summary: retryText };
}
