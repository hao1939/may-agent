/**
 * Unix socket control UI.
 *
 * The socket is one daemon-instance control plane, even though the legacy
 * filename still includes the interface agent (`may.sock`).
 */

import { EVENT_INGRESS_SOURCE, EVENT_ROW_ID, type EventBus, type AgentEvent } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";
import {
  attachControlSocket,
  type AttachControlSocketOptions,
  type ControlSocket,
  type ControlStatusItem,
} from "../../../packages/control/src/server.js";
export type { SocketFrame } from "../../../packages/control/src/protocol.js";

export interface SocketUIOptions {
  socketPath: string;
  bus: EventBus;
  manager: SubagentManager;
  getSessionId: () => string;
  /** Interface agent label, kept for compatibility with existing welcome frames. */
  agentName: string;
  /** Daemon instance label. */
  instance: string;
  admitAppInput?: AttachControlSocketOptions["admitAppInput"];
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
}

export type SocketUI = ControlSocket;

function toControlStatus(status: ReturnType<SubagentManager["status"]>): ControlStatusItem[] {
  return status.map((item) => ({
    agent: item.agent,
    sessionId: item.sessionId,
    status: item.status,
    kind: item.kind ?? "",
    task: item.task,
  }));
}

export async function attachSocketUI(opts: SocketUIOptions): Promise<SocketUI> {
  const { socketPath, bus, manager, getSessionId, agentName, instance } = opts;
  return attachControlSocket({
    socketPath,
    getSessionId,
    getStatus: () => toControlStatus(manager.status()),
    emitEvent: (event) => {
      Object.defineProperty(event, EVENT_INGRESS_SOURCE, { value: "control-socket", configurable: true });
      const emitted = bus.emit(event as AgentEvent);
      const eventId = emitted[EVENT_ROW_ID];
      return Number.isInteger(eventId) && Number(eventId) > 0 ? { eventId: Number(eventId) } : {};
    },
    describeProjectActions: opts.describeProjectActions,
    admitAppInput: opts.admitAppInput,
    invokeProjectAction: opts.invokeProjectAction,
    subscribeEvents: (handler) =>
      bus.subscribe((event) => handler(event as unknown as Record<string, unknown> & { type: string })),
    onDelivered: (event, clientCount) => {
      const data = event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : event;
      bus.emit({
        type: "channel.delivery.completed",
        source: "control-socket",
        owner: "agent:may",
        target: { human: true },
        data: {
          channel: typeof data.channel === "string" ? data.channel : "control-socket",
          clientCount,
          sessionId: data.sessionId,
          resultEventType: event.type,
          operationId: data.operationId,
          appInboxItemId: data.appInboxItemId,
          appInboxRequestId: data.appInboxRequestId,
        },
      } as any);
    },
    onInfo: (message) => bus.emit({ type: "info", message }),
    agentName,
    instance,
  });
}
