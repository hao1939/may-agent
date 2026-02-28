/// <reference path="/home/hao/may-agent/src/workflow-defs.d.ts" />

export const name = "optimize";
export const description = "Periodic optimization: optimizer analyzes data and generates improvements, evaluator validates them";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Optimizer analyzes recent evaluations and generates artifacts
  const analysis = await ctx.runAgent("optimizer",
    `${ctx.task}

Analyze evaluation data in .state/evaluations/ and session transcripts in .state/history/.
For each optimization opportunity found:
1. Describe the opportunity with supporting data
2. Generate any artifacts (skill scripts, workflow files) and write them to .state/staged/
3. Write model/prompt proposals to .state/staged/proposals/

Summarize all opportunities and artifacts created.`);

  if (analysis.status === "error") {
    return ctx.escalate("Optimizer failed: " + (analysis.error ?? "unknown error"));
  }

  // Step 2: Evaluator validates what optimizer produced
  const verdict = await ctx.runAgent("evaluator",
    `Review the optimization artifacts staged by the optimizer.

Optimizer's analysis:
${analysis.lastAssistantText ?? "(no output)"}

Check .state/staged/ for any generated files.
For each staged artifact:
1. Review the code quality and correctness
2. Assess whether the claimed improvement is plausible
3. Verdict: approve, reject (with reason), or flag for human review

Write your verdicts to .state/staged/verdicts.json`);

  if (verdict.status === "error") {
    return ctx.escalate("Evaluator validation failed: " + (verdict.error ?? "unknown error"));
  }

  // Step 3: Optimizer reads verdicts and acts
  const result = await ctx.runAgent("optimizer",
    `Read the evaluator's verdicts from .state/staged/verdicts.json (if it exists).

Evaluator's response:
${verdict.lastAssistantText ?? "(no output)"}

For approved artifacts:
- Move skills from .state/staged/skills/ to the appropriate agents/<name>/skills/ directory
- Move workflows from .state/staged/workflows/ to the appropriate agents/<name>/workflows/ directory

For rejected artifacts:
- Move to .state/rejected/ with the rejection reason

For flagged artifacts:
- Leave in .state/staged/ for human review

Summarize all actions taken.`);

  return ctx.done(result.lastAssistantText ?? "Optimization cycle complete");
}
