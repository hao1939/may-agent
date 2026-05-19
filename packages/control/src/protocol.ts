export const SOCKET_CONTROL_TYPES = new Set(["subscribe", "status"]);

export type SocketFrame =
  | { kind: "control"; command: "subscribe" | "status"; frame: Record<string, unknown> }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function owner(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "agent:may";
  const trimmed = value.trim();
  if (trimmed.startsWith("agent:") || trimmed.startsWith("human:")) return trimmed;
  if (["human", "hao", "user", "operator"].includes(trimmed.toLowerCase())) return "human:operator";
  return `agent:${trimmed}`;
}

function withoutEnvelopeFields(event: Record<string, unknown>): Record<string, unknown> {
  const { type: _type, source: _source, owner: _owner, urgency: _urgency, ttl_ms: _ttl, timestamp: _timestamp, ...data } = event;
  return data;
}

function normalizeKnownDomainEvent(event: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(event.data)) return event;
  const type = event.type;
  if (typeof type !== "string") return event;

  switch (type) {
    case "message.created":
      return {
        type,
        source: typeof event.source === "string" ? event.source : owner(event.from),
        owner: owner(event.owner ?? event.to),
        ...(typeof event.urgency === "string" ? { urgency: event.urgency } : {}),
        ...(typeof event.ttl_ms === "number" ? { ttl_ms: event.ttl_ms } : {}),
        ...(typeof event.timestamp === "number" ? { timestamp: event.timestamp } : {}),
        data: withoutEnvelopeFields(event),
      };

    case "project.comment.created":
    case "project.nudge":
      return {
        type,
        source: typeof event.source === "string" ? event.source : "socket",
        owner: owner(event.owner),
        data: withoutEnvelopeFields(event),
      };

    case "heartbeat.trigger":
      return {
        type,
        source: typeof event.source === "string" ? event.source : "socket",
        owner: owner(event.owner ?? event.agent),
        data: withoutEnvelopeFields(event),
      };

    default:
      return event;
  }
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
    return { kind: "event", command: cmdType, event: normalizeKnownDomainEvent({ type: eventName, ...rest }) };
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

  return { kind: "event", command: cmdType, event: normalizeKnownDomainEvent(event) };
}
