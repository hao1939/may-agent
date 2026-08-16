import type { CronEntry } from "./cron-tool.js";
import type { EventEnvelope, WorkflowHandlerContext } from "./handler-context.js";
import type { RunOpts } from "./sdk.js";

type MaybePromise<T> = T | Promise<T>;
type ValueResolver<T> =
  | T
  | ((
      ctx: WorkflowHandlerContext,
      event: EventEnvelope | undefined,
      entry: CronEntry,
    ) => MaybePromise<T>);

export interface WorkflowHandlerOptions {
  workflow: ValueResolver<string>;
  task: ValueResolver<string>;
  source?: ValueResolver<string | undefined>;
  projectId?: ValueResolver<string | undefined>;
  includeEvent?: boolean;
  shouldRun?: (
    ctx: WorkflowHandlerContext,
    event: EventEnvelope | undefined,
    entry: CronEntry,
  ) => boolean | Promise<boolean>;
}

async function resolveValue<T>(
  value: ValueResolver<T>,
  ctx: WorkflowHandlerContext,
  event: EventEnvelope | undefined,
  entry: CronEntry,
): Promise<T> {
  if (typeof value === "function") {
    return (
      value as (
        ctx: WorkflowHandlerContext,
        event: EventEnvelope | undefined,
        entry: CronEntry,
      ) => MaybePromise<T>
    )(ctx, event, entry);
  }
  return value;
}

function appendEvent(task: string, event: EventEnvelope | undefined): string {
  if (!event) return task;
  return `${task}\n\n## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

/** Internal adapter for the remaining agent-owned cron handler convention. */
export function createWorkflowHandler(options: WorkflowHandlerOptions) {
  return (ctx: WorkflowHandlerContext, entry: CronEntry) => async (event?: EventEnvelope): Promise<void> => {
    if (options.shouldRun && !(await options.shouldRun(ctx, event, entry))) {
      ctx.sdk.log("info", `[workflow-handler:${entry.name}] skipped`);
      ctx.sdk.emit("handler.skipped", {
        handler: entry.name,
        reason: "shouldRun returned false",
        eventType: event?.type ?? null,
      });
      return;
    }

    if (options.includeEvent && !event) {
      ctx.sdk.log(
        "warn",
        `[workflow-handler:${entry.name}] skipped includeEvent dispatch because no event payload was received`,
      );
      ctx.sdk.emit("handler.skipped", {
        handler: entry.name,
        reason: "includeEvent requested but no event payload received",
        eventType: null,
      });
      return;
    }

    const workflow = await resolveValue(options.workflow, ctx, event, entry);
    const source = await resolveValue(
      options.source ?? ctx.agentName,
      ctx,
      event,
      entry,
    );
    const projectId = await resolveValue(
      options.projectId,
      ctx,
      event,
      entry,
    );
    const rawTask = await resolveValue(options.task, ctx, event, entry);
    const task = options.includeEvent ? appendEvent(rawTask, event) : rawTask;
    const runOpts: RunOpts = {};
    if (source) runOpts.source = source;
    if (projectId) runOpts.projectId = projectId;

    ctx.sdk.log(
      "info",
      `[workflow-handler:${entry.name}] Dispatching workflow "${workflow}" for ${source ?? ctx.agentName}`,
    );
    const result = await ctx.sdk.runWorkflow(workflow, task, runOpts);
    ctx.sdk.log(
      "info",
      `[workflow-handler:${entry.name}] Workflow "${workflow}" -> ${result.status}${result.runId ? ` (${result.runId})` : ""}`,
    );
    ctx.sdk.emit("handler.workflow_dispatched", {
      handler: entry.name,
      workflow,
      source: source ?? ctx.agentName,
      projectId: projectId ?? null,
      workflowRunId: result.runId ?? null,
      status: result.status,
    });
  };
}
