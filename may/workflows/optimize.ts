/// <reference path="/home/hao/may-agent/src/workflow-defs.d.ts" />

export const name = "optimize";
export const description = "Optimizer analyzes evaluation data and proposes structural improvements";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Optimizer reads evaluation data + transcripts, writes proposals
  const analysis = await ctx.runAgent("optimizer",
    `${ctx.task}

Analyze all evaluation data in .state/evaluations/ and recent session transcripts in .state/sessions/history/.
Also read agents/may/knowledge/lessons.md to see what lessons already exist.
Read the source code you need (src/manager.ts, src/tools.ts, run/may.ts) to understand what can be changed.

For each problem you find:
1. Cite the evaluation data (session ID, efficiency, wasted calls)
2. Identify root cause — structural or behavioral?
3. If structural: propose exact code changes (file, function, what to change)
4. If behavioral: explain why no structural fix exists

Write your proposals to .state/staged/proposals/ as markdown files.
Write a summary of all proposals.`);

  if (analysis.status === "error") {
    return ctx.escalate("Optimizer failed: " + (analysis.error ?? "unknown error"));
  }

  return ctx.done(analysis.lastAssistantText ?? "Optimization analysis complete");
}
