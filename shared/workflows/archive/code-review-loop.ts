/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Code Review Loop Workflow
 *
 * Implements the coder → qa → fix loop with proper context passing.
 *
 * Each step gets focused context:
 *   - Coder: task + specific files/errors to look at
 *   - QA: what coder changed (deliverables, commands, diffs) — not the original task
 *   - Coder (fix): QA's specific findings + what to fix — not "fix the issues"
 *
 * Each step can read more context via tools (read, bash) but starts with enough
 * to work without rediscovery.
 *
 * Max 2 review rounds (coder → qa → fix → qa). If still failing, escalate.
 *
 * ## Task Format
 *
 * The task string is the implementation request. Include:
 * - What to build/fix
 * - Specific files to modify
 * - How to verify (test command, expected output)
 *
 * ## Value
 *
 * vs current approach (tech-lead heartbeat with sequential calls):
 * - Context flows between steps (coder's deliverables → QA's review input)
 * - QA gets the diff, not just "review the last commit"
 * - Fix task includes QA's specific findings, not "fix these issues"
 * - Audit trail: workflow result shows full loop history
 */

export const name: string = "code-review-loop";

export const description: string =
  "Coder implements → QA reviews → Coder fixes (if needed). " +
  "Context flows between steps. Max 2 rounds. " +
  "Input: implementation task with file paths and verification command.";

const MAX_ROUNDS = 2;

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const task = ctx.task;
  let lastCoderResult: TaskResult | null = null;
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;

    // ── Step: Coder implements (or fixes) ──────────────────────────────

    ctx.emit({ type: "step_start", step: `coder-round-${round}` });

    let coderTask: string;
    if (round === 1) {
      // First round: original task
      coderTask = task;
    } else {
      // Fix round: include QA findings + what coder already did
      coderTask = lastCoderResult
        ? `Fix the issues found by QA review.\n\n` +
          `## QA Findings\n${qaFindings}\n\n` +
          `## What You Did Previously\n${ctx.summarize(lastCoderResult)}\n\n` +
          `## Original Task\n${task}`
        : task;
    }

    const coderResult = await ctx.runAgent("coder", coderTask);

    if (coderResult.status === "error") {
      return ctx.escalate(`Coder failed in round ${round}`, {
        round,
        error: coderResult.error,
      });
    }

    lastCoderResult = coderResult;

    // ── Step: QA reviews ───────────────────────────────────────────────

    ctx.emit({ type: "step_start", step: `qa-round-${round}` });

    // Build QA task with coder's actual output — not vague "review the work"
    const coderSummary = ctx.summarize(coderResult, {
      includeResponse: true,
      includeKeyFacts: true,
      includeErrors: true,
      includeWriteContents: true,
    });

    const qaTask =
      `Review this implementation. Your job is to find bugs, missing edge cases, ` +
      `and verification gaps. Be adversarial — try to break it.\n\n` +
      `## Original Task\n${task}\n\n` +
      `## What Coder Did\n${coderSummary}\n\n` +
      `## Your Review Process\n` +
      `1. Read the files that were changed\n` +
      `2. Check: does the change actually solve the original task?\n` +
      `3. Look for edge cases, missing error handling, broken assumptions\n` +
      `4. If there's a verification command, run it\n` +
      `5. Report: PASS (no issues) or FAIL (list specific issues to fix)\n\n` +
      `Be specific. "Looks good" is not a review. Cite file paths and line numbers.`;

    const qaResult = await ctx.runAgent("qa", qaTask);

    // Check QA verdict
    const qaText = qaResult.lastAssistantText ?? "";
    const qaPassed = qaText.includes("PASS") && !qaText.includes("FAIL");

    if (qaPassed || qaResult.status === "error") {
      // QA passed or QA itself failed — done
      const status = qaPassed ? "QA approved" : "QA errored (accepting coder's work)";
      return ctx.done(
        `## Code Review Loop Complete (${round} round${round > 1 ? "s" : ""})\n\n` +
        `**Status**: ${status}\n\n` +
        `### Coder's Work\n${ctx.summarize(coderResult)}\n\n` +
        `### QA Review\n${qaText.slice(0, 1000)}`,
      );
    }

    // QA found issues — save findings for fix round
    var qaFindings = qaText;
  }

  // Exhausted rounds
  return ctx.escalate(
    `QA still finding issues after ${MAX_ROUNDS} rounds. Needs human review.`,
    {
      lastCoderWork: lastCoderResult ? ctx.summarize(lastCoderResult) : "none",
      lastQaFindings: qaFindings!,
    },
  );
}
