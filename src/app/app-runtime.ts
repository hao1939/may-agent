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
import { EVENT_INGRESS_SOURCE, EVENT_ROW_ID, EventBus, type AgentEvent } from "./event-bus.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import type { ModelRegistry } from "./model-registry.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
import { attachConsoleUI } from "./transport/console.js";
import { attachDaemonInfoLog } from "./transport/daemon-info-log.js";
import { attachTelegramBot } from "./transport/telegram.js";

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

export function createProjectActionAccess(options: {
  bus: Pick<EventBus, "emit">;
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

      // A staged legacy ProjectApp action already declares its semantic event.
      // Preserve that declaration at the typed-action boundary instead of
      // turning it into an owner-facing App inbox narrative.
      if (appInput.kind === "legacy-action") {
        const payload = appInput.data as Record<string, unknown>;
        const declared = payload.event;
        if (!declared || typeof declared !== "object" || Array.isArray(declared)) {
          throw new Error(`Legacy action ${appId}.${input.actionId} did not declare an event`);
        }
        const semanticRecord = { ...(declared as Record<string, unknown>) };
        const eventType = semanticRecord.type;
        if (typeof eventType !== "string" || !eventType.trim()) {
          throw new Error(`Legacy action ${appId}.${input.actionId} declared an event without a type`);
        }
        semanticRecord.source = `project-app:${appId}:action:${input.actionId}`;
        semanticRecord.owner = `agent:${runtime.host.appOwner(appId)}`;
        const data =
          semanticRecord.data && typeof semanticRecord.data === "object" && !Array.isArray(semanticRecord.data)
            ? (semanticRecord.data as Record<string, unknown>)
            : {};
        const declaredParams =
          semanticRecord.params && typeof semanticRecord.params === "object" && !Array.isArray(semanticRecord.params)
            ? (semanticRecord.params as Record<string, unknown>)
            : {};
        const declaredDetails = Object.fromEntries(
          Object.entries(semanticRecord).filter(
            ([key]) => !["type", "source", "owner", "data", "params"].includes(key),
          ),
        );
        semanticRecord.data = {
          ...declaredDetails,
          ...declaredParams,
          ...data,
          project: typeof semanticRecord.project === "string" ? semanticRecord.project : appId,
          idempotencyKey,
        };
        Object.defineProperty(semanticRecord, EVENT_INGRESS_SOURCE, {
          value: "control-socket",
          configurable: true,
        });
        const emitted = options.bus.emit(semanticRecord as AgentEvent);
        const eventId = Number(emitted[EVENT_ROW_ID]);
        if (!Number.isSafeInteger(eventId) || eventId <= 0) {
          throw new Error(`Action ${appId}.${input.actionId} did not produce a persisted semantic event`);
        }
        return { eventId, eventType };
      }

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

  const { loaderOpts, appTaskOptions } = await prepareDaemonAgents({
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
    runtime: appTaskOptions,
  });
  const observerMetrics = createMetricService({ getDb: () => getDb(opts.persistDir) });
  const legacyAppMetricId = "may-agent.migration.legacy-app-count";
  observerMetrics.define({
    id: legacyAppMetricId,
    name: "Loaded legacy Agent App declarations",
    owner: "may-agent",
    project: "may-agent",
    type: "gauge",
    target: 0,
    unit: "apps",
    priority: "P1",
    source: "AppRegistry compatibility provenance",
    description: "Transition-only count; Release C requires zero across the canonical Apps canary window.",
  });
  const recordLegacyAppCount = () =>
    observerMetrics.record(
      legacyAppMetricId,
      appRegistry.snapshot().entries.filter((entry) => entry.compatibility === "legacy-project-app").length,
      { measuredBy: "app-registry" },
    );
  recordLegacyAppCount();

  appInboxRuntime = await startAppInboxRuntime({
    registry: appRegistry,
    db: getDb(opts.persistDir),
    manager,
    bus,
    runOwner: appTasks.runOwner,
    attachTask: appTasks.attach,
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      appTasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    previewTaskEvent: ({ appId, event, targetedTaskId }) => appTasks.previewEvent({ appId, event, targetedTaskId }),
    readDependency: appTasks.readDependency,
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

  let activeRL: { close: () => void } | null = null;
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
    getChatSession: () => chatSession,
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
      recordLegacyAppCount();
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
        getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
        interfaceAgent,
      })
    : { close: () => {}, sendAlert: () => {} };

  const admitAppInput = createAppInputAdmission({ bus, getRuntime: () => appInboxRuntime });
  const projectActions = createProjectActionAccess({
    bus,
    getRuntime: () => appInboxRuntime,
    admit: admitAppInput,
  });
  const { socketPath: SOCKET_PATH, socketUI } = await startInterfaceRuntime({
    socketEnabled: SOCKET_ENABLED,
    persistDir: opts.persistDir,
    instanceLabel: opts.instanceLabel,
    interfaceAgent,
    bus,
    manager,
    getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
    admitAppInput,
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
