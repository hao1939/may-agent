export const SOCKET_CONTROL_TYPES = new Set(["subscribe", "status"]);

export type SocketFrame =
  | { kind: "control"; command: "subscribe" | "status"; frame: Record<string, unknown> }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const CANONICAL_SOCKET_EVENTS = new Set([
  "message.created",
  "project.comment.created",
  "project.nudge",
  "heartbeat.trigger",
]);

function canonicalEventError(event: Record<string, unknown>): string | null {
  const type = event.type;
  if (typeof type !== "string") return null;
  if (!CANONICAL_SOCKET_EVENTS.has(type)) return null;
  if (!isRecord(event.data)) return `Canonical event '${type}' requires object field 'data'`;
  if (typeof event.source !== "string" || !event.source.trim()) return `Canonical event '${type}' requires string field 'source'`;
  if (typeof event.owner !== "string" || !event.owner.trim()) return `Canonical event '${type}' requires string field 'owner'`;
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
    return { kind: "control", command: cmdType as "subscribe" | "status", frame };
  }

  if (cmdType === "emit") {
    const eventName = frame.event;
    if (typeof eventName !== "string" || !eventName.trim()) {
      return { kind: "error", command: cmdType, message: "emit frame requires string field 'event'" };
    }
    const { type: _, event: __, ...rest } = frame;
    return socketEvent(cmdType, { type: eventName, ...rest });
  }

  let event: Record<string, unknown> = { ...frame };

  if (cmdType === "input") {
    if (!event.source) event.source = "socket";
    if (!event.message && event.content) event.message = event.content;
  } else if (cmdType === "fork") {
    event = {
      type: "fork",
      agent: frame.agent,
      task: frame.task ?? frame.message,
      opts: { ...(typeof frame.opts === "object" && frame.opts ? frame.opts : {}), source: "socket" },
    };
  } else if (cmdType === "message" && !event.task && event.content) {
    event.task = event.content;
  } else if (cmdType === "close") {
    event = { type: "shutdown" };
  } else if (cmdType === "cancel_task") {
    event = { type: "cancel_all" };
  } else if (cmdType === "reload_agents") {
    event = { type: "reload" };
  }

  return socketEvent(cmdType, event);
}
