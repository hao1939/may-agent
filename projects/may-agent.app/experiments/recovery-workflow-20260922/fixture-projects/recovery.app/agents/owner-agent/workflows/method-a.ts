import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionResult, TaskReconcileResult, WorkflowContext } from "/app/projects/may-agent/packages/sdk/src/index.ts";

export const name = "method-a";
export const description = "Submit a delivery marker through method A.";

export async function execute(ctx: WorkflowContext<{ fixtureRoot: string }>): Promise<ExecutionResult<TaskReconcileResult>> {
  if (!process.env.RECOVERY_TRIAL_ACK_LOST) {
    throw new Error("method A transport terminated before returning a result");
  }

  mkdirSync(ctx.input.fixtureRoot, { recursive: true });
  const path = join(ctx.input.fixtureRoot, "effect.log");
  const expected = `${ctx.reconciliation?.taskId ?? "unknown"}\n`;

  if (process.env.RECOVERY_TRIAL_IDEMPOTENT !== "1") {
    appendFileSync(path, expected);
    throw new Error("method A transport terminated before returning a result");
  }

  try {
    const fd = openSync(path, "wx");
    try { writeFileSync(fd, expected); } finally { closeSync(fd); }
    throw new Error("method A transport terminated before returning a result");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    const observed = readFileSync(path, "utf8");
    if (observed !== expected) throw new Error(`existing delivery marker mismatch: ${JSON.stringify(observed)}`);
    return ctx.done("Existing delivery marker verified after lost acknowledgment", {
      state: "converged",
      summary: "Existing delivery marker verified with count 1",
      facts: [`marker-path:${path}`, "marker-count:1", "marker-reused:true"],
      result: { path, count: 1, reused: true },
    });
  }
}
