import type { CronEntry, HandlerContext, HandlerModule, RunOpts } from "../agent-sdk.ts";

type MaybePromise<T> = T | Promise<T>;
type ValueResolver<T> = T | ((ctx: HandlerContext, event: unknown, entry: CronEntry) => MaybePromise<T>);

export interface WorkflowHandlerOptions {
  workflow: ValueResolver<string>;
  task: ValueResolver<string>;
  source?: ValueResolver<string | undefined>;
  projectId?: ValueResolver<string | undefined>;
  includeEvent?: boolean;
  shouldRun?: (ctx: HandlerContext, event: unknown, entry: CronEntry) => MaybePromise<boolean>;
}

async function resolveValue<T>(
  value: ValueResolver<T>,
  ctx: HandlerContext,
  event: unknown,
  entry: CronEntry,
): Promise<T> {
  if (typeof value === "function") {
    return (value as (ctx: HandlerContext, event: unknown, entry: CronEntry) => MaybePromise<T>)(ctx, event, entry);
  }
  return value;
}

function triggerEventType(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const value = (event as { type?: unknown }).type;
  return typeof value === "string" ? value : null;
}

function emitSkipped(
  ctx: HandlerContext,
  entry: CronEntry,
  workflow: string | null,
  reason: string,
  event: unknown,
): void {
  ctx.sdk.log("info", `[workflow-handler:${entry.name}] skipped: ${reason}`);
  ctx.sdk.emit("handler.skipped", {
    handler: entry.name,
    workflow,
    reason,
    eventType: triggerEventType(event),
  });
}

function appendEvent(task: string, event: unknown): string {
  if (!event) return task;
  return `${task}\n\n## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

export function createWorkflowHandler(options: WorkflowHandlerOptions): HandlerModule["create"] {
  return (ctx: HandlerContext, entry: CronEntry) => async (event?: unknown) => {
    const configuredWorkflow = typeof options.workflow === "string" ? options.workflow : null;

    if (options.includeEvent && !event) {
      emitSkipped(ctx, entry, configuredWorkflow, "includeEvent requested but no event payload received", event);
      return;
    }

    if (options.shouldRun && !(await options.shouldRun(ctx, event, entry))) {
      emitSkipped(ctx, entry, configuredWorkflow, "shouldRun returned false", event);
      return;
    }

    const workflow = await resolveValue(options.workflow, ctx, event, entry);
    const source = await resolveValue(options.source ?? ctx.agentName, ctx, event, entry);
    const projectId = await resolveValue(options.projectId, ctx, event, entry);
    const rawTask = await resolveValue(options.task, ctx, event, entry);
    const task = options.includeEvent ? appendEvent(rawTask, event) : rawTask;
    const runOpts: RunOpts = {};
    if (source) runOpts.source = source;
    if (projectId) runOpts.projectId = projectId;

    const startedAt = Date.now();
    ctx.sdk.log("info", `[workflow-handler:${entry.name}] Dispatching workflow "${workflow}" for ${source ?? ctx.agentName}`);
    try {
      const result = await ctx.sdk.runWorkflow(workflow, task, runOpts);
      ctx.sdk.log("info", `[workflow-handler:${entry.name}] Workflow "${workflow}" -> ${result.status}`);
      ctx.sdk.emit("handler.workflow_dispatched", {
        handler: entry.name,
        workflow,
        source: source ?? ctx.agentName,
        projectId: projectId ?? null,
        workflowRunId: result.runId ?? null,
        status: result.status,
        durationMs: Date.now() - startedAt,
      });
    } catch (error: any) {
      const message = error?.message?.slice(0, 500) ?? String(error).slice(0, 500);
      ctx.sdk.log("info", `[workflow-handler:${entry.name}] Workflow "${workflow}" ERROR: ${message}`);
      ctx.sdk.emit("handler.workflow_failed", {
        handler: entry.name,
        workflow,
        source: source ?? ctx.agentName,
        projectId: projectId ?? null,
        error: message,
        durationMs: Date.now() - startedAt,
      });
    }
  };
}
