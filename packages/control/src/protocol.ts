export const SOCKET_CONTROL_TYPES = new Set(["subscribe", "status"]);

export type SocketFrame =
  | { kind: "control"; command: "subscribe" | "status"; frame: Record<string, unknown> }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const LEGACY_SOCKET_FRAME_TYPES = new Set([
  "emit",
  "message",
  "close",
  "cancel_task",
  "reload_agents",
]);

function isSocketCommandType(type: string): boolean {
  return type.startsWith("trigger.") || type === "session.cancel.requested";
}

function isCanonicalEventType(type: string): boolean {
  return type.includes(".") && !isSocketCommandType(type);
}

function canonicalEventError(event: Record<string, unknown>): string | null {
  const type = event.type;
  if (typeof type !== "string") return null;
  if (!isCanonicalEventType(type)) return null;
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

  if (LEGACY_SOCKET_FRAME_TYPES.has(cmdType)) {
    return { kind: "error", command: cmdType, message: `Unsupported legacy socket frame type: ${cmdType}` };
  }

  return socketEvent(cmdType, frame);
}
