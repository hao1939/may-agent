import type { AttachControlSocketOptions } from "@may-agent/control/server";
import type { AppInput, TaskListOptions } from "@may-agent/sdk";
import { randomUUID } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { closeAllDbs, getDb } from "../lib/db/connection.js";
import { SubagentManager } from "../lib/index.js";
import { discoverAppDefinitions, listAppDefinitionFiles } from "./adapters/discovery/app-definitions.js";
import { prepareAgentGeneration, publishPreparedAgentGeneration } from "./agent-loader.js";
import type { AppArgs } from "./app-args.js";
import { DefinitionSourceReleaseStore, type DefinitionSourceRelease } from "./app-source-release.js";
import { attachCommandRouter, validateSessionControl } from "./command-router.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./composition/app-inbox-runtime.js";
import { runsBackgroundWork, startBackgroundRuntime } from "./composition/background-startup.js";
import type { AppReporting } from "./composition/reporting.js";
import { createTaskAdmissionProcess } from "./composition/workers/task-admission-process.js";
import {
  createTaskAttemptProcessExecutor,
  createTaskRecoveryProcessExecutor,
} from "./composition/workers/task-attempt-process.js";
import { AppRegistry } from "./core/apps/registry.js";
import { EventBus } from "./core/events/bus.js";
import { createEventInterface, type EventInterface } from "./core/events/interface.js";
import { createRuntimeAppRead } from "./core/reads/app-read.js";
import { readExecutionStatus } from "./core/reads/execution-status.js";
import { HostCapacity } from "./core/scheduling/host-capacity.js";
import { readAppConversationResource } from "./core/state/conversations.js";
import { createAppTaskCapability } from "./core/tasks/app-task-capability.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
  createDaemonLifecycle,
  prepareDaemonAgents,
  runDaemonKeepalive,
  runInteractiveLoop,
  type InstanceIdentity,
} from "./daemon.js";
import { HumanTaskService } from "./human-task-service.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import type { ModelRegistry } from "./model-registry.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
import { attachTaskControlEventRoute } from "./task-control-events.js";
import { attachConsoleUI } from "./transport/console.js";
import { attachDaemonInfoLog } from "./transport/daemon-info-log.js";
import { attachTelegramBot } from "./transport/telegram.js";

export type AppInputAdmission = (input: {
  appId: string;
  targetTaskId?: string;
  input: Record<string, unknown>;
  source: Record<string, unknown>;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  idempotencyKey: string;
}) => {
  eventId: number;
  eventType: string;
};

