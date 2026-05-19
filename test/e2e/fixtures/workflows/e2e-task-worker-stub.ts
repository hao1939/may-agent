/**
 * E2E fixture workflow: task worker stub, no LLM.
 */
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "e2e-task-worker-stub";
export const description = "Fixture task worker workflow for task-driven project e2e tests.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectId = ctx.task.match(/projectId=(\S+)/)?.[1] ?? "unknown";
  const taskId = ctx.task.match(/task=(\S+)/)?.[1] ?? "unknown";

  ctx.emit({
    type: "e2e.task_worker.ran",
    projectId,
    taskId,
  });

  return ctx.done(`worker completed ${projectId}#${taskId}`);
}
