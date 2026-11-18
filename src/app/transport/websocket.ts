import type { PublicEvent } from "@may-agent/control/events";
import type { EventInterface } from "../core/events/interface.js";

export type DaemonWebSocketPeer = {
  bufferedAmount?: number;
  send(data: string): unknown;
};

type Subscription = {
  sessions: Set<string> | null;
  conversations: Set<string>;
  taskApps: Set<string>;
  task?: { appId: string; taskId: string };
  overflowed: boolean;
  unsubscribe: () => void;
};

export type DaemonWebSocketTransport = {
  open(ws: DaemonWebSocketPeer): void;
  message(ws: DaemonWebSocketPeer, message: unknown): void;
  close(ws: DaemonWebSocketPeer): void;
};

function eventMatchesSubscription(event: PublicEvent, state: Subscription): boolean {
  const data = event.data ?? {};
  const sessionId = typeof data.sessionId === "string" ? data.sessionId : undefined;
  if (state.sessions === null || (sessionId && state.sessions.has(sessionId))) return true;
  const appId = event.target?.appId ?? (typeof data.appId === "string" ? data.appId : undefined);
  const taskId = event.target?.taskId ?? (typeof data.taskId === "string" ? data.taskId : undefined);
  const conversationId = typeof data.conversationId === "string" ? data.conversationId : undefined;
  if (conversationId && state.conversations.has(conversationId)) return true;
  if (state.task && appId === state.task.appId && taskId === state.task.taskId) return true;
  return Boolean(appId && state.taskApps.has(appId));
}

function decodeMessage(message: unknown): string {
  if (typeof message === "string") return message;
  if (message instanceof ArrayBuffer) return new TextDecoder().decode(message);
  if (ArrayBuffer.isView(message)) return new TextDecoder().decode(message);
  return String(message);
}

export function createDaemonWebSocketTransport(options: {
  events: Pick<EventInterface, "subscribe">;
  agent: string;
  instance: string;
  maxBufferedBytes?: number;
}): DaemonWebSocketTransport {
  const subscriptions = new Map<DaemonWebSocketPeer, Subscription>();
  const maxBufferedBytes = options.maxBufferedBytes ?? 256 * 1024;

  function open(ws: DaemonWebSocketPeer): void {
    const state: Subscription = {
      sessions: new Set(),
      conversations: new Set(),
      taskApps: new Set(),
      overflowed: false,
      unsubscribe: () => {},
    };
    state.unsubscribe = options.events.subscribe({}, (event) => {
      if (!eventMatchesSubscription(event, state)) return;
      if (Number(ws.bufferedAmount ?? 0) > maxBufferedBytes) {
        if (!state.overflowed) {
          state.overflowed = true;
          try {
            ws.send(JSON.stringify({ type: "overflow", action: "reread" }));
          } catch {}
        }
        return;
      }
      state.overflowed = false;
      try {
        ws.send(JSON.stringify(event));
      } catch {}
    });
    subscriptions.set(ws, state);
    ws.send(JSON.stringify({ type: "connected", agent: options.agent, instance: options.instance }));
  }

  function message(ws: DaemonWebSocketPeer, message: unknown): void {
    const state = subscriptions.get(ws);
    if (!state) return;
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(decodeMessage(message));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Valid subscription JSON required" }));
      return;
    }
    if (frame.type !== "subscribe") {
      ws.send(JSON.stringify({ type: "error", message: "Only subscribe frames are accepted on /ws" }));
      return;
    }
    const strings = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 100)
        : [];
    const sessions = strings(frame.sessions);
    state.sessions = sessions.includes("*") ? null : new Set(sessions);
    state.conversations = new Set(strings(frame.conversations));
    state.taskApps = new Set(strings(frame.taskApps).map((appId) => appId.replace(/\.app$/, "")));
    const task =
      frame.task && typeof frame.task === "object" && !Array.isArray(frame.task)
        ? (frame.task as Record<string, unknown>)
        : null;
    state.task =
      task && typeof task.appId === "string" && typeof task.taskId === "string"
        ? { appId: task.appId.trim(), taskId: task.taskId.trim() }
        : undefined;
    state.overflowed = false;
    ws.send(JSON.stringify({ type: "subscribed" }));
  }

  function close(ws: DaemonWebSocketPeer): void {
    subscriptions.get(ws)?.unsubscribe();
    subscriptions.delete(ws);
  }

  return { open, message, close };
}
