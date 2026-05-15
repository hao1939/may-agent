/**
 * Unix socket control UI.
 *
 * The socket is one daemon-instance control plane, even though the legacy
 * filename still includes the interface agent (`may.sock`).
 */

import type { EventBus, AgentEvent } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";
import { attachControlSocket, type ControlSocket, type ControlStatusItem } from "../../../packages/control/src/server.js";
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
    emitEvent: (event) => bus.emit(event as AgentEvent),
    subscribeEvents: (handler) => bus.subscribe((event) => handler(event as unknown as Record<string, unknown> & { type: string })),
    onInfo: (message) => bus.emit({ type: "info", message }),
    agentName,
    instance,
  });
}
