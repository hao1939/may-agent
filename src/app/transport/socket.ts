/**
 * Unix socket control UI.
 *
 * The socket is one daemon-instance control plane, even though the legacy
 * filename still includes the interface agent (`may.sock`).
 */

import type { EventInput, EventInterface, EventReceipt } from "../event-interface.js";
import {
  attachControlSocket,
  type AttachControlSocketOptions,
  type ControlSocket,
  type ControlStatusItem,
} from "../../../packages/control/src/server.js";
export type { SocketFrame } from "../../../packages/control/src/protocol.js";

export interface SocketUIOptions {
  socketPath: string;
  events: Pick<EventInterface, "get" | "subscribe">;
  publishEvent: (input: EventInput) => EventReceipt;
  publishCompatibilityEvent: (input: EventInput) => EventReceipt;
  getStatus: () => ControlStatusItem[];
  reportInfo: (message: string) => void;
  /** Interface agent label, kept for compatibility with existing welcome frames. */
  agentName: string;
  /** Daemon instance label. */
  instance: string;
  admitAppInput?: AttachControlSocketOptions["admitAppInput"];
  getAppConversation?: AttachControlSocketOptions["getAppConversation"];
  listAppTasks?: AttachControlSocketOptions["listAppTasks"];
  getAppTask?: AttachControlSocketOptions["getAppTask"];
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
}

export type SocketUI = ControlSocket;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function legacyEventInput(event: Record<string, unknown> & { type: string }): EventInput {
  const canonicalData = event.data;
  const data =
    canonicalData && typeof canonicalData === "object" && !Array.isArray(canonicalData)
      ? { ...(canonicalData as Record<string, unknown>) }
      : Object.fromEntries(
          Object.entries(event).filter(
            ([key]) => !["type", "source", "owner", "target", "timestamp", "trace"].includes(key),
          ),
        );
  const rawTarget =
    event.target && typeof event.target === "object" && !Array.isArray(event.target)
      ? (event.target as Record<string, unknown>)
      : {};
  const target = {
    appId: text(rawTarget.appId) ?? text(data.appId),
    taskId: text(rawTarget.taskId) ?? text(data.taskId),
    sessionId: text(rawTarget.sessionId) ?? text(data.sessionId),
  };
  const idempotencyKey = text(data.idempotencyKey);
  return {
    type: event.type,
    ...(Object.values(target).some(Boolean) ? { target } : {}),
    data,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

export async function attachSocketUI(opts: SocketUIOptions): Promise<SocketUI> {
  const { socketPath, events, agentName, instance } = opts;
  return attachControlSocket({
    socketPath,
    // The canonical daemon has no mutable current-session authority. Keep the
    // legacy control-socket field empty; clients subscribe explicitly.
    getSessionId: () => "",
    getStatus: opts.getStatus,
    emitEvent: (event) => opts.publishCompatibilityEvent(legacyEventInput(event)),
    publishEvent: opts.publishEvent,
    getEvent: events.get,
    describeProjectActions: opts.describeProjectActions,
    admitAppInput: opts.admitAppInput,
    getAppConversation: opts.getAppConversation,
    listAppTasks: opts.listAppTasks,
    getAppTask: opts.getAppTask,
    invokeProjectAction: opts.invokeProjectAction,
    subscribeEvents: (handler) => events.subscribe({}, handler),
    onInfo: opts.reportInfo,
    agentName,
    instance,
  });
}
