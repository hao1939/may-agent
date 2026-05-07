/**
 * run-workflow — cron handler that dispatches a workflow via the SDK.
 */
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = entry.handlerConfig as { workflow: string; agent: string; task: string } | undefined;
  if (!config?.workflow || !config?.agent || !config?.task) {
    return async () => { ctx.sdk.log("info", `[run-workflow:${entry.name}] handlerConfig must include: workflow, agent, task`); };
  }

  return async () => {
    const { workflow, agent, task } = config;
    ctx.sdk.log("info", `[run-workflow:${entry.name}] Dispatching workflow "${workflow}" for ${agent}...`);

    try {
      const result = await ctx.sdk.runWorkflow(workflow, task, { source: agent });
      ctx.sdk.log("info", `[run-workflow:${entry.name}] Workflow "${workflow}" → ${result.status}`);
    } catch (err: any) {
      ctx.sdk.log("info", `[run-workflow:${entry.name}] Workflow "${workflow}" error: ${err.message?.slice(0, 200)}`);
    }
  };
};
