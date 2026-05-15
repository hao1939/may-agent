/**
 * Test workflow: two-step workflow for guard integration testing.
 * Step 1: runs agent "step-one"
 * Step 2: runs agent "step-two"
 */
import type { WorkflowContext, WorkflowResult } from "../workflow.js";

export const name = "test-two-step";
export const description = "Two-step test workflow for guard integration testing";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const r1 = await ctx.runAgent("step-one", `Step 1 of: ${ctx.task}`);
  const r2 = await ctx.runAgent("step-two", `Step 2 of: ${ctx.task}. Previous: ${r1.lastAssistantText}`);
  return ctx.done(`Completed both steps. Step1: ${r1.lastAssistantText}, Step2: ${r2.lastAssistantText}`);
}
