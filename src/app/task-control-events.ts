import type { EventInput } from "@may-agent/control/events";
import { eventData, type AgentEvent, type EventBus, type SubscriberResult } from "./core/events/bus.js";

type ExactTask = {
  appId: string;
  taskId: string;
  generation: number;
  resourceVersion: number;
};

export function taskRetryRequestedEvent(task: ExactTask): EventInput {
  return {
    type: "app.task.retry.requested",
    target: { appId: task.appId, taskId: task.taskId },
    data: {
      expectedGeneration: task.generation,
      expectedResourceVersion: task.resourceVersion,
    },
    idempotencyKey: `app-task-retry:${task.appId}:${task.taskId}:${task.generation}:${task.resourceVersion}`,
  };
}

export function taskCancelRequestedEvent(task: ExactTask, reason: string): EventInput {
  const normalizedReason = reason.trim() || "human requested cancellation";
  return {
    type: "app.task.cancel.requested",
    target: { appId: task.appId, taskId: task.taskId },
    data: {
      expectedGeneration: task.generation,
      expectedResourceVersion: task.resourceVersion,
      reason: normalizedReason,
    },
    idempotencyKey: `app-task-cancel:${task.appId}:${task.taskId}:${task.generation}:${task.resourceVersion}`,
  };
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${field} must be a positive integer`);
  return Number(value);
}

/** One synchronous, fenced mutation route shared by every external adapter. */
export function attachTaskControlEventRoute(
  bus: EventBus,
  access: {
    retryTask(input: ExactTask & { controlKey: string }): unknown;
    cancelTask(input: ExactTask & { reason: string; controlKey: string }): unknown;
  },
): () => void {
  return bus.subscribeDurableRoute(
    (event: AgentEvent): SubscriberResult => {
      if (event.type !== "app.task.retry.requested" && event.type !== "app.task.cancel.requested") return;
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
      if (event.type === "app.task.retry.requested") access.retryTask({ ...exact, controlKey });
      else {
        const reason = typeof data.reason === "string" ? data.reason.trim() : "";
        if (!reason) throw new Error("app.task.cancel.requested reason must be a non-empty string");
        access.cancelTask({ ...exact, reason, controlKey });
      }
      return { accepted: true, by: "task-control", route: "direct" };
    },
    { label: "task-control" },
  );
}
