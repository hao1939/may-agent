import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "evaluator-deep-eval";

export const description =
  "Run one non-heuristic evaluator review as workflow-traced work.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const result = await ctx.runAgent("evaluator", ctx.task);
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Deep evaluator session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }
  return ctx.done(`Deep evaluator session completed in ${result.sessionId}.`);
}
