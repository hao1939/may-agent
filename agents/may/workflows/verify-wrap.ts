/**
 * verify-wrap — Simple wrapper workflow that runs an agent task.
 * 
 * Used by cron jobs (reflect, optimize, common-sense-verify, research-intake)
 * that just need to run a single agent session with their configured task.
 */

import type { WorkflowContext } from "@may-agent/sdk";

export const name = "verify-wrap";
export const description = "Simple wrapper: runs the configured agent with the given task.";

export const execute = async (ctx: WorkflowContext) => {
  try {
    const result = await ctx.runAgent(ctx.agent, ctx.task);

    if (result.status === "error") {
      return ctx.blocked(`Agent ${ctx.agent} failed: ${result.error || result.lastAssistantText?.slice(0, 200)}`);
    }

    const summary = ctx.summarize(result, { maxLength: 300 });
    return ctx.done(typeof summary === "string" ? summary : `${ctx.agent} completed task successfully.`);
  } catch (err) {
    return ctx.blocked(`Agent ${ctx.agent} threw unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
};
