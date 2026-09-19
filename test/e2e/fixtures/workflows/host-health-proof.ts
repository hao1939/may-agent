import type { ExecutionResult, TaskReconcileResult, WorkflowContext } from "@may-agent/sdk";
export const name = "host-health-proof";
export const description = "Inspect one snapshot without a model.";
export async function execute(ctx: WorkflowContext): Promise<ExecutionResult<TaskReconcileResult>> {
  const input = ctx.reconciliation!.input as { data: { runtimeFailures: { total: number } } };
  return ctx.done("inspected", {
    state: "converged",
    summary: "App inspected Host facts",
    facts: [`runtime-failures:${input.data.runtimeFailures.total}`],
  });
}
