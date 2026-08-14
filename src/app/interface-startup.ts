import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import type { EventBus } from "./event-bus.js";
import { attachSocketUI, type SocketUI } from "./transport/socket.js";
import type { AttachControlSocketOptions } from "../../packages/control/src/server.js";

export interface InterfaceStartupOptions {
  socketEnabled: boolean;
  persistDir: string;
  instanceLabel: string;
  interfaceAgent: string;
  bus: EventBus;
  manager: SubagentManager;
  getSessionId: () => string;
  admitAppInput?: AttachControlSocketOptions["admitAppInput"];
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
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
        bus: options.bus,
        manager: options.manager,
        getSessionId: options.getSessionId,
        admitAppInput: options.admitAppInput,
        describeProjectActions: options.describeProjectActions,
        invokeProjectAction: options.invokeProjectAction,
        agentName: options.interfaceAgent,
        instance: options.instanceLabel,
      })
    : { close: () => {}, clientCount: () => 0 };

  if (options.socketEnabled) {
    options.bus.emit({
      type: "info",
      message: `[instance:${options.instanceLabel}] PID ${process.pid}, socket ${socketName}`,
    });
  } else {
    options.bus.emit({
      type: "info",
      message: `[instance:${options.instanceLabel}] PID ${process.pid}, socket disabled (use --socket to enable)`,
    });
  }

  return { socketPath, socketUI };
}
