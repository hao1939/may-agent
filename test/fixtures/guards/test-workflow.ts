/**
 * Test workflow: two-step workflow for guard integration testing.
 * Step 1: runs agent "step-one"
 * Step 2: runs agent "step-two"
 */
import type { WorkflowContext, ExecutionResult } from "@may-agent/sdk";

export const name = "test-two-step";
export const description = "Two-step test workflow for guard integration testing";

export async function execute(ctx: WorkflowContext<string>): Promise<ExecutionResult> {
  const r1 = await ctx.agents.call("step-one", `Step 1 of: ${ctx.input}`);
  const r2 = await ctx.agents.call("step-two", `Step 2 of: ${ctx.input}. Previous: ${r1.summary}`);
  return ctx.done(`Completed both steps. Step1: ${r1.summary}, Step2: ${r2.summary}`);
}
