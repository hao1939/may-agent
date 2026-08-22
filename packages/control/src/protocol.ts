import { isRecord } from "./event-envelope.js";

export type EventTarget = {
  appId?: string;
  taskId?: string;
  sessionId?: string;
};

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

export type EventReceipt = {
  eventId: number;
  eventType: string;
  delivery: "recorded" | "accepted";
  links?: EventLink[];
};

export const SOCKET_CONTROL_TYPES = new Set([
  "subscribe",
  "status",
  "publish",
  "event.get",
  "app.input.admit",
  "app.conversation.get",
  "app.tasks.list",
  "app.task.get",
  "app.task.resolve",
  "apps.list",
  "tasks.list",
  "task.get",
  "task.cancel",
  "project.actions.describe",
  "project.action.invoke",
]);

export type SocketFrame =
  | {
      kind: "control";
      command:
        | "subscribe"
        | "status"
        | "publish"
        | "event.get"
        | "app.input.admit"
        | "app.conversation.get"
        | "app.tasks.list"
        | "app.task.get"
        | "app.task.resolve"
        | "apps.list"
        | "tasks.list"
        | "task.get"
        | "task.cancel"
        | "project.actions.describe"
        | "project.action.invoke";
      frame: Record<string, unknown>;
    }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

export function isSocketCommandType(type: string): boolean {
  return type.startsWith("trigger.");
}

function isCanonicalEventType(type: string): boolean {
  return type.includes(".") && !isSocketCommandType(type);
}

function canonicalEventError(event: Record<string, unknown>): string | null {
  const type = event.type;
  if (typeof type !== "string") return null;
  if (!isCanonicalEventType(type)) return null;
  if (!isRecord(event.data)) return `Canonical event '${type}' requires object field 'data'`;
  if (typeof event.source !== "string" || !event.source.trim())
    return `Canonical event '${type}' requires string field 'source'`;
  if (typeof event.owner !== "string" || !event.owner.trim())
    return `Canonical event '${type}' requires string field 'owner'`;
  return null;
}

function socketEvent(command: string, event: Record<string, unknown>): SocketFrame {
  const message = canonicalEventError(event);
  return message ? { kind: "error", command, message } : { kind: "event", command, event };
}

export function normalizeSocketFrame(frame: Record<string, unknown>): SocketFrame {
  const cmdType = frame.type;
  if (typeof cmdType !== "string" || !cmdType.trim()) {
    return { kind: "error", command: cmdType ?? null, message: `Missing or invalid event type: ${String(cmdType)}` };
  }

  if (SOCKET_CONTROL_TYPES.has(cmdType)) {
    return {
      kind: "control",
      command: cmdType as
        | "subscribe"
        | "status"
        | "publish"
        | "event.get"
        | "app.input.admit"
        | "app.conversation.get"
        | "app.tasks.list"
        | "app.task.get"
        | "app.task.resolve"
        | "apps.list"
        | "tasks.list"
        | "task.get"
        | "task.cancel"
        | "project.actions.describe"
        | "project.action.invoke",
      frame,
    };
  }

  if (!isCanonicalEventType(cmdType) && !isSocketCommandType(cmdType)) {
    return { kind: "error", command: cmdType, message: `Unsupported socket frame type: ${cmdType}` };
  }

  return socketEvent(cmdType, frame);
}
