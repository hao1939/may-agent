import { SubagentManager } from "../lib/index.js";
import type { AppInput } from "@may-agent/sdk";
import type { AttachControlSocketOptions } from "../../packages/control/src/server.js";
import { closeAllDbs, getDb } from "../lib/requests.js";
import type { AppArgs } from "./app-args.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { AppRegistry } from "./app-registry.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { attachCommandRouter } from "./command-router.js";
import { startCronRuntime } from "./cron-startup.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
  createDaemonLifecycle,
  prepareDaemonAgents,
  runDaemonKeepalive,
  runInteractiveLoop,
  startRequestedSession,
  type InstanceIdentity,
} from "./daemon.js";
import { EVENT_ROW_ID, EventBus } from "./event-bus.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import type { ModelRegistry } from "./model-registry.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
import { attachConsoleUI } from "./transport/console.js";
import { attachDaemonInfoLog } from "./transport/daemon-info-log.js";
import { attachTelegramBot } from "./transport/telegram.js";
import { installProjectApps, startProjectAppWatcher, type ProjectAppWatcher } from "./loader/project-app-loader.js";

export function createAppInputAdmission(options: {
  bus: Pick<EventBus, "emit">;
  getRuntime: () => AppInboxRuntime | null;
}): NonNullable<AttachControlSocketOptions["admitAppInput"]> {
  return (input) => {
    const appInput = input.input as unknown as AppInput;
    if (!options.getRuntime()?.host.acceptsInput(input.appId, appInput)) {
      throw new Error(`App ${input.appId} does not accept this input`);
    }
    const sourceKind = input.source.kind;
    const sourceId = input.source.id;
    if (
      (sourceKind !== "human" && sourceKind !== "app" && sourceKind !== "system") ||
      typeof sourceId !== "string" ||
      !sourceId.trim()
    ) {
      throw new Error("App input source requires kind human, app, or system and a non-empty id");
    }
    const emitted = options.bus.emit({
      type: "app.input.requested",
      source: "control-socket",
      owner: `app:${input.appId}`,
      data: {
        appId: input.appId,
        input: appInput,
        source: { kind: sourceKind, id: sourceId.trim() },
        conversationId: input.conversationId,
        conversationSequence: input.conversationSequence,
        channel: input.channel,
        channelThreadId: input.channelThreadId,
        channelMessageId: input.channelMessageId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    const eventId = Number(emitted[EVENT_ROW_ID]);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      throw new Error(`App input for ${input.appId} was not durably persisted`);
    }
    return { eventId, eventType: "app.input.requested" };
  };
}

export async function runAppRuntime(opts: {
  appArgs: AppArgs;
  models: ModelRegistry;
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  persistDir: string;
  instance: string;
  instanceLabel: string;
  processStartTime: number;
  writeIdentity: (data: Partial<InstanceIdentity>) => void;
}): Promise<void> {
  const {
    cronEnabled: CRON_ENABLED,
    telegramEnabled: TELEGRAM_ENABLED,
    consoleEnabled: CONSOLE_ENABLED,
    socketEnabled: SOCKET_ENABLED,
    webEnabled: WEB_ENABLED,
    chatMode: CHAT_MODE,
    initialTask: INITIAL_TASK,
    interfaceAgent,
    envSessionId: ENV_SESSION_ID,
    envParentSessionId: ENV_PARENT_SESSION_ID,
    envParentAgent: ENV_PARENT_AGENT,
  } = opts.appArgs;

  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir: opts.persistDir });

  // These closures are installed before startRequestedSession assigns both bindings below.
  // eslint-disable-next-line prefer-const
  let taskSessionId: string | undefined;
  // eslint-disable-next-line prefer-const
  let chatSession: Awaited<ReturnType<typeof startRequestedSession>>["chatSession"];
  const humanChatEnabled = TELEGRAM_ENABLED || WEB_ENABLED || SOCKET_ENABLED;

  if (CONSOLE_ENABLED) attachConsoleUI(bus, () => taskSessionId ?? chatSession?.getSessionId() ?? null, CHAT_MODE);
  else if (process.env.MAY_DAEMON_QUIET !== "1") attachDaemonInfoLog(bus);

  if (WEB_ENABLED) {
    const { port } = await startWebMode({ stateDir: opts.persistDir, port: parseWebPort(process.env.WEB_PORT) });
    bus.emit({ type: "info", message: `[web] Dashboard running on http://localhost:${port}` });
  }

  bus.emit({
    type: "info",
    message: `[may.ts] Starting (pid=${process.pid}, instance=${opts.instanceLabel}, root=${opts.projectRoot})`,
  });

  const manager = new SubagentManager({
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    bus,
  });

  let appInboxRuntime: AppInboxRuntime | null = null;
  const appRegistry = new AppRegistry(opts.projectsRoot);
  await appRegistry.reload();

  attachDaemonEventSubscribers({
    bus,
    manager,
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    interfaceAgent,
  });

  const { loaderOpts, projectAppOpts } = await prepareDaemonAgents({
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager,
    bus,
    cronEnabled: CRON_ENABLED,
    appRegistry,
  });

  const appTasks = createAppTaskCapability({
    bus,
    getDb: () => getDb(opts.persistDir),
  });

  appInboxRuntime = await startAppInboxRuntime({
    registry: appRegistry,
    db: getDb(opts.persistDir),
    manager,
    bus,
    runOwner: appTasks.runOwner,
    attachTask: appTasks.attach,
    readDependency: appTasks.readDependency,
  });
  if (appInboxRuntime.host.appIds().length > 0) {
    bus.emit({
      type: "info",
      message: `[app-inbox] Started for ${appInboxRuntime.host.appIds().join(", ")}`,
    });
  }

  let activeRL: { close: () => void } | null = null;
  let appWatcher: ProjectAppWatcher | null = null;
  let telegramBot: { close: () => void; sendAlert: (...args: any[]) => any } = { close: () => {}, sendAlert: () => {} };
  let cancelledOnce = false;

  const { gracefulShutdown, gracefulRestart, handleReload, installProcessHandlers } = createDaemonLifecycle({
    bus,
    manager,
    loaderOpts,
    closeAllDbs,
    writeIdentity: opts.writeIdentity,
    processStartTime: opts.processStartTime,
    getChatSession: () => chatSession,
    getTelegramBot: () => telegramBot,
    getActiveReadline: () => activeRL,
    clearActiveReadline: () => {
      activeRL = null;
    },
    beforeShutdown: () => {
      appWatcher?.close();
      appInboxRuntime?.close();
    },
    reloadApps: async () => {
      let projectApps = 0;
      let entries = 0;
      const appIds = await appInboxRuntime!.reload(async ({ snapshot, commit }) => {
        if (!projectAppOpts) {
          commit();
          return;
        }
        const result = await installProjectApps({
          ...projectAppOpts,
          appRegistrySnapshot: snapshot,
          afterCommit: () => commit(),
        });
        projectApps = result.installed.length;
        entries = result.entries;
      });
      return { appIds, projectApps, entries };
    },
  });
  if (projectAppOpts) {
    appWatcher = startProjectAppWatcher(projectAppOpts, {
      reload: () => handleReload({ throwOnError: true }),
    });
  }
  installProcessHandlers();

  const commandRouter = attachCommandRouter({
    bus,
    manager,
    clearCancelLatch: () => {
      cancelledOnce = false;
    },
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    acceptsAppInput: (appId, input) => appInboxRuntime?.host.acceptsInput(appId, input) ?? false,
    reload: handleReload,
    restart: gracefulRestart,
    shutdown: gracefulShutdown,
  });
  const handleInput = commandRouter.handleInput;

  if (!manager.hasAgent(interfaceAgent)) {
    console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
    process.exit(1);
  }

  // Attach the human-attention gate before opening any external ingress or
  // starting cron work. Otherwise an event accepted during startup can be
  // persisted and printed while completely missing Telegram admission.
  telegramBot = TELEGRAM_ENABLED
    ? attachTelegramBot({
        bus,
        manager,
        persistDir: opts.persistDir,
        projectRoot: opts.projectRoot,
        getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
        interfaceAgent,
      })
    : { close: () => {}, sendAlert: () => {} };

  const { socketPath: SOCKET_PATH, socketUI } = await startInterfaceRuntime({
    socketEnabled: SOCKET_ENABLED,
    persistDir: opts.persistDir,
    instanceLabel: opts.instanceLabel,
    interfaceAgent,
    bus,
    manager,
    getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
    admitAppInput: createAppInputAdmission({ bus, getRuntime: () => appInboxRuntime }),
  });
  // The inbox starts before ingress, but its outbox waits until every enabled
  // human transport is attached. This prevents a restart-time response from
  // being marked attempted before any channel can observe it.
  appInboxRuntime?.enableDelivery();

  function emitPrompt(): void {
    bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
    if (process.stdin.isTTY) {
      const prefix = opts.instance ? `[${opts.instance}] ` : "";
      process.stdout.write(`\n${prefix}you> `);
    }
  }

  await runRequestedExitMode({
    appArgs: opts.appArgs,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    bus,
    manager,
  });

  ({ taskSessionId, chatSession } = await startRequestedSession({
    bus,
    manager,
    persistDir: opts.persistDir,
    interfaceAgent,
    initialTask: INITIAL_TASK,
    chatMode: CHAT_MODE,
    humanChatEnabled,
    envSessionId: ENV_SESSION_ID,
    envParentSessionId: ENV_PARENT_SESSION_ID,
    envParentAgent: ENV_PARENT_AGENT,
    emitPrompt,
    handleReload,
    gracefulShutdown,
    gracefulRestart,
  }));

  opts.writeIdentity({
    pid: process.pid,
    agent: interfaceAgent,
    instance: opts.instanceLabel,
    socket: SOCKET_ENABLED ? SOCKET_PATH : "",
    startedAt: new Date().toISOString(),
    startedBy: CHAT_MODE
      ? "human"
      : opts.instance.startsWith("job-")
        ? "cron:" + opts.instance.replace("job-", "")
        : "task",
    task: INITIAL_TASK,
    status: "running",
    sessionId: taskSessionId,
  });

  if (CRON_ENABLED) {
    await startCronRuntime({
      manager,
      bus,
      loaderOpts,
      chatMode: Boolean(chatSession),
      chatSession,
    });
  }

  if (!CHAT_MODE && !CRON_ENABLED && !WEB_ENABLED && !SOCKET_ENABLED && !TELEGRAM_ENABLED) {
    bus.emit({ type: "info", message: "[task] Task completed. Exiting." });
    process.exit(0);
  } else if (process.stdin.isTTY) {
    await runInteractiveLoop({
      bus,
      manager,
      chatSession,
      handleInput,
      gracefulShutdown,
      socketUI,
      telegramBot,
      setActiveReadline: (rl) => {
        activeRL = rl;
      },
      isCancelLatched: () => cancelledOnce,
      latchCancel: () => {
        cancelledOnce = true;
      },
      emitPrompt,
    });
  } else {
    await runDaemonKeepalive({ bus, interfaceAgent, socketEnabled: SOCKET_ENABLED });
  }
}
