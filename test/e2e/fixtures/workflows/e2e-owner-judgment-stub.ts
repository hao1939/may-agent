/**
 * E2E fixture workflow: owner judgment stub, no LLM.
 */
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "e2e-owner-judgment-stub";
export const description = "Fixture owner judgment workflow for task-driven project e2e tests.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectId = ctx.task.match(/projectId=(\S+)/)?.[1] ?? "unknown";
  const taskId = ctx.task.match(/task=(\S+)/)?.[1] ?? "unknown";

  ctx.emit({
    type: "e2e.owner_judgment.ran",
    projectId,
    taskId,
  });

  return ctx.done(`owner judged ${projectId}#${taskId}`);
}
