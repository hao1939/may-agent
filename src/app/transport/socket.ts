/**
 * Unix socket control UI.
 *
 * The socket is one daemon-instance control plane, even though the legacy
 * filename still includes the interface agent (`may.sock`).
 */

import type { EventInterface } from "../core/events/interface.js";
import type { EventInput, EventReceipt } from "@may-agent/control/events";
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
  /** Bounded operator fact ingress used by direct event frames and --emit. */
  publishOperatorEvent: (input: EventInput) => EventReceipt;
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
  resolveAppTask?: AttachControlSocketOptions["resolveAppTask"];
  listApps?: AttachControlSocketOptions["listApps"];
  listTasks?: AttachControlSocketOptions["listTasks"];
  getTask?: AttachControlSocketOptions["getTask"];
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
}

export type SocketUI = ControlSocket;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function operatorEventInput(event: Record<string, unknown> & { type: string }): EventInput {
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
  // Only the canonical envelope target is routing authority. Legacy flat/data
  // identities are correlation and lifecycle facts, not implicit addresses.
  const target = {
    appId: text(rawTarget.appId),
    taskId: text(rawTarget.taskId),
    sessionId: text(rawTarget.sessionId),
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
    emitEvent: (event) => opts.publishOperatorEvent(operatorEventInput(event)),
    publishEvent: opts.publishEvent,
    getEvent: events.get,
    describeProjectActions: opts.describeProjectActions,
    admitAppInput: opts.admitAppInput,
    getAppConversation: opts.getAppConversation,
    listAppTasks: opts.listAppTasks,
    getAppTask: opts.getAppTask,
    resolveAppTask: opts.resolveAppTask,
    listApps: opts.listApps,
    listTasks: opts.listTasks,
    getTask: opts.getTask,
    invokeProjectAction: opts.invokeProjectAction,
    subscribeEvents: (handler) => events.subscribe({}, handler),
    onInfo: opts.reportInfo,
    agentName,
    instance,
  });
}
