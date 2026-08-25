import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { SubagentManager } from "../lib/index.js";
import type { AppEvent, AppInput } from "@may-agent/sdk";
import type { TaskListOptions } from "@may-agent/sdk";
import type { AttachControlSocketOptions } from "../../packages/control/src/server.js";
import { closeAllDbs, getDb } from "../lib/requests.js";
import { createMetricService } from "../lib/metrics.js";
import type { AppArgs } from "./app-args.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { AppRegistry } from "./app-registry.js";
import { DefinitionSourceReleaseStore, type DefinitionSourceRelease } from "./app-source-release.js";
import { createRuntimeAppRead } from "./app-read.js";
import { createAppTaskCapability } from "./app-task-capability.js";
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
import { EventBus, type AgentEvent } from "./event-bus.js";
import { createEventInterface, type EventInterface } from "./event-interface.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import type { ModelRegistry } from "./model-registry.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
import { attachConsoleUI } from "./transport/console.js";
import { attachDaemonInfoLog } from "./transport/daemon-info-log.js";
import { attachTelegramBot } from "./transport/telegram.js";
import { HumanTaskService } from "./human-task-service.js";
import { prepareAgentGeneration } from "./agent-loader.js";

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
          ...(input.targetTaskId ? { targetTaskId: input.targetTaskId } : {}),
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
      const actionInput = runtime.host.invokeAction(appId, input.actionId, input.params);
      const idempotencyKey = input.idempotencyKey?.trim() || `action:${appId}:${input.actionId}:${randomUUID()}`;
      return options.admit({
        appId,
        input: actionInput as Record<string, unknown>,
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
  const startupStartedAt = performance.now();
  let priorStartupPhaseAt = startupStartedAt;
  const startupPhases: string[] = [];
  const markStartupPhase = (name: string): void => {
    const now = performance.now();
    startupPhases.push(`${name}=${Math.round(now - priorStartupPhaseAt)}ms`);
    priorStartupPhaseAt = now;
  };
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
  const interactiveConsole = CONSOLE_ENABLED && process.stdin.isTTY;

  const bus = new EventBus();
  const configuredHostConcurrency = Number(process.env.MAY_HOST_MAX_CONCURRENT ?? 4);
  const hostCapacity = new HostCapacity(
    Number.isInteger(configuredHostConcurrency) && configuredHostConcurrency > 0 ? configuredHostConcurrency : 4,
  );
  attachEventPersistence({ bus, persistDir: opts.persistDir });
  markStartupPhase("database");

  let taskSessionId: string | undefined;
  let activeRL: { close: () => void } | null = null;

  if (interactiveConsole) {
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
  const appSources = new DefinitionSourceReleaseStore(opts.projectRoot, opts.persistDir);
  const activeAppSource = appSources.ensureCurrent();
  const appRegistry = new AppRegistry(activeAppSource.projectsRoot, opts.projectsRoot);
  await appRegistry.reload();
  markStartupPhase("apps");
  bus.emit({
    type: "info",
    message: `[apps] Active source ${activeAppSource.sourceCommit ?? activeAppSource.id}`,
  });
  const humanTasks = new HumanTaskService(getDb(opts.persistDir), appRegistry, {
    onCancelled: ({ appId, taskId, sessionId, reason }) => {
      if (sessionId && manager.hasActiveSession(sessionId)) manager.cancel(sessionId);
      bus.emit({
        type: "app.task.cancelled",
        source: "human-task-service",
        owner: "human:operator",
        target: { appId, taskId },
        data: { appId, taskId, reason },
      } as unknown as AgentEvent);
      bus.emit({
        type: "app.dependency.updated",
        source: "human-task-service",
        owner: "human:operator",
        data: { kind: "task", id: taskId, appId },
      });
    },
  });

  attachDaemonEventSubscribers({
    bus,
    manager,
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    interfaceAgent,
  });
  markStartupPhase("recovery");

  const { loaderOpts, appTaskOptions, startAppTaskControllers } = await prepareDaemonAgents({
    agentsRoot: activeAppSource.agentsRoot,
    sharedRoot: opts.sharedRoot,
    definitionSharedRoot: activeAppSource.sharedRoot,
    projectsRoot: activeAppSource.projectsRoot,
    stateProjectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager,
    bus,
    cronEnabled: CRON_ENABLED,
    appRegistry,
    hostCapacity,
  });
  markStartupPhase("agents-and-tasks");

  const appTasks = createAppTaskCapability({
    bus,
    runtime: appTaskOptions,
  });
  const observerMetrics = createMetricService({ getDb: () => getDb(opts.persistDir) });

  appInboxRuntime = await startAppInboxRuntime({
    registry: appRegistry,
    db: getDb(opts.persistDir),
    bus,
    persistDir: opts.persistDir,
    maxConcurrentRequests: configuredHostConcurrency,
    attachTask: appTasks.attach,
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      appTasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    previewTaskEvent: ({ appId, event, targetedTaskId }) => appTasks.previewEvent({ appId, event, targetedTaskId }),
    previewTaskEventRoutes: ({ event }) => appTasks.previewEventRoutes({ event }),
    readDependency: (input) =>
      appTasks.readDependency({
        appDir: input.appDir,
        dependency: input.dependency,
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
    // Durable routes are installed now, but recovered work waits until the
    // control socket and other human interfaces are available.
    deferStart: true,
  });
  markStartupPhase("inbox");
  if (appInboxRuntime.host.appIds().length > 0) {
    bus.emit({
      type: "info",
      message: `[app-inbox] Started for ${appInboxRuntime.host.appIds().join(", ")}`,
    });
  }

  let telegramBot: { close: () => void } = { close: () => {} };
  let cancelledOnce = false;
  let stagedReloadSource: {
    candidate: DefinitionSourceRelease;
    previous: DefinitionSourceRelease | null;
  } | null = null;

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
      void appTasks.close();
      appInboxRuntime?.close();
    },
    prepareAgents: async () => {
      const candidate = appSources.stage();
      stagedReloadSource = { candidate, previous: appSources.current() };
      return prepareAgentGeneration({
        ...loaderOpts,
        agentsRoot: candidate.agentsRoot,
        projectsRoot: candidate.projectsRoot,
        definitionSharedRoot: candidate.sharedRoot,
      });
    },
    reloadApps: async ({ publishAgents }) => {
      const source = stagedReloadSource;
      if (!source) throw new Error("Runtime generation has no staged definition source");
      const { candidate, previous } = source;
      let taskApps = 0;
      try {
        const appIds = await appInboxRuntime!.reload(async ({ snapshot, commit }) => {
          const result = await appTasks.publishGeneration({
            snapshot,
            definitionSource: {
              projectsRoot: candidate.projectsRoot,
              agentsRoot: candidate.agentsRoot,
              sharedRoot: candidate.sharedRoot,
            },
            publish: () => {
              appSources.activate(candidate);
              try {
                publishAgents();
                commit();
              } catch (error) {
                if (previous) appSources.activate(previous);
                throw error;
              }
            },
          });
          taskApps = result.apps;
        }, candidate.projectsRoot);
        return { appIds, taskApps };
      } catch (error) {
        if (previous && appSources.current()?.id === candidate.id && previous.id !== candidate.id) {
          appSources.activate(previous);
        }
        throw error;
      } finally {
        stagedReloadSource = null;
      }
    },
  });
  installProcessHandlers();

  const commandRouter = attachCommandRouter({
    bus,
    manager,
    projectRoot: opts.projectRoot,
    reload: handleReload,
    restart: gracefulRestart,
    shutdown: gracefulShutdown,
  });
  const handleInput = commandRouter.handleInput;

  if (!manager.hasAgent(interfaceAgent)) {
    console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
    process.exit(1);
  }

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

  // Open the Conversation adapter before external ingress or cron work so it
  // can observe every later shared Conversation update. Its writes use the
  // same semantic event boundary as Console and HTTP.
  telegramBot = TELEGRAM_ENABLED
    ? attachTelegramBot({
        bus,
        persistDir: opts.persistDir,
        interfaceAgent,
        humanTasks,
        publishEvent: (input) =>
          events.publish(input, {
            source: "telegram",
            inputSource: { kind: "human", id: "telegram" },
          }),
      })
    : { close: () => {} };
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
    listAppTasks: (appId, options) => {
      return appTasks.list({
        appId,
        options: {
          ...(options?.status ? { status: options.status as TaskListOptions["status"] } : {}),
          ...(options?.limit === undefined ? {} : { limit: options.limit }),
          ...(options?.cursor ? { cursor: options.cursor } : {}),
        },
      });
    },
    getAppTask: (appId, taskId) => appTasks.get({ appId, taskId }),
    resolveAppTask: (appId, event) =>
      appRegistry.resolveInstalledTask(appId.trim().replace(/\.app$/, ""), event as AppEvent<Record<string, unknown>>),
    listApps: (appId) => humanTasks.listApps(appId),
    listTasks: (options) => humanTasks.listTasks(options as Parameters<HumanTaskService["listTasks"]>[0]),
    getTask: (input) => humanTasks.getTask(input),
    cancelTask: (input) => humanTasks.cancelTask(input),
    describeProjectActions: projectActions.describe,
    invokeProjectAction: projectActions.invoke,
  });
  markStartupPhase("interfaces");
  bus.emit({
    type: "info",
    message: `[startup] Ready in ${Math.round(performance.now() - startupStartedAt)}ms (${startupPhases.join(", ")})`,
  });
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
    interactiveMode: interactiveConsole,
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
    startedBy: interactiveConsole
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
    });
  }
  await appInboxRuntime.start();
  if (CRON_ENABLED) {
    // App work is asynchronous, but it must not compete with state recovery,
    // session fencing, or opening the human interfaces during daemon startup.
    startAppTaskControllers();
  }

  if (!interactiveConsole && !CRON_ENABLED && !WEB_ENABLED && !SOCKET_ENABLED && !TELEGRAM_ENABLED) {
    bus.emit({ type: "info", message: "[task] Task completed. Exiting." });
    process.exit(0);
  } else if (interactiveConsole) {
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
