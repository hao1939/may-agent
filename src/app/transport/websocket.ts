import type { PublicEvent } from "@may-agent/control/events";
import { isTaskDerivedViewWake, taskUpdateIdentity } from "../../../packages/control/src/task-wake.js";
import type { EventInterface } from "../core/events/interface.js";
import type { ExecutionStatus } from "../core/reads/execution-status.js";

export type DaemonWebSocketPeer = {
  bufferedAmount?: number;
  getBufferedAmount?(): number;
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
  if (event.type === "runtime.reload.finished") return true;
  const data = event.data ?? {};
  const sessionId = typeof data.sessionId === "string" ? data.sessionId : undefined;
  if (state.sessions === null || (sessionId && state.sessions.has(sessionId))) return true;
  if (taskUpdateIdentity(event)) return false;
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
  getStatus(): ExecutionStatus;
  agent: string;
  instance: string;
  maxBufferedBytes?: number;
}): DaemonWebSocketTransport {
  const subscriptions = new Map<DaemonWebSocketPeer, Subscription>();
  const maxBufferedBytes = options.maxBufferedBytes ?? 256 * 1024;

  function statusFields(): Record<string, unknown> {
    const status = options.getStatus();
    return {
      activeAgents: status.sessions
        .filter((session) => session.status === "running" || session.status === "idle")
        .slice(0, 100)
        .map((session) => ({
          agent: session.agent,
          sessionId: session.sessionId,
          status: session.status,
          kind: session.kind,
          task: session.task.slice(0, 100),
        })),
      activeWork: status.activeWork,
    };
  }

  function open(ws: DaemonWebSocketPeer): void {
    const state: Subscription = {
      sessions: new Set(),
      conversations: new Set(),
      taskApps: new Set(),
      overflowed: false,
      unsubscribe: () => {},
    };
    const sendWake = (frame: PublicEvent | { type: "app.task.updated"; data: { appId: string; taskId: string } }) => {
      const bufferedAmount = typeof ws.getBufferedAmount === "function"
        ? ws.getBufferedAmount()
        : Number(ws.bufferedAmount ?? 0);
      if (bufferedAmount > maxBufferedBytes) {
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
        ws.send(JSON.stringify(frame));
      } catch {}
    };
    state.unsubscribe = options.events.subscribe({}, (event) => {
      if (eventMatchesSubscription(event, state)) sendWake(event);
      const wake = taskUpdateIdentity(event);
      if (
        wake &&
        (
          (state.task?.appId === wake.appId && state.task.taskId === wake.taskId) ||
          (isTaskDerivedViewWake(event) && state.taskApps.has(wake.appId))
        )
      ) {
        sendWake({ type: "app.task.updated", data: wake });
      }
    });
    subscriptions.set(ws, state);
    let initialStatus: Record<string, unknown>;
    try {
      initialStatus = statusFields();
    } catch {
      initialStatus = { statusError: "Execution status unavailable" };
    }
    ws.send(JSON.stringify({ type: "connected", agent: options.agent, instance: options.instance, ...initialStatus }));
  }

  function message(ws: DaemonWebSocketPeer, message: unknown): void {
    const state = subscriptions.get(ws);
    if (!state) return;
    let frame: Record<string, unknown>;
    try {
      const parsed = JSON.parse(decodeMessage(message));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid frame");
      frame = parsed;
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Valid subscription JSON required" }));
      return;
    }
    if (frame.type === "status") {
      try {
        ws.send(JSON.stringify({ type: "status", command: "status", ...statusFields() }));
      } catch {
        ws.send(JSON.stringify({ type: "error", command: "status", message: "Execution status unavailable" }));
      }
      return;
    }
    if (frame.type !== "subscribe") {
      ws.send(JSON.stringify({ type: "error", message: "Only subscribe and status frames are accepted on /ws" }));
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
