import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "unified-resource-migration";
export const description =
  "Finish the invalid Gym resource-retirement request without mutating standing runtime resources.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const summary =
    "Cancelled the invalid resource retirement; Gym's owner-review and design-alignment resources remain standing responsibilities.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:unified-resource-v3-cancelled"],
    actions: [],
  });
}
