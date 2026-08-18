import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { SubagentManager } from "../lib/index.js";
import type { AppInput } from "@may-agent/sdk";
import type { AttachControlSocketOptions } from "../../packages/control/src/server.js";
import { closeAllDbs, getDb } from "../lib/requests.js";
import { createMetricService } from "../lib/metrics.js";
import type { AppArgs } from "./app-args.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { AppRegistry } from "./app-registry.js";
import { createRuntimeAppRead } from "./app-read.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { createAppAnalysisCapability } from "./app-analysis-capability.js";
import { readAppConversationResource } from "./app-inbox-store.js";
import { HostCapacity } from "./host-capacity.js";
import { attachCommandRouter } from "./command-router.js";
import { startCronRuntime } from "./cron-startup.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
  createDaemonLifecycle,
  prepareDaemonAgents,
  runDaemonKeepalive,
  runInteractiveLoop,
  startInitialTask,
  type InstanceIdentity,
} from "./daemon.js";
import { EventBus } from "./event-bus.js";
import { createEventInterface, type EventInterface } from "./event-interface.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import type { ModelRegistry } from "./model-registry.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
import { attachConsoleUI } from "./transport/console.js";
import { attachDaemonInfoLog } from "./transport/daemon-info-log.js";
import { attachTelegramBot } from "./transport/telegram.js";

export function createAppInputAdmission(options: {
  events: Pick<EventInterface, "publish">;
}): NonNullable<AttachControlSocketOptions["admitAppInput"]> {
  return (input) => {
    const sourceKind = input.source.kind;
    const sourceId = input.source.id;
    if (
      (sourceKind !== "human" && sourceKind !== "app" && sourceKind !== "system") ||
      typeof sourceId !== "string" ||
      !sourceId.trim()
    ) {
      throw new Error("App input source requires kind human, app, or system and a non-empty id");
    }
    return options.events.publish(
      {
        type: "app.input.requested",
        target: { appId: input.appId },
        idempotencyKey: input.idempotencyKey,
        data: {
          input: input.input as unknown as AppInput,
          conversationId: input.conversationId,
          conversationSequence: input.conversationSequence,
          channel: input.channel,
          channelTargetId: input.channelTargetId,
          channelThreadId: input.channelThreadId,
          channelMessageId: input.channelMessageId,
          replyToSourceId: input.replyToSourceId,
        },
      },
      {
        source: "control-socket",
        inputSource: { kind: sourceKind, id: sourceId.trim() },
      },
    );
  };
}

