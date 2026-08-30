import { describe, expect, it } from "bun:test";
import { EVENT_DELIVERY_RESULT, EVENT_REDELIVERY_REQUIRED, EventBus, type AgentEvent } from "./event-bus.js";
import {
  attachTaskControlEventRoute,
  taskCancelRequestedEvent,
  taskRetryRequestedEvent,
} from "./task-control-events.js";

describe("Task control Event boundary", () => {
  const task = { appId: "evaluation", taskId: "review/docs", generation: 2, resourceVersion: 7 };

  it("builds deterministic, exactly fenced external controls", () => {
    expect(taskRetryRequestedEvent(task)).toEqual({
      type: "app.task.retry.requested",
      target: { appId: "evaluation", taskId: "review/docs" },
      data: { expectedGeneration: 2, expectedResourceVersion: 7 },
      idempotencyKey: "app-task-retry:evaluation:review/docs:2:7",
    });
    expect(taskCancelRequestedEvent(task, " no longer needed ")).toEqual({
      type: "app.task.cancel.requested",
      target: { appId: "evaluation", taskId: "review/docs" },
      data: { expectedGeneration: 2, expectedResourceVersion: 7, reason: "no longer needed" },
      idempotencyKey: "app-task-cancel:evaluation:review/docs:2:7",
    });
  });

  it("passes exact retry and cancellation controls to their authoritative writers", () => {
    const bus = new EventBus();
    const calls: unknown[] = [];
    attachTaskControlEventRoute(bus, {
      retryTask: (input) => calls.push({ action: "retry", ...input }),
      cancelTask: (input) => calls.push({ action: "cancel", ...input }),
    });

    const retry = {
      ...taskRetryRequestedEvent(task),
      source: "control-socket",
      owner: "app:evaluation",
      data: {
        ...taskRetryRequestedEvent(task).data,
        appId: task.appId,
        taskId: task.taskId,
        idempotencyKey: taskRetryRequestedEvent(task).idempotencyKey,
      },
    } as AgentEvent;
    expect(bus.emit(retry)).toHaveProperty("type", "app.task.retry.requested");

    const cancel = {
      ...taskCancelRequestedEvent(task, "done"),
      source: "telegram",
      owner: "app:evaluation",
      data: {
        ...taskCancelRequestedEvent(task, "done").data,
        appId: task.appId,
        taskId: task.taskId,
        idempotencyKey: taskCancelRequestedEvent(task, "done").idempotencyKey,
      },
    } as AgentEvent;
    expect(bus.emit(cancel)).toHaveProperty("type", "app.task.cancel.requested");

    expect(calls).toEqual([
      {
        action: "retry",
        ...task,
        controlKey: taskRetryRequestedEvent(task).idempotencyKey,
      },
      {
        action: "cancel",
        ...task,
        reason: "done",
        controlKey: taskCancelRequestedEvent(task, "done").idempotencyKey,
      },
    ]);
  });

  it("delegates redelivery to the writer's atomic receipt and fence check", () => {
    const bus = new EventBus();
    const calls: string[] = [];
    attachTaskControlEventRoute(bus, {
      retryTask: ({ controlKey }) => calls.push(controlKey),
      cancelTask: () => undefined,
    });
    const recovered = {
      ...taskRetryRequestedEvent(task),
      source: "control-socket",
      owner: "app:evaluation",
      data: {
        ...taskRetryRequestedEvent(task).data,
        appId: task.appId,
        taskId: task.taskId,
        idempotencyKey: taskRetryRequestedEvent(task).idempotencyKey,
      },
    } as AgentEvent & { [EVENT_REDELIVERY_REQUIRED]?: boolean };
    Object.defineProperty(recovered, EVENT_REDELIVERY_REQUIRED, { value: true });
    bus.emit(recovered);
    expect(calls).toEqual([taskRetryRequestedEvent(task).idempotencyKey]);
  });

  it("does not mask a writer's stale or mismatched control rejection", () => {
    const bus = new EventBus();
    attachTaskControlEventRoute(bus, {
      retryTask: () => {
        throw new Error("control receipt belongs to another operation");
      },
      cancelTask: () => undefined,
    });
    const rejected = {
      ...taskRetryRequestedEvent(task),
      source: "control-socket",
      owner: "app:evaluation",
      data: {
        ...taskRetryRequestedEvent(task).data,
        appId: task.appId,
        taskId: task.taskId,
        idempotencyKey: taskRetryRequestedEvent(task).idempotencyKey,
      },
    } as AgentEvent;
    expect(bus.emit(rejected)[EVENT_DELIVERY_RESULT]).toBeUndefined();
  });
});
