import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionResult, TaskReconcileResult, WorkflowContext } from "/app/projects/may-agent/packages/sdk/src/index.ts";

export const name = "deliver-order";
export const description = "Build and verify the order delivery document.";

export async function execute(ctx: WorkflowContext<{ sourceRoot: string; orderPath: string; outputPath: string }>): Promise<ExecutionResult<TaskReconcileResult>> {
  const { sourceRoot, orderPath, outputPath } = ctx.input;
  const child = spawnSync(process.execPath, [join(sourceRoot, "deliver.ts"), orderPath, outputPath], {
    cwd: sourceRoot, encoding: "utf8", timeout: 15_000,
  });
  const logPath = outputPath + ".execution.json";
  writeFileSync(logPath, JSON.stringify({ command: [process.execPath, join(sourceRoot, "deliver.ts"), orderPath, outputPath], status: child.status, stdout: child.stdout, stderr: child.stderr, error: child.error?.message }, null, 2));
  if (child.error || child.status !== 0) throw new Error(`Order execution failed (exit ${child.status}); execution record: ${logPath}`);
  const order = JSON.parse(readFileSync(orderPath, "utf8"));
  const expected = { orderId: order.orderId, totalCents: order.lines.reduce((sum: number, line: any) => sum + order.catalog[line.sku].unitCents * line.quantity, 0), lineCount: order.lines.length };
  const observed = JSON.parse(readFileSync(outputPath, "utf8"));
  if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new Error("Delivery verification failed");
  return ctx.done("Order delivery verified", {
    state: "converged", summary: "Order delivery matches the order contract",
    facts: [`delivery-path:${outputPath}`, `execution-record:${logPath}`], result: { path: outputPath, delivery: observed },
  });
}
