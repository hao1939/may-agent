/**
 * run-workflow — cron handler that dispatches a workflow via the SDK.
 */
import { createWorkflowHandler } from "../../shared/agent-sdk.ts";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";

interface RunWorkflowConfig {
  workflow: string;
  agent: string;
  task: string;
  includeEvent?: boolean;
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = entry.handlerConfig as RunWorkflowConfig | undefined;
  if (!config?.workflow || !config?.agent || !config?.task) {
    return async () => { ctx.sdk.log("info", `[run-workflow:${entry.name}] handlerConfig must include: workflow, agent, task`); };
  }

  return createWorkflowHandler({
    workflow: config.workflow,
    source: config.agent,
    task: config.task,
    includeEvent: config.includeEvent,
  })(ctx, entry);
};
