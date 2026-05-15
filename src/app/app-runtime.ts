import { SubagentManager } from "../lib/index.js";
import { closeAllDbs } from "../lib/requests.js";
import type { AppArgs } from "./app-args.js";
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
import { EventBus } from "./event-bus.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import { createRuntimeApiGate } from "./api-gate-runtime.js";
import type { ModelRegistry } from "./model-registry.js";
import { waitForModelProxy } from "./model-proxy-health.js";
import { parseWebPort, startWebMode } from "./modes/web.js";
import { runRequestedExitMode } from "./runtime-exit-modes.js";
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
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
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

  await runRequestedExitMode({
    appArgs: opts.appArgs,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    bus,
    manager,
    models: opts.models,
    litellmApiKey: opts.litellmApiKey,
  });

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
    await waitForModelProxy({
      baseUrl: opts.modelBaseUrl,
      bus,
      timeoutMs: Number(process.env.MODEL_PROXY_READY_TIMEOUT_MS) || 120_000,
    });
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