export function createAppInputAdmission(options: {
  events: Pick<EventInterface, "publish">;
}): AppInputAdmission {
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
  admit: AppInputAdmission;
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
  reporting?: AppReporting;
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
    humanInterface,
  } = opts.appArgs;
  const interfaceAgent = humanInterface.agent;
  const interactiveConsole = CONSOLE_ENABLED && process.stdin.isTTY;
  const backgroundEnabled = runsBackgroundWork(opts.appArgs, Boolean(interactiveConsole));

  const bus = new EventBus();
  const requestedHostConcurrency = Number(process.env.MAY_HOST_MAX_CONCURRENT ?? 4);
  const configuredHostConcurrency =
    Number.isInteger(requestedHostConcurrency) && requestedHostConcurrency > 0 ? requestedHostConcurrency : 4;
  const hostCapacity = new HostCapacity(configuredHostConcurrency);
  attachEventPersistence({ bus, persistDir: opts.persistDir });
  markStartupPhase("database");

  let activeRL: { close: () => void } | null = null;

  if (interactiveConsole) {
    attachConsoleUI(
      bus,
      () => null,
      QUIET_CONSOLE,
      () => {
        if (activeRL) emitPrompt();
      },
    );
  } else if (process.env.MAY_DAEMON_QUIET !== "1") attachDaemonInfoLog(bus);

  if (WEB_ENABLED) {
    const { port } = await startWebMode({ interface: humanInterface, stateDir: opts.persistDir, port: parseWebPort(process.env.WEB_PORT) });
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
  const activeAppDirectories = listAppDefinitionFiles(activeAppSource.projectsRoot, opts.projectsRoot).map((file) =>
    basename(dirname(file)),
  );
  const appRegistry = new AppRegistry(
    discoverAppDefinitions(activeAppSource.projectsRoot, opts.projectsRoot, {}, activeAppDirectories),
  );
  await appRegistry.reload();
  // Registry publication can await recovery after the source link has moved.
  // Workers must capture one accepted pair, never combine those two clocks.
  let acceptedWorkerSource = { ...activeAppSource, appDirectories: activeAppDirectories };
  const workerDefinitionSource = () => acceptedWorkerSource;
  markStartupPhase("apps");
  bus.emit({
    type: "info",
    message: `[apps] Active source ${activeAppSource.sourceCommit ?? activeAppSource.id}`,
  });
  const humanTasks = new HumanTaskService(
    getDb(opts.persistDir),
    appRegistry,
    (appId) => appInboxRuntime?.observerHealth(appId) ?? [],
  );

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
    canonicalProjectsRoot: opts.projectsRoot,
    appDirectories: activeAppDirectories,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager,
    bus,
    taskRuntimeMode: backgroundEnabled ? "controllers" : "none",
    appRegistry,
    readOutcomes: opts.reporting?.readOutcomes,
    hostCapacity,
    executeTaskAttempt: createTaskAttemptProcessExecutor({ bus, definitionSource: workerDefinitionSource }),
    executeTaskRecovery: createTaskRecoveryProcessExecutor({ bus, definitionSource: workerDefinitionSource }),
  });
  markStartupPhase("agents-and-tasks");

  const appTasks = createAppTaskCapability({
    bus,
    runtime: appTaskOptions,
  });
  attachTaskControlEventRoute(bus, {
    retryTask: ({ appId, taskId, generation, resourceVersion, controlKey }) =>
      appTasks.retry({
        appId,
        taskId,
        expectedGeneration: generation,
        expectedResourceVersion: resourceVersion,
        controlKey,
      }),
    cancelTask: ({ appId, taskId, generation, resourceVersion, reason, decision, controlKey }) =>
      appTasks.cancel({
        appId,
        taskId,
        reason,
        decision,
        expectedGeneration: generation,
        expectedResourceVersion: resourceVersion,
        controlKey,
      }),
    reopenTask: ({ generation, resourceVersion, ...input }) => appTasks.reopen({
      ...input, expectedGeneration: generation, expectedResourceVersion: resourceVersion,
    }),
    closeTask: ({ appId, taskId, generation, resourceVersion, afterResult, reason, controlKey }) =>
      appTasks.closeAfterResult({
        appId,
        taskId,
        afterResult,
        reason,
        expectedGeneration: generation,
        expectedResourceVersion: resourceVersion,
        controlKey,
      }),
  });
  const conversationAppId = humanInterface.appId;
  const events = createEventInterface({
    conversationAgent: interfaceAgent,
    bus,
    db: getDb(opts.persistDir),
    conversationAppId,
    validateAppInput: (appId, input) => {
      if (!appInboxRuntime) throw new Error("App input admission is unavailable");
      appInboxRuntime.host.assertAcceptsInput(appId, input);
    },
    hasApp: (appId) =>
      appRegistry.snapshot().entries.some((entry) => entry.definition.id === appId.trim().replace(/\.app$/, "")),
    hasAgent: (agent) => manager.hasAgent(agent),
    validateSessionControl: (type, sessionId) => validateSessionControl(manager, type, sessionId),
    hasSession: (sessionId) =>
      manager.getSessionSummary(sessionId).status !== "unknown" ||
      Boolean(getDb(opts.persistDir).prepare("SELECT 1 FROM sessions WHERE sessionId = ? LIMIT 1").get(sessionId)),
  });
  // Reporting observes the committed generation; it cannot reject publication.
  const refreshReporting = () => {
    if (!opts.reporting) return;
    setImmediate(() => {
      try {
        opts.reporting!.syncDefinitions(appRegistry.snapshot().entries);
      } catch (error) {
        console.error(`[reporting] Metric definitions unavailable: ${String(error)}`);
      }
    });
  };
  refreshReporting();

  appInboxRuntime = await startAppInboxRuntime({
    registry: appRegistry,
    db: getDb(opts.persistDir),
    bus,
    persistDir: opts.persistDir,
    schedulesEnabled: backgroundEnabled && CRON_ENABLED,
    attachTask: appTasks.attach,
    admitConversation: appTasks.admitConversation,
    admitConversationChange: appTasks.admitConversationChange,
    stopConversationTurn: appTasks.stopTurn,
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      appTasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    createTaskAdmissionWorker: () =>
      createTaskAdmissionProcess({ definitionSource: workerDefinitionSource() ?? undefined }),
    wakeAdmittedTasks: appTasks.wake,
    hasTaskTarget: ({ appId, taskId }) => appTasks.has({ appId, taskId }),
    previewTaskEvent: ({ appId, event, targetedTaskId }) => appTasks.previewEvent({ appId, event, targetedTaskId }),
    previewTaskEventRoutes: ({ event }) => appTasks.previewEventRoutes({ event }),
    readDependency: (input) =>
      appTasks.readDependency({
        appId: input.appId,
        appDir: input.appDir,
        dependency: input.dependency,
        admissionKey: input.admissionKey,
      }),
    observerContext: (appId, appDir) => {
      const definition = appRegistry.snapshot().entries.find((entry) => entry.definition.id === appId)?.definition;
      const projectDir = definition?.workspace?.localPath ? resolve(appDir, definition.workspace.localPath) : appDir;
      const log = (level: string, message: string) =>
        bus.emit({ type: "info", message: `[app:${appId}:observer:${level}] ${message}` });
      return {
        read: createRuntimeAppRead({
          readContract: async (targetAppId) => appTasks.contract(targetAppId),
          getDb: () => getDb(opts.persistDir),
          readMetric: opts.reporting?.readMetric,
          taskRead: {
            workload: async (options) => appTasks.workload({ appId, options }),
            list: async (options) => appTasks.list({ appId, ...(options ? { options } : {}) }),
            outcomes: async (projection) => appTasks.outcomes({ appId, ...(projection ? { projection } : {}) }),
            get: async (taskId, options) => appTasks.get({ appId, taskId, options }),
          },
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
  const preparedSources = new WeakMap<
    Awaited<ReturnType<typeof prepareAgentGeneration>>,
    DefinitionSourceRelease & { appDirectories: string[] }
  >();

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
    prepareAgents: async (_loaderOpts, reloadOptions) => {
      const source = appSources.stage(reloadOptions.expectedSourceCommit);
      const candidate = {
        ...source,
        appDirectories: listAppDefinitionFiles(source.projectsRoot, opts.projectsRoot).map((file) =>
          basename(dirname(file)),
        ),
      };
      const generation = await prepareAgentGeneration({
        ...loaderOpts,
        agentsRoot: candidate.agentsRoot,
        projectsRoot: candidate.projectsRoot,
        definitionSharedRoot: candidate.sharedRoot,
        appDirectories: candidate.appDirectories,
      });
      preparedSources.set(generation, candidate);
      return generation;
    },
    publishAgents: publishPreparedAgentGeneration,
    reloadApps: async ({ agents, publishAgents }) => {
      const candidate = preparedSources.get(agents);
      if (!candidate) throw new Error("Runtime generation has no staged definition source");
      preparedSources.delete(agents);
      let taskApps = 0;
      const appIds = await appInboxRuntime!.reload(
        async ({ snapshot, commit }) => {
          // Capture and restore while holding the registry transaction. A queued
          // reload must restore its committed predecessor, not its staging source.
          const previous = acceptedWorkerSource;
          try {
            const result = await appTasks.publishGeneration({
              snapshot,
              definitionSource: {
                projectsRoot: candidate.projectsRoot,
                agentsRoot: candidate.agentsRoot,
                sharedRoot: candidate.sharedRoot,
              },
              publish: () => {
                appSources.activate(candidate);
                acceptedWorkerSource = candidate;
                try {
                  publishAgents();
                  commit();
                } catch (error) {
                  // Restore before Task rollback yields to other worker dispatch.
                  acceptedWorkerSource = previous;
                  appSources.activate(previous);
                  throw error;
                }
              },
            });
            taskApps = result.apps;
          } catch (error) {
            acceptedWorkerSource = previous;
            if (appSources.current()?.id === candidate.id && previous.id !== candidate.id) {
              appSources.activate(previous);
            }
            throw error;
          }
        },
        discoverAppDefinitions(candidate.projectsRoot, opts.projectsRoot, {}, candidate.appDirectories),
      );
      refreshReporting();
      return {
        appIds,
        taskApps,
        ...(candidate.sourceCommit ? { sourceCommit: candidate.sourceCommit } : {}),
      };
    },
  });
  installProcessHandlers();

  const commandRouter = attachCommandRouter({
    interfaceAgent,
    conversationAppId,
    conversationId: humanInterface.conversationId,
    bus,
    manager,
    projectRoot: opts.projectRoot,
    reload: handleReload,
    restart: gracefulRestart,
    shutdown: gracefulShutdown,
  });
  const handleInput = commandRouter.handleInput;

  if (interactiveConsole && !manager.hasAgent(interfaceAgent)) {
    console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
    process.exit(1);
  }

  // Open the Conversation adapter before external ingress or cron work so it
  // can observe every later shared Conversation update. Its writes use the
  // same semantic event boundary as Console and HTTP.
  telegramBot = TELEGRAM_ENABLED
    ? attachTelegramBot({
        bus,
        persistDir: opts.persistDir,
        interfaceAgent,
        conversationAppId,
        conversationId: humanInterface.conversationId,
        getAppConversation: (appId, conversationId, options) =>
          readAppConversationResource(getDb(opts.persistDir), appId, conversationId, options),
        humanTasks: {
          getTask: (input) => humanTasks.getTask(input),
          listApps: (appId) => humanTasks.listApps(appId),
          listTasks: (options) => humanTasks.listTasks(options),
        },
        publishEvent: (input, approvalAuthorization) =>
          events.publish(input, {
            source: "telegram",
            inputSource: { kind: "human", id: "telegram" },
            ...(approvalAuthorization ? { approvalAuthorization } : {}),
          }),
      })
    : { close: () => {} };
  const admitAppInput = createAppInputAdmission({ events });
  const projectActions = createProjectActionAccess({
    getRuntime: () => appInboxRuntime,
    admit: admitAppInput,
  });
  const { socketPath: SOCKET_PATH, socketUI } = await startInterfaceRuntime({
    conversationAppId,
    socketEnabled: SOCKET_ENABLED,
    persistDir: opts.persistDir,
    instanceLabel: opts.instanceLabel,
    interfaceAgent,
    events,
    getStatus: () => readExecutionStatus(opts.persistDir),
    reportInfo: (message) => bus.emit({ type: "info", message }),
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
    getAppTaskWorkload: (appId, options) => appTasks.workload({ appId, options }),
    getAppTask: (appId, taskId, options) => appTasks.get({ appId, taskId, options }),
    listApps: (appId) => humanTasks.listApps(appId),
    listTasks: (options) => humanTasks.listTasks(options as Parameters<HumanTaskService["listTasks"]>[0]),
    getTask: (input) => humanTasks.getTask(input),
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
  });

  if (backgroundEnabled) {
    await appInboxRuntime.start();
    startBackgroundRuntime({
      manager,
      bus,
      persistDir: loaderOpts.persistDir,
      onTaskRecoverySettled: startAppTaskControllers,
    });
  }

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
    task: null,
    status: "running",
  });

  if (interactiveConsole) {
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
