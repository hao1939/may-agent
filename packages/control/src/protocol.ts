import { buildCanonicalEventEnvelope, isRecord, normalizeEventOwner } from "./event-envelope.js";

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
        | "project.actions.describe"
        | "project.action.invoke";
      frame: Record<string, unknown>;
    }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

const UNSUPPORTED_SOCKET_FRAME_TYPES = new Set(["emit", "message", "close", "cancel_task", "reload_agents"]);

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

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shortcutSource(frame: Record<string, unknown>, fallback = "socket"): string {
  return nonEmptyString(frame.source) ?? fallback;
}

function shortcutOwner(frame: Record<string, unknown>, fallback: unknown = "may"): string {
  return normalizeEventOwner(frame.owner, fallback);
}

function shortcutMessage(frame: Record<string, unknown>, primary = "message"): string | null {
  return nonEmptyString(frame[primary]) ?? nonEmptyString(frame.content) ?? nonEmptyString(frame.task);
}

function canonicalShortcutEvent(
  originalCommand: string,
  eventType: string,
  frame: Record<string, unknown>,
  data: Record<string, unknown>,
  defaults: { source?: string; owner?: unknown; urgency?: string } = {},
): SocketFrame {
  return socketEvent(
    originalCommand,
    buildCanonicalEventEnvelope(eventType, {
      source: shortcutSource(frame, defaults.source ?? "socket"),
      owner: shortcutOwner(frame, defaults.owner ?? "may"),
      ...(defaults.urgency ? { urgency: defaults.urgency } : {}),
      data,
    }),
  );
}

function normalizeHumanShortcutFrame(cmdType: string, frame: Record<string, unknown>): SocketFrame | null {
  switch (cmdType) {
    case "input": {
      const message = shortcutMessage(frame);
      if (!message) return { kind: "error", command: cmdType, message: "input requires string field 'message'" };
      const agent = nonEmptyString(frame.agent) ?? "may";
      if (agent === "may") {
        return canonicalShortcutEvent(
          cmdType,
          "app.input.requested",
          frame,
          {
            appId: "may",
            input: { kind: "message", data: { message } },
            channel: shortcutSource(frame),
          },
          { owner: "app:may" },
        );
      }
      return canonicalShortcutEvent(
        cmdType,
        "chat.start.requested",
        frame,
        {
          agent,
          message,
          channel: shortcutSource(frame),
        },
        { owner: agent },
      );
    }
    case "steer": {
      const sessionId = nonEmptyString(frame.sessionId);
      const message = shortcutMessage(frame);
      if (!sessionId) return { kind: "error", command: cmdType, message: "steer requires string field 'sessionId'" };
      if (!message) return { kind: "error", command: cmdType, message: "steer requires string field 'message'" };
      return canonicalShortcutEvent(cmdType, "session.steer.requested", frame, { sessionId, message });
    }
    case "session.cancel.requested": {
      if (isRecord(frame.data)) return socketEvent(cmdType, frame);
      const sessionId = nonEmptyString(frame.sessionId);
      if (!sessionId)
        return {
          kind: "error",
          command: cmdType,
          message: "session.cancel.requested requires string field 'sessionId'",
        };
      const reason = nonEmptyString(frame.reason);
      return canonicalShortcutEvent(
        cmdType,
        "session.cancel.requested",
        frame,
        {
          sessionId,
          ...(reason ? { reason } : {}),
        },
        { urgency: "high" },
      );
    }
    case "cancel_all": {
      const reason = nonEmptyString(frame.reason) ?? "human requested cancel all";
      return canonicalShortcutEvent(cmdType, "session.cancel_all.requested", frame, { reason }, { urgency: "high" });
    }
    case "reload":
      return canonicalShortcutEvent(cmdType, "runtime.reload.requested", frame, {
        ...(nonEmptyString(frame.reason) ? { reason: nonEmptyString(frame.reason) } : {}),
      });
    case "restart":
      return canonicalShortcutEvent(
        cmdType,
        "runtime.restart.requested",
        frame,
        {
          ...(nonEmptyString(frame.reason) ? { reason: nonEmptyString(frame.reason) } : {}),
        },
        { urgency: "high" },
      );
    case "shutdown":
      return canonicalShortcutEvent(
        cmdType,
        "runtime.shutdown.requested",
        frame,
        {
          ...(nonEmptyString(frame.reason) ? { reason: nonEmptyString(frame.reason) } : {}),
        },
        { urgency: "high" },
      );
    case "fork": {
      const agent = nonEmptyString(frame.agent);
      const message = shortcutMessage(frame);
      const opts = isRecord(frame.opts) ? frame.opts : {};
      if (agent && message && opts.kind === "chat") {
        if (agent === "may") {
          return canonicalShortcutEvent(
            cmdType,
            "app.input.requested",
            { ...frame, source: shortcutSource(opts, shortcutSource(frame)) },
            {
              appId: "may",
              input: { kind: "message", data: { message } },
              channel: shortcutSource(opts, shortcutSource(frame)),
            },
            { owner: "app:may" },
          );
        }
        return canonicalShortcutEvent(
          cmdType,
          "chat.start.requested",
          {
            ...frame,
            source: shortcutSource(opts, shortcutSource(frame)),
          },
          {
            agent,
            message,
            channel: shortcutSource(opts, shortcutSource(frame)),
            forceNew: true,
            ...(nonEmptyString(opts.requestId) ? { requestId: nonEmptyString(opts.requestId) } : {}),
          },
          { owner: agent },
        );
      }
      return null;
    }
    default:
      return null;
  }
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
        | "project.actions.describe"
        | "project.action.invoke",
      frame,
    };
  }

  if (UNSUPPORTED_SOCKET_FRAME_TYPES.has(cmdType)) {
    return { kind: "error", command: cmdType, message: `Unsupported socket frame type: ${cmdType}` };
  }

  const normalizedShortcut = normalizeHumanShortcutFrame(cmdType, frame);
  if (normalizedShortcut) return normalizedShortcut;

  return socketEvent(cmdType, frame);
}
