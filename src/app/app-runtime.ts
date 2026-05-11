import { SubagentManager } from "../lib/index.js";
import { closeAllDbs } from "../lib/requests.js";
import type { AppArgs } from "./app-args.js";
import { attachCommandRouter } from "./command-router.js";
import { startCronRuntime } from "./cron-startup.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
  createDaemonLifecycle,
  formatDurationMs,
  prepareDaemonAgents,
  runDaemonKeepalive,
  runInteractiveLoop,
  startRequestedSession,
  type InstanceIdentity,
} from "./daemon.js";
import { EventBus } from "./event-bus.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import { createRuntimeApiGate } from "./api-gate-runtime.js";
import type { ModelRegistry } from "./model-registry.js";
import { runMessageMode, runStatusMode } from "./modes/command.js";
import { runOneshotMode } from "./modes/oneshot.js";
import { runWorkflowMode } from "./modes/run-workflow.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { attachConsoleUI } from "./ui/console.js";
import { attachTelegramBot } from "./ui/telegram.js";

export async function runAppRuntime(opts: {
  appArgs: AppArgs;
  models: ModelRegistry["models"];
  modelBaseUrl: string;
  litellmApiKey: string;
  anthropicDirect: boolean;
  projectRoot: string;
  agentsRoot: string;
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
    oneshotMode: ONESHOT_MODE,
    statusMode: STATUS_MODE,
    messageMode: MESSAGE_MODE,
    runWorkflow: RUN_WORKFLOW,
    dryRun: DRY_RUN,
    initialTask: INITIAL_TASK,
    interfaceAgent,
    oneshotTimeoutMinutes: ONESHOT_TIMEOUT_MINUTES,
    notify: NOTIFY,
    envSessionId: ENV_SESSION_ID,
    envParentSessionId: ENV_PARENT_SESSION_ID,
    envParentAgent: ENV_PARENT_AGENT,
  } = opts.appArgs;

  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir: opts.persistDir });

  let taskSessionId: string | undefined;
  let chatSession: Awaited<ReturnType<typeof startRequestedSession>>["chatSession"];

  if (CONSOLE_ENABLED) attachConsoleUI(bus, () => taskSessionId ?? chatSession?.getSessionId() ?? null, CHAT_MODE);

  if (WEB_ENABLED) {
    const { port } = await startWebMode({ stateDir: opts.persistDir, port: parseWebPort(process.env.WEB_PORT) });
    bus.emit({ type: "info", message: `[web] Dashboard running on http://localhost:${port}` });
  }

  bus.emit({
    type: "info",
    message: `[may.ts] Starting (pid=${process.pid}, instance=${opts.instanceLabel}, root=${opts.projectRoot})`,
  });

  if (opts.anthropicDirect) {
    bus.emit({
      type: "info",
      message: "[may.ts] Anthropic direct mode: opus routing to api.anthropic.com (prompt caching enabled)",
    });
  } else {
    bus.emit({
      type: "info",
      message: `[may.ts] LiteLLM proxy mode: all models via ${opts.modelBaseUrl} (prompt caching may be limited)`,
    });
  }

  const manager = new SubagentManager({
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    infraRetryMax: 3,
    apiGate: createRuntimeApiGate(),
    bus,
  });

  attachDaemonEventSubscribers({ bus, manager, persistDir: opts.persistDir, projectRoot: opts.projectRoot });

  const { loaderOpts } = await prepareDaemonAgents({
    agentsRoot: opts.agentsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager,
    bus,
    cronEnabled: CRON_ENABLED,
  });

  let activeRL: { close: () => void } | null = null;
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
    clearActiveReadline: () => { activeRL = null; },
  });
  installProcessHandlers();

  const commandRouter = attachCommandRouter({
    bus,
    manager,
    getChatSession: () => chatSession,
    clearCancelLatch: () => { cancelledOnce = false; },
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

  const { socketPath: SOCKET_PATH, socketUI } = await startInterfaceRuntime({
    socketEnabled: SOCKET_ENABLED,
    persistDir: opts.persistDir,
    instanceLabel: opts.instanceLabel,
    interfaceAgent,
    bus,
    manager,
    getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
  });

  function emitPrompt(): void {
    bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
    if (process.stdin.isTTY) {
      const prefix = opts.instance ? `[${opts.instance}] ` : "";
      process.stdout.write(`\n${prefix}you> `);
    }
  }

  if (STATUS_MODE) {
    await runStatusMode({ persistDir: opts.persistDir, notify: NOTIFY });
    process.exit(0);
  }

  if (MESSAGE_MODE) {
    process.exit(await runMessageMode({ argv: process.argv, persistDir: opts.persistDir, agentsRoot: opts.agentsRoot }));
  }

  if (RUN_WORKFLOW) {
    try {
      await runWorkflowMode({
        mode: RUN_WORKFLOW,
        dryRun: DRY_RUN,
        agentsRoot: opts.agentsRoot,
        projectRoot: opts.projectRoot,
        persistDir: opts.persistDir,
        bus,
        manager,
        models: opts.models,
        apiKey: opts.litellmApiKey,
      });
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED && !ONESHOT_MODE && !WEB_ENABLED && !SOCKET_ENABLED && !TELEGRAM_ENABLED) {
    console.error("Error: need --chat, --task, --oneshot, --status, --message, --emit, --web, --socket, --telegram, or --cron.");
    process.exit(1);
  }

  if (ONESHOT_MODE) {
    try {
      const exitCode = await runOneshotMode({
        task: INITIAL_TASK,
        agentName: interfaceAgent,
        manager,
        timeoutMinutes: ONESHOT_TIMEOUT_MINUTES,
        formatDurationMs,
      });
      process.exit(exitCode);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  ({ taskSessionId, chatSession } = await startRequestedSession({
    bus,
    manager,
    persistDir: opts.persistDir,
    interfaceAgent,
    initialTask: INITIAL_TASK,
    chatMode: CHAT_MODE,
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
    startedBy: CHAT_MODE ? "human" : opts.instance.startsWith("job-") ? "cron:" + opts.instance.replace("job-", "") : "task",
    task: INITIAL_TASK,
    status: "running",
    sessionId: taskSessionId,
  });

  if (CRON_ENABLED) {
    await startCronRuntime({
      manager,
      bus,
      loaderOpts,
      chatMode: CHAT_MODE,
      chatSession,
    });
  }

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
      setActiveReadline: (rl) => { activeRL = rl; },
      isCancelLatched: () => cancelledOnce,
      latchCancel: () => { cancelledOnce = true; },
      emitPrompt,
    });
  } else {
    await runDaemonKeepalive({ bus, interfaceAgent, socketEnabled: SOCKET_ENABLED });
  }
}
