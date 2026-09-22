/** Public event data shared by control clients and Host adapters. */
export type EventTarget = {
  appId?: string;
  taskId?: string;
  sessionId?: string;
};

/** Caller input. The Host supplies event identity, time, and trusted provenance. */
export type EventInput = {
  type: string;
  target?: EventTarget;
  data: Record<string, unknown>;
  idempotencyKey?: string;
};

export type EventLink = {
  kind: "request" | "task" | "session" | "delivery" | "operation";
  id: string;
  state?: string;
  summary?: string;
};

/** Admission acknowledgement; neither delivery value means work has completed. */
export type EventReceipt = {
  eventId: number;
  eventType: string;
  delivery: "recorded" | "accepted";
  links?: EventLink[];
};

/** Transport shape, not a stability guarantee for every diagnostic payload.
 * Task/Conversation notifications mean reread that resource, not completion.
 * Ephemeral notifications may have no durable id or time. */
export type PublicEvent = {
  id?: number;
  type: string;
  source?: string;
  owner?: string;
  target?: EventTarget;
  data: Record<string, unknown>;
  timestamp?: number;
};

/** Diagnostic event plus its admission/correlation facts. Linked route state
 * is not Task completion; read the exact Task/request for authoritative results. */
export type EventView = {
  event: PublicEvent & { id: number; timestamp: number };
  delivery: {
    state: "recorded" | "accepted" | "unhandled" | "failed";
    acceptedBy?: string;
    note?: string;
  };
  links: EventLink[];
};

export type ExactTask = {
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

export function taskCloseRequestedEvent(task: ExactTask, afterResult: string, reason: string): EventInput {
  for (const [field, value] of Object.entries({
    expectedGeneration: task.generation,
    expectedResourceVersion: task.resourceVersion,
  })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`);
  }
  if (!task.appId.trim()) throw new Error("appId is required");
  if (!task.taskId.trim()) throw new Error("taskId is required");
  const acceptedResult = afterResult.trim();
  if (!acceptedResult) throw new Error("afterResult must be a non-empty accepted attempt ID");
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error("Task completion requires a reason");
  return {
    type: "app.task.close.requested",
    target: { appId: task.appId, taskId: task.taskId },
    data: {
      expectedGeneration: task.generation,
      expectedResourceVersion: task.resourceVersion,
      afterResult: acceptedResult,
      reason: normalizedReason,
    },
    idempotencyKey: `app-task-close:${task.appId}:${task.taskId}:${task.generation}:${task.resourceVersion}:${acceptedResult}`,
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
