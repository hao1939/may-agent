/**
 * E2E fixture workflow: slow owner judgment stub, no LLM.
 */
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "e2e-owner-slow-stub";
export const description = "Slow fixture owner workflow for project reconciler event e2e tests.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectId = ctx.task.match(/projectId=(\S+)/)?.[1] ?? "unknown";
  const reason = ctx.task.match(/reason=([^\n]+)/)?.[1] ?? "unknown";

  ctx.emit({
    type: "e2e.owner_slow.started",
    projectId,
    reason,
  });
  await sleep(500);
  ctx.emit({
    type: "e2e.owner_slow.finished",
    projectId,
    reason,
  });

  return ctx.done(`owner completed ${projectId}`);
}
