import type { AttachControlSocketOptions } from "@may-agent/control/server";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EventInterface } from "./core/events/interface.js";
import { attachSocketUI, type SocketUI } from "./transport/socket.js";

export interface InterfaceStartupOptions {
  socketEnabled: boolean;
  persistDir: string;
  instanceLabel: string;
  interfaceAgent: string;
  events: EventInterface;
  getStatus: AttachControlSocketOptions["getStatus"];
  reportInfo: (message: string) => void;
}

export interface InterfaceRuntime {
  socketPath: string;
  socketUI: SocketUI;
}

export async function startInterfaceRuntime(options: InterfaceStartupOptions): Promise<InterfaceRuntime> {
  const instanceDir = resolve(options.persistDir, "instances", options.instanceLabel);
  const socketName = `${options.interfaceAgent}.sock`;
  const pidName = `${options.interfaceAgent}.pid`;
  const socketPath = resolve(instanceDir, socketName);
  const pidPath = resolve(instanceDir, pidName);

  mkdirSync(instanceDir, { recursive: true });
  writeFileSync(pidPath, String(process.pid), "utf-8");
  process.on("exit", () => {
    try {
      if (existsSync(pidPath)) unlinkSync(pidPath);
    } catch {
      /* ignore */
    }
  });

  const socketUI = options.socketEnabled
    ? await attachSocketUI({
        socketPath,
        events: options.events,
        publishEvent: (input, approvalAuthorization) =>
          options.events.publish(input, {
            source: "control-socket",
            inputSource: { kind: "human", id: "control-socket" },
            ...(approvalAuthorization ? { approvalAuthorization } : {}),
          }),
        publishOperatorEvent: (input) =>
          options.events.publish(input, {
            source: "control-socket",
            inputSource: { kind: "human", id: "control-socket" },
            allowUnregisteredFact: true,
          }),
        getStatus: options.getStatus,
        reportInfo: options.reportInfo,
        agentName: options.interfaceAgent,
        instance: options.instanceLabel,
      })
    : { close: () => {}, clientCount: () => 0 };

  if (options.socketEnabled) {
    options.reportInfo(`[instance:${options.instanceLabel}] PID ${process.pid}, socket ${socketName}`);
  } else {
    options.reportInfo(
      `[instance:${options.instanceLabel}] PID ${process.pid}, socket disabled (use --socket to enable)`,
    );
  }

  return { socketPath, socketUI };
}
