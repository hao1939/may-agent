export const SOCKET_CONTROL_TYPES = new Set(["subscribe", "status"]);

export type SocketFrame =
  | { kind: "control"; command: "subscribe" | "status"; frame: Record<string, unknown> }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

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
    return { kind: "event", command: cmdType, event: { type: eventName, ...rest } };
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

  return { kind: "event", command: cmdType, event };
}
