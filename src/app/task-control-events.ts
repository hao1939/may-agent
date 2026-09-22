import type { ExactTask } from "@may-agent/control/events";
export { taskRetryRequestedEvent, taskCloseRequestedEvent, taskCancelRequestedEvent } from "@may-agent/control/events";
import { taskControlAction } from "./core/events/interface.js";
import { eventData, type AgentEvent, type EventBus, type SubscriberResult } from "./core/events/bus.js";

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${field} must be a positive integer`);
  return Number(value);
}

/** One synchronous, fenced mutation route shared by every external adapter. */
export function attachTaskControlEventRoute(
  bus: EventBus,
  access: {
    retryTask(input: ExactTask & { controlKey: string }): unknown;
    cancelTask(input: ExactTask & { reason: string; controlKey: string; decision: "human" | "app-policy" }): unknown;
    closeTask(input: ExactTask & { afterResult: string; reason: string; controlKey: string }): unknown;
  },
): () => void {
  return bus.subscribeDurableRoute(
    (event: AgentEvent): SubscriberResult => {
      const action = taskControlAction(event.type);
      if (!action) return;
      const data = eventData(event);
      const appId = typeof data.appId === "string" ? data.appId.trim() : "";
      const taskId = typeof data.taskId === "string" ? data.taskId.trim() : "";
      if (!appId || !taskId) throw new Error(`${event.type} requires an exact App Task target`);
      const expectedGeneration = positiveInteger(data.expectedGeneration, `${event.type} expectedGeneration`);
      const expectedResourceVersion = positiveInteger(
        data.expectedResourceVersion,
        `${event.type} expectedResourceVersion`,
      );
      const controlKey = typeof data.idempotencyKey === "string" ? data.idempotencyKey.trim() : "";
      if (!controlKey) throw new Error(`${event.type} requires an idempotency key`);

      const exact = { appId, taskId, generation: expectedGeneration, resourceVersion: expectedResourceVersion };
      switch (action) {
        case "retry":
          access.retryTask({ ...exact, controlKey });
          break;
        case "close": {
          const reason = typeof data.reason === "string" ? data.reason.trim() : "";
          if (!reason) throw new Error(`${event.type} reason must be a non-empty string`);
          const afterResult = typeof data.afterResult === "string" ? data.afterResult.trim() : "";
          if (!afterResult) throw new Error("app.task.close.requested afterResult must be a non-empty attempt ID");
          access.closeTask({ ...exact, afterResult, reason, controlKey });
          break;
        }
        case "cancel": {
          const reason = typeof data.reason === "string" ? data.reason.trim() : "";
          if (!reason) throw new Error(`${event.type} reason must be a non-empty string`);
          access.cancelTask({
            ...exact,
            reason,
            controlKey,
            decision: "source" in event && event.source === "telegram" ? "human" : "app-policy",
          });
          break;
        }
        default: {
          const unsupported: never = action;
          throw new Error(`Unsupported Task control action: ${String(unsupported)}`);
        }
      }
      return { accepted: true, by: "task-control", route: "direct" };
    },
    { label: "task-control" },
  );
}
