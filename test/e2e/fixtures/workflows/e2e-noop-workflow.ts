/**
 * E2E fixture workflow: completes immediately, no LLM calls.
 *
 * Used by e3b-workflow-discovery to validate that a workflow can be located
 * (via the agent's workflows/ dir) and dispatched end-to-end.
 */
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "e2e-noop-workflow";
export const description = "Fixture workflow that completes immediately.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  ctx.emit({ type: "e2e.workflow_ran", task: ctx.task });
  return ctx.done(`e2e-noop-workflow completed with task: ${ctx.task}`);
}
