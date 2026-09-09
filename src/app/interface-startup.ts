import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EventInterface } from "./core/events/interface.js";
import { attachSocketUI, type SocketUI } from "./transport/socket.js";
import type { AttachControlSocketOptions } from "../../packages/control/src/server.js";

export interface InterfaceStartupOptions {
  socketEnabled: boolean;
  persistDir: string;
  instanceLabel: string;
  interfaceAgent: string;
  events: EventInterface;
  getStatus: () => Array<{
    agent: string;
    sessionId: string;
    status: string;
    kind?: string;
    task: string;
  }>;
  reportInfo: (message: string) => void;
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
        publishEvent: (input) =>
          options.events.publish(input, {
            source: "control-socket",
            inputSource: { kind: "human", id: "control-socket" },
          }),
        publishOperatorEvent: (input) =>
          options.events.publish(input, {
            source: "control-socket",
            inputSource: { kind: "human", id: "control-socket" },
            allowUnregisteredFact: true,
          }),
        getStatus: () =>
          options.getStatus().map((item) => ({
            agent: item.agent,
            sessionId: item.sessionId,
            status: item.status,
            kind: item.kind ?? "",
            task: item.task,
          })),
        reportInfo: options.reportInfo,
        admitAppInput: options.admitAppInput,
        getAppConversation: options.getAppConversation,
        listAppTasks: options.listAppTasks,
        getAppTask: options.getAppTask,
        resolveAppTask: options.resolveAppTask,
        listApps: options.listApps,
        listTasks: options.listTasks,
        getTask: options.getTask,
        describeProjectActions: options.describeProjectActions,
        invokeProjectAction: options.invokeProjectAction,
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
