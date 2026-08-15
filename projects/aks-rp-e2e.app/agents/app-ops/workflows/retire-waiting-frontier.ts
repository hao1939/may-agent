import type {
  ExecutionResult,
  TaskReconciliationChild,
  WorkflowContext,
} from "@may-agent/sdk";

export const name = "retire-waiting-frontier";
export const description =
  "Drain the fixed children of the retired waiting-frontier resource, then converge it.";

export const waitingFrontierTaskId = "runtime/waiting-frontier-review";

export function waitingFrontierChildIds(
  children: TaskReconciliationChild[],
): string[] {
  return children
    .map((child) => child.taskId)
    .sort();
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  if (!ctx.reconciliation) {
    throw new Error("retire-waiting-frontier requires task reconciliation");
  }
  const children = waitingFrontierChildIds(
    ctx.reconciliation.children.live,
  );

  if (children.length > 0) {
    const summary = `Waiting for ${children.length} existing waiting-frontier children to finish; no new recovery work was created.`;
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: children.slice(0, 16).map((taskId) => `live-child:${taskId}`),
      actions: [],
    });
  }

  const summary =
    "All existing waiting-frontier children finished; the retired recovery scheduler can leave the live graph.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["retirement:waiting-frontier-drained"],
    actions: [],
  });
}
