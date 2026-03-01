/// <reference path="../../../src/workflow-defs.d.ts" />

export const name = "diagnose-and-fix";

export const description =
  "Reads evaluation data and failure chains, identifies the top problem, " +
  "delegates root-cause analysis to optimizer, then drives a fix via implement-and-review. " +
  "Escalates if no actionable problems found or if the fix fails.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Optimizer analyzes evaluations and proposes a diagnosis
  const diagnosis = await ctx.runAgent("optimizer",
    `Read the evaluation data in .state/evaluations/ (focus on recent sessions).
Look at failureChains in each evaluation JSON — these trace the exact sequence of
tool calls that led to wasted work.

For the TOP problem pattern you find:
1. Cite specific sessions and failure chains
2. Trace the ROOT CAUSE — what tool output or missing information triggered the bad behavior?
3. Identify which source file to change (src/tools.ts, src/manager.ts, src/compaction.ts, run/may.ts, or agent knowledge files)
4. Write the EXACT fix as a diff or code snippet — not "add a lesson" but actual code changes
5. Write a test description for the fix

Write your diagnosis to .state/staged/proposals/ as a single markdown file.
Name it with a sequential number (check .state/staged/done/ for the latest).

IMPORTANT: The fix must be structural (change code/tools/prompts), not documentary (add lessons).
If the only fix is a lesson, explain why no structural fix exists.`);

  if (diagnosis.status === "error") {
    return ctx.escalate("Optimizer diagnosis failed: " + (diagnosis.error ?? "unknown"));
  }

  const diagnosisText = diagnosis.lastAssistantText ?? "";

  // If optimizer found nothing actionable, we're done
  if (diagnosisText.toLowerCase().includes("no actionable") ||
      diagnosisText.toLowerCase().includes("no problems found")) {
    return ctx.done("No actionable problems found in recent evaluations.");
  }

  // Step 2: Delegate fix to implement-and-review workflow
  const fixResult = await ctx.runWorkflow("implement-and-review",
    `Implement the fix described in the latest proposal in .state/staged/proposals/.
Read the proposal file to understand what to change.
After implementation, move the proposal to .state/staged/done/.`);

  if (fixResult.type === "escalate") {
    return ctx.escalate("Fix implementation failed: " + fixResult.reason, {
      diagnosis: diagnosisText,
      fixResult,
    });
  }

  return ctx.done(
    `## Diagnosis\n${diagnosisText}\n\n## Fix\n${fixResult.summary}`
  );
}