export function createProjectActionAccess(options: {
  getRuntime: () => AppInboxRuntime | null;
  admit: NonNullable<AttachControlSocketOptions["admitAppInput"]>;
}): {
  describe: NonNullable<AttachControlSocketOptions["describeProjectActions"]>;
  invoke: NonNullable<AttachControlSocketOptions["invokeProjectAction"]>;
} {
  return {
    describe(projectId) {
      const runtime = options.getRuntime();
      if (!runtime?.host.hasApp(projectId)) throw new Error(`App ${projectId} is not loaded`);
      return runtime.host.describeActions(projectId);
    },
    invoke(input) {
      const runtime = options.getRuntime();
      if (!runtime?.host.hasApp(input.projectId)) throw new Error(`App ${input.projectId} is not loaded`);
      const appId = input.projectId.trim().replace(/\.app$/, "");
      const appInput = runtime.host.actionInput(appId, input.actionId, input.params);
      const idempotencyKey = input.idempotencyKey?.trim() || `action:${appId}:${input.actionId}:${randomUUID()}`;
      return options.admit({
        appId,
        input: appInput as Record<string, unknown>,
        source: { kind: "human", id: "control-socket:project-action" },
        idempotencyKey,
      });
    },
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
    quietConsole: QUIET_CONSOLE,
    initialTask: INITIAL_TASK,
    interfaceAgent,
    envSessionId: ENV_SESSION_ID,
    envParentSessionId: ENV_PARENT_SESSION_ID,
    envParentAgent: ENV_PARENT_AGENT,
  } = opts.appArgs;

  const bus = new EventBus();
  const configuredHostConcurrency = Number(process.env.MAY_HOST_MAX_CONCURRENT ?? 4);
  const hostCapacity = new HostCapacity(
    Number.isInteger(configuredHostConcurrency) && configuredHostConcurrency > 0 ? configuredHostConcurrency : 4,
  );
  attachEventPersistence({ bus, persistDir: opts.persistDir });

  let taskSessionId: string | undefined;
  let activeRL: { close: () => void } | null = null;

  if (CONSOLE_ENABLED) {
    attachConsoleUI(
      bus,
      () => taskSessionId ?? null,
      QUIET_CONSOLE,
      () => {
        if (activeRL) emitPrompt();
      },
    );
  } else if (process.env.MAY_DAEMON_QUIET !== "1") attachDaemonInfoLog(bus);

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

  const { loaderOpts, appTaskOptions, claimedAppTaskSessionIds, startAppTaskControllers } = await prepareDaemonAgents({
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
    hostCapacity,
  });

  const appTasks = createAppTaskCapability({
    bus,
    getDb: () => getDb(opts.persistDir),
    runtime: appTaskOptions,
  });
  const appAnalysis = createAppAnalysisCapability({
    bus,
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
  });
  const observerMetrics = createMetricService({ getDb: () => getDb(opts.persistDir) });

  appInboxRuntime = await startAppInboxRuntime({
    registry: appRegistry,
    db: getDb(opts.persistDir),
    manager,
    bus,
    runOwner: (work, context) =>
      context.appId === "may" && context.humanOrigin ? hostCapacity.runForeground(work) : hostCapacity.run(work),
    attachTask: appTasks.attach,
    attachAnalysis: appAnalysis.attach,
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      appTasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    previewTaskEvent: ({ appId, event, targetedTaskId }) => appTasks.previewEvent({ appId, event, targetedTaskId }),
    readDependency: (input) =>
      input.dependency.kind === "analysis"
        ? Promise.resolve(appAnalysis.read(input.dependency.id))
        : appTasks.readDependency({
            appDir: input.appDir,
            dependency: { kind: input.dependency.kind, id: input.dependency.id },
          }),
    observerContext: (appId, appDir) => {
      const definition = appRegistry.snapshot().entries.find((entry) => entry.definition.id === appId)?.definition;
      const projectDir = definition?.workspace?.localPath ? resolve(appDir, definition.workspace.localPath) : appDir;
      const log = (level: string, message: string) =>
        bus.emit({ type: "info", message: `[app:${appId}:observer:${level}] ${message}` });
      return {
        read: createRuntimeAppRead({
          getDb: () => getDb(opts.persistDir),
          metrics: observerMetrics,
          executionPaths: { appDir, projectDir },
        }),
        workspace: { appRoot: appDir, projectRoot: projectDir },
        log: {
          debug: (message) => log("debug", message),
          info: (message) => log("info", message),
          warn: (message) => log("warn", message),
          error: (message) => log("error", message),
        },
      };
    },
  });
  if (appInboxRuntime.host.appIds().length > 0) {
    bus.emit({
      type: "info",
      message: `[app-inbox] Started for ${appInboxRuntime.host.appIds().join(", ")}`,
    });
  }

  let appWatcher: { close(): void } | null = null;
  let telegramBot: { close: () => void; sendAlert: (...args: any[]) => any } = { close: () => {}, sendAlert: () => {} };
  let cancelledOnce = false;

  const { gracefulShutdown, gracefulRestart, handleReload, installProcessHandlers } = createDaemonLifecycle({
    bus,
    manager,
    loaderOpts,
    closeAllDbs,
    writeIdentity: opts.writeIdentity,
    processStartTime: opts.processStartTime,
    getTelegramBot: () => telegramBot,
    getActiveReadline: () => activeRL,
    clearActiveReadline: () => {
      activeRL = null;
    },
    beforeShutdown: () => {
      appWatcher?.close();
      void appTasks.close();
      appInboxRuntime?.close();
    },
    reloadApps: async () => {
      let taskApps = 0;
      const appIds = await appInboxRuntime!.reload(async ({ snapshot, commit }) => {
        const result = await appTasks.publishGeneration({ snapshot, publish: commit });
        taskApps = result.apps;
      });
      return { appIds, taskApps };
    },
  });
  if (appTaskOptions) {
    appWatcher = appTasks.watchGenerations(() => handleReload({ throwOnError: true }));
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
        interfaceAgent,
      })
    : { close: () => {}, sendAlert: () => {} };

  const events = createEventInterface({
    bus,
    db: getDb(opts.persistDir),
    acceptsAppInput: (appId, input) => appInboxRuntime?.host.acceptsInput(appId, input) ?? false,
    hasApp: (appId) => appInboxRuntime?.host.hasApp(appId) ?? false,
    hasAgent: (agent) => manager.hasAgent(agent),
    hasSession: (sessionId) =>
      manager.getSessionSummary(sessionId).status !== "unknown" ||
      Boolean(getDb(opts.persistDir).prepare("SELECT 1 FROM sessions WHERE sessionId = ? LIMIT 1").get(sessionId)),
  });
  appInboxRuntime.setEventPublisher((input, source) =>
    events.publish(input, {
      source: `app:${source.id}`,
      inputSource: source,
    }),
  );
  const admitAppInput = createAppInputAdmission({ events });
  const projectActions = createProjectActionAccess({
    getRuntime: () => appInboxRuntime,
    admit: admitAppInput,
  });
  const { socketPath: SOCKET_PATH, socketUI } = await startInterfaceRuntime({
    socketEnabled: SOCKET_ENABLED,
    persistDir: opts.persistDir,
    instanceLabel: opts.instanceLabel,
    interfaceAgent,
    events,
    getStatus: () => manager.status(),
    reportInfo: (message) => bus.emit({ type: "info", message }),
    admitAppInput,
    getAppConversation: (appId, conversationId, options) =>
      readAppConversationResource(getDb(opts.persistDir), appId, conversationId, options),
    describeProjectActions: projectActions.describe,
    invokeProjectAction: projectActions.invoke,
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

  taskSessionId = await startInitialTask({
    bus,
    manager,
    interfaceAgent,
    initialTask: INITIAL_TASK,
    interactiveMode: CONSOLE_ENABLED,
    envSessionId: ENV_SESSION_ID,
    envParentSessionId: ENV_PARENT_SESSION_ID,
    envParentAgent: ENV_PARENT_AGENT,
  });

  opts.writeIdentity({
    pid: process.pid,
    agent: interfaceAgent,
    instance: opts.instanceLabel,
    socket: SOCKET_ENABLED ? SOCKET_PATH : "",
    startedAt: new Date().toISOString(),
    startedBy: CONSOLE_ENABLED
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
      claimedAppTaskSessionIds,
    });
    // App work is asynchronous, but it must not compete with state recovery,
    // session fencing, or opening the human interfaces during daemon startup.
    startAppTaskControllers();
  }

  if (!CONSOLE_ENABLED && !CRON_ENABLED && !WEB_ENABLED && !SOCKET_ENABLED && !TELEGRAM_ENABLED) {
    bus.emit({ type: "info", message: "[task] Task completed. Exiting." });
    process.exit(0);
  } else if (CONSOLE_ENABLED && process.stdin.isTTY) {
    await runInteractiveLoop({
      bus,
      manager,
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
