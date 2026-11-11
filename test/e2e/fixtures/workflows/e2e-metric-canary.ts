import type { WorkflowContext } from "@may-agent/sdk";
export const name = "e2e-metric-canary";
export const description = "Record a synthetic metric sample through an ordinary App Task";
export async function execute(ctx: WorkflowContext<{ phase: string; value: number }>) {
  const { phase, value } = ctx.input;
  ctx.metrics.define({ id: "e2e.canary", owner: "agent:may", type: "rate", target: 1,
    threshold: 0.8, priority: "P1", alertOp: "lt", direction: "higher-is-better" });
  await ctx.metrics.record("e2e.canary", value, { note: phase });
  ctx.metrics.evaluate("e2e.canary");
  await ctx.events.emit({ localKey: "sample", type: "e2e.metric.phase", data: { phase, value } });
  return ctx.done("Sample recorded", { state: "converged", summary: "Sample recorded", facts: [] });
}
