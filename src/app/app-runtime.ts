import { randomUUID } from "node:crypto";
import { assertLegacyCliTasksSettled } from "../lib/cli-agent.js";
import { basename, dirname, resolve } from "node:path";
import { SubagentManager } from "../lib/index.js";
import type { AppEvent, AppInput } from "@may-agent/sdk";
import type { TaskListOptions } from "@may-agent/sdk";
import type { AttachControlSocketOptions } from "../../packages/control/src/server.js";
import { closeAllDbs, getDb } from "../lib/requests.js";
import { stateTransaction } from "../lib/db/transaction.js";
import type { AppReporting } from "./composition/reporting.js";
import type { AppArgs } from "./app-args.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";
import { AppRegistry } from "./core/apps/registry.js";
import { discoverAppDefinitions, listAppDefinitionFiles } from "./adapters/discovery/app-definitions.js";
import { DefinitionSourceReleaseStore, type DefinitionSourceRelease } from "./app-source-release.js";
import { createRuntimeAppRead } from "./core/reads/app-read.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { createConversationAgentResolver } from "./conversations/turn-agent.js";
import { readAppConversationResource } from "./core/state/conversations.js";
import { HostCapacity } from "./host-capacity.js";
import { attachCommandRouter } from "./command-router.js";
import { runsBackgroundWork, startBackgroundRuntime } from "./composition/background-startup.js";
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
import { EventBus } from "./core/events/bus.js";
import { createEventInterface, type EventInterface } from "./core/events/interface.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import type { ModelRegistry } from "./model-registry.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
import { attachConsoleUI } from "./transport/console.js";
import { attachDaemonInfoLog } from "./transport/daemon-info-log.js";
import { attachTelegramBot } from "./transport/telegram.js";
import { HumanTaskService } from "./human-task-service.js";
import { createTaskAttemptProcessExecutor, createTaskRecoveryProcessExecutor } from "./task-attempt-process.js";
import { createTaskAdmissionProcess } from "./task-admission-process.js";
import { getAgentMaintenance, prepareAgentGeneration, publishPreparedAgentGeneration } from "./agent-loader.js";
import { activateAgentMaintenance } from "./composition/maintenance-activation.js";
import { attachTaskControlEventRoute, taskCancelRequestedEvent } from "./task-control-events.js";

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
  reporting?: AppReporting;
}): Promise<void> {
  assertLegacyCliTasksSettled(opts.persistDir);
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
  const backgroundEnabled = runsBackgroundWork(opts.appArgs, Boolean(interactiveConsole));

  const bus = new EventBus();
  const requestedHostConcurrency = Number(process.env.MAY_HOST_MAX_CONCURRENT ?? 4);
  const configuredHostConcurrency =
    Number.isInteger(requestedHostConcurrency) && requestedHostConcurrency > 0 ? requestedHostConcurrency : 4;
  const hostCapacity = new HostCapacity(configuredHostConcurrency);
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
  const humanTasks = new HumanTaskService(getDb(opts.persistDir), appRegistry);

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
    cronEnabled: CRON_ENABLED,
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
    cancelTask: ({ appId, taskId, generation, resourceVersion, reason, controlKey }) =>
      appTasks.cancel({
        appId,
        taskId,
        reason,
        expectedGeneration: generation,
        expectedResourceVersion: resourceVersion,
        controlKey,
      }),
  });
  const events = createEventInterface({
    bus,
    db: getDb(opts.persistDir),
    acceptsAppInput: (appId, input) => appInboxRuntime?.host.acceptsInput(appId, input) ?? false,
    hasApp: (appId) =>
      appRegistry.snapshot().entries.some((entry) => entry.definition.id === appId.trim().replace(/\.app$/, "")),
    hasAgent: (agent) => manager.hasAgent(agent),
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
    hostCapacity,
    maxConcurrentRequests: configuredHostConcurrency,
    schedulesEnabled: backgroundEnabled && CRON_ENABLED,
    attachTask: appTasks.attach,
    resolveRequest: createConversationAgentResolver({ manager, registry: appRegistry, db: getDb(opts.persistDir) }),
    controlTask: async ({ control, authorize }) => {
      if (control.kind !== "cancel") throw new Error(`Unsupported human Task control: ${control.kind}`);
      const task = humanTasks.getTask({ appId: control.appId, taskId: control.taskId });
      if (!task) throw new Error(`Task ${control.appId}/${control.taskId} was not found`);
      const receipt = stateTransaction(getDb(opts.persistDir), () => {
        authorize();
        return events.publish(taskCancelRequestedEvent(task, control.reason), {
          source: "app-inbox",
          inputSource: { kind: "human", id: "app-inbox" },
        });
      });
      if (receipt.delivery !== "accepted") {
        throw new Error(`Task ${control.appId}/${control.taskId} cancellation was recorded but not accepted`);
      }
    },
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      appTasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    createTaskAdmissionWorker: () =>
      createTaskAdmissionProcess({ definitionSource: workerDefinitionSource() ?? undefined }),
    wakeAdmittedTasks: ({ appId, taskIds, supersededSessionIds }) =>
      appTasks.wake({ appId, taskIds, supersededSessionIds }),
    hasTaskTarget: ({ appId, taskId }) => appTasks.has({ appId, taskId }),
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
          readMetric: opts.reporting?.readMetric,
          taskRead: {
            list: async (options) => appTasks.list({ appId, ...(options ? { options } : {}) }),
            outcomes: async (projection) => appTasks.outcomes({ appId, ...(projection ? { projection } : {}) }),
            get: async (taskId) => appTasks.get({ appId, taskId }),
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
    prepareAgents: async () => {
      const source = appSources.stage();
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
    publishAgents: (options, generation) => {
      const publication = publishPreparedAgentGeneration(options, generation);
      try {
        if (backgroundEnabled) activateAgentMaintenance(generation.maintenance, bus, CRON_ENABLED);
        return publication;
      } catch (error) {
        publication.rollback();
        throw error;
      }
    },
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
      return { appIds, taskApps };
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

  // Open the Conversation adapter before external ingress or cron work so it
  // can observe every later shared Conversation update. Its writes use the
  // same semantic event boundary as Console and HTTP.
  telegramBot = TELEGRAM_ENABLED
    ? attachTelegramBot({
        bus,
        persistDir: opts.persistDir,
        interfaceAgent,
        humanTasks: {
          getTask: (input) => humanTasks.getTask(input),
          listApps: (appId) => humanTasks.listApps(appId),
          listTasks: (options) => humanTasks.listTasks(options),
        },
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

  if (backgroundEnabled) {
    // Handlers are prepared before ingress; activate only after its routes and
    // Conversation adapters are ready. A startup job must not gate core work.
    activateAgentMaintenance(getAgentMaintenance(), bus, CRON_ENABLED);
    await appInboxRuntime.start();
    startBackgroundRuntime({
      manager,
      bus,
      persistDir: loaderOpts.persistDir,
      onTaskRecoverySettled: startAppTaskControllers,
    });
  }

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
