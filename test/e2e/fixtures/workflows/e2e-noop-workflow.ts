/**
 * E2E fixture workflow: completes immediately, no LLM calls.
 *
 * Used by e3b-workflow-discovery to validate that a workflow can be located
 * (via the agent's workflows/ dir) and dispatched end-to-end.
 */
import type { WorkflowContext, ExecutionResult } from "@may-agent/sdk";

export const name = "e2e-noop-workflow";
export const description = "Fixture workflow that completes immediately.";

export async function execute(ctx: WorkflowContext<string>): Promise<ExecutionResult> {
  if (!ctx.reconciliation) throw new Error("Fixture requires a Task attempt");
  await ctx.events.emit({ localKey: "workflow-ran", type: "e2e.workflow_ran", data: { task: ctx.input } });
  return ctx.done("e2e-noop-workflow completed", {
    state: "converged",
    summary: "Scheduled workflow verified",
    facts: ["e2e.workflow_ran"],
  });
}
