/**
 * E2E fixture handler: dispatches a configured workflow on each fire.
 *
 * Used by e3b-workflow-discovery. The workflow name is read from the trigger
 * event payload's `data.workflow` field, the cron entry's `handlerConfig.workflow`,
 * or "e2e-noop-workflow" by default.
 *
 * Emits e2e.dispatch.attempt before the call and e2e.dispatch.result after,
 * so the test can correlate which workflow was attempted and the outcome.
 */
import type { CronEntry, HandlerContext, HandlerModule, TriggerEvent } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const payload = (event?.data?.data ?? event?.data ?? {}) as Record<string, unknown>;
    const configuredWorkflow = entry.handlerConfig?.workflow;
    const workflowName = typeof payload.workflow === "string"
      ? payload.workflow
      : typeof configuredWorkflow === "string"
        ? configuredWorkflow
        : "e2e-noop-workflow";

    ctx.sdk.emit("e2e.dispatch.attempt", { handler: entry.name, workflow: workflowName });

    try {
      const result = await ctx.sdk.runWorkflow(workflowName, "e2e test task");
      ctx.sdk.emit("e2e.dispatch.result", {
        handler: entry.name,
        workflow: workflowName,
        status: result.status,
        summary: result.summary,
      });
    } catch (err) {
      ctx.sdk.emit("e2e.dispatch.result", {
        handler: entry.name,
        workflow: workflowName,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
};
