import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "unified-waiting-frontier-migration";
export const description =
  "Close the rejected handler-action migration after direct app-resolver cutover.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const summary =
    "Waiting-frontier retirement is owned by the direct app resolver; the rejected handler-action migration is retired.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:waiting-frontier-direct-resolver-v2"],
    actions: [],
  });
}
