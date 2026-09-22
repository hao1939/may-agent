import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionResult, TaskReconcileResult, WorkflowContext } from "/app/projects/may-agent/packages/sdk/src/index.ts";

export const name = "method-b";
export const description = "Submit and verify a delivery marker through method B.";

export async function execute(ctx: WorkflowContext<{ fixtureRoot: string }>): Promise<ExecutionResult<TaskReconcileResult>> {
  const root = ctx.input.fixtureRoot;
  mkdirSync(root, { recursive: true });
  const path = join(root, "effect.log");
  const expected = `${ctx.reconciliation?.taskId ?? "unknown"}\n`;
  let reused = false;

  if (process.env.RECOVERY_TRIAL_IDEMPOTENT !== "1") {
    appendFileSync(path, expected);
  } else {
    try {
      const fd = openSync(path, "wx");
      try { writeFileSync(fd, expected); } finally { closeSync(fd); }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      const observed = readFileSync(path, "utf8");
      if (observed !== expected) throw new Error(`existing delivery marker mismatch: ${JSON.stringify(observed)}`);
      reused = true;
    }
  }

  const observed = readFileSync(path, "utf8");
  if (observed !== expected) throw new Error(`delivery marker mismatch: ${JSON.stringify(observed)}`);
  return ctx.done("Delivery marker produced", {
    state: "converged",
    summary: "Delivery marker count is 1",
    facts: [`marker-path:${path}`, "marker-count:1", `marker-reused:${reused}`],
    result: { path, count: 1, reused },
  });
}
