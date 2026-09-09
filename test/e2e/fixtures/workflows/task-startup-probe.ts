import type { ExecutionResult, TaskReconcileResult, WorkflowContext } from "@may-agent/sdk";

export const name = "task-startup-probe";
export const description = "Wait for a fixture approval, then return an accepted Task result.";

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult<TaskReconcileResult>> {
  // Only the first daemon in the crash-recovery case sets this fixture flag.
  // Hold real worker execution until parent loss terminates the process.
  if (process.env.MAY_TEST_HOLD_STARTUP_ATTEMPT === "1") {
    console.log("task-startup-probe: holding active attempt");
    await new Promise<void>(() => {});
  }
  const released = ctx.reconciliation?.events.items.some(({ event }) => event.type === "project.approval.submitted");
  return ctx.done(
    "fixture result",
    released
      ? { state: "converged", summary: "Exact fact observed", evidence: ["project.approval.submitted"] }
      : {
          state: "waiting",
          summary: "Waiting for fixture fact",
          evidence: [],
          conditions: [
            {
              id: "release",
              type: "project.approval.submitted",
              subject: "artifact:fixture",
              expected: "ready",
              owner: "app:sample",
              reviewAfterMs: 60000,
            },
          ],
        },
  );
}
