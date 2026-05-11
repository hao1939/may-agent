import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import {
  SubagentManager,
} from "../lib/index.js";
import { EventBus } from "./event-bus.js";
import { attachCommandRouter } from "./command-router.js";
import { startInterfaceRuntime } from "./interface-startup.js";
import { startCronRuntime } from "./cron-startup.js";
import { attachConsoleUI } from "./ui/console.js";
import { attachTelegramBot } from "./ui/telegram.js";
import {
  attachDaemonEventSubscribers,
  attachEventPersistence,
  createDaemonLifecycle,
  createIdentityWriter,
  formatDurationMs,
  prepareDaemonAgents,
  runDaemonKeepalive,
  runInteractiveLoop,
  startRequestedSession,
} from "./daemon.js";
import { resolveProjectRoot } from "./bundle-mode.js";
import { getDb, closeAllDbs } from "../lib/requests.js";
import { runMessageMode, runStatusMode } from "./modes/command.js";
import { runEmitMode } from "./modes/emit.js";
import { runOneshotMode } from "./modes/oneshot.js";
import { runWorkflowMode } from "./modes/run-workflow.js";
import { parseWebPort, runWebOnlyMode, startWebMode } from "./modes/web.js";
import { createModelRegistry } from "./model-registry.js";
import { parseAppArgs } from "./app-args.js";
import { createRuntimeApiGate } from "./api-gate-runtime.js";

// ── --version / -v: print version + git SHA and exit immediately ────────
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    // Not inside a git repo or git not available — fall back to "unknown"
  }
  console.log(`${pkg.name} v${pkg.version} (${gitSha})`);
  process.exit(0);
}

const PROJECT_ROOT = resolveProjectRoot(import.meta.url);
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
const PERSIST_DIR = resolve(process.env.STATE_DIR || resolve(PROJECT_ROOT, ".state"));

// ── Instance identity ───────────────────────────────────────────────────

const INSTANCE = process.env.INSTANCE || "";
const INSTANCE_LABEL = INSTANCE || "default";

const PROCESS_START_TIME = Date.now();

const writeIdentity = createIdentityWriter({ persistDir: PERSIST_DIR, instanceLabel: INSTANCE_LABEL });

let appArgs: ReturnType<typeof parseAppArgs>;
try {
  appArgs = parseAppArgs();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

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
  emitMode: EMIT_MODE,
  runWorkflow: RUN_WORKFLOW,
  dryRun: DRY_RUN,
  initialTask: INITIAL_TASK,
  interfaceAgent,
  webOnlyMode: WEB_ONLY_MODE,
  oneshotTimeoutMinutes: ONESHOT_TIMEOUT_MINUTES,
  notify: NOTIFY,
  envSessionId: ENV_SESSION_ID,
  envParentSessionId: ENV_PARENT_SESSION_ID,
  envParentAgent: ENV_PARENT_AGENT,
} = appArgs;

if (EMIT_MODE) {
  // ── Operator emit mode: send one event to the running daemon and exit ─
  // Keep this before agent/model startup so operators have a small, reliable
  // control command that does not boot another runtime-shaped process.
  try {
    await runEmitMode({
      mode: EMIT_MODE,
      persistDir: PERSIST_DIR,
      instanceLabel: INSTANCE_LABEL,
      interfaceAgent,
      daemonInstance: process.env.DAEMON_INSTANCE,
      daemonAgent: process.env.DAEMON_AGENT,
    });
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (WEB_ONLY_MODE) {
  await runWebOnlyMode({
    stateDir: PERSIST_DIR,
    port: parseWebPort(process.env.WEB_PORT),
    instanceLabel: INSTANCE_LABEL,
    writeIdentity,
  });
}

// ── Models ──────────────────────────────────────────────────────────────

const { models, modelBaseUrl, apiKey: LITELLM_API_KEY, anthropicDirect } = createModelRegistry();

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
attachEventPersistence({ bus, persistDir: PERSIST_DIR });

let taskSessionId: string | undefined;
let chatSession: Awaited<ReturnType<typeof startRequestedSession>>["chatSession"];

if (CONSOLE_ENABLED) attachConsoleUI(bus, () => taskSessionId ?? chatSession?.getSessionId() ?? null, CHAT_MODE);

// Web UI — runs in-process when --web is passed
if (WEB_ENABLED) {
  const { port } = await startWebMode({ stateDir: PERSIST_DIR, port: parseWebPort(process.env.WEB_PORT) });
  bus.emit({ type: "info", message: `[web] Dashboard running on http://localhost:${port}` });
}

bus.emit({
  type: "info",
  message: `[may.ts] Starting (pid=${process.pid}, instance=${INSTANCE_LABEL}, root=${PROJECT_ROOT})`,
});

if (anthropicDirect) {
  bus.emit({
    type: "info",
    message: `[may.ts] Anthropic direct mode: opus routing to api.anthropic.com (prompt caching enabled)`,
  });
} else {
  bus.emit({
    type: "info",
    message: `[may.ts] LiteLLM proxy mode: all models via ${modelBaseUrl} (prompt caching may be limited)`,
  });
}

// ── API concurrency gate ───────────────────────────────────────────────

const apiGate = createRuntimeApiGate();

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  projectRoot: PROJECT_ROOT,
  infraRetryMax: 3,
  apiGate,
  bus,
});

attachDaemonEventSubscribers({ bus, manager, persistDir: PERSIST_DIR, projectRoot: PROJECT_ROOT });

const { loaderOpts } = await prepareDaemonAgents({
  agentsRoot: AGENTS_ROOT,
  projectRoot: PROJECT_ROOT,
  persistDir: PERSIST_DIR,
  models,
  manager,
  bus,
  cronEnabled: CRON_ENABLED,
});

// ── Event routing ──────────────────────────────────────────────────────

// ── Context Learning ──────────────────────────────────────────────────
// Moved to agents/may/handlers/context-learn.ts (event-driven handler).
// Subscribes to "context-learn" events via cron.json `on` field.

let activeRL: { close: () => void } | null = null;
let telegramBot: { close: () => void; sendAlert: (...args: any[]) => any } = { close: () => {}, sendAlert: () => {} };
/** Track whether Ctrl+C cancel has been issued (second Ctrl+C force-quits). */
let cancelledOnce = false;

const { gracefulShutdown, gracefulRestart, handleReload, installProcessHandlers } = createDaemonLifecycle({
  bus,
  manager,
  loaderOpts,
  closeAllDbs,
  writeIdentity,
  processStartTime: PROCESS_START_TIME,
  getChatSession: () => chatSession,
  getTelegramBot: () => telegramBot,
  getActiveReadline: () => activeRL,
  clearActiveReadline: () => { activeRL = null; },
});
installProcessHandlers();

// ── Command routing (socket/telegram -> chat loop or built-in) ──────────

const commandRouter = attachCommandRouter({
  bus,
  manager,
  getChatSession: () => chatSession,
  clearCancelLatch: () => { cancelledOnce = false; },
  projectRoot: PROJECT_ROOT,
  reload: handleReload,
  restart: gracefulRestart,
  shutdown: gracefulShutdown,
});
const handleInput = commandRouter.handleInput;

// ── Backward compat: onCommand removed ──────────────────────────────────
// All commands now flow through bus.subscribe() above.
// Socket normalizes aliases (run→fork, close→shutdown, reload_agents→reload)
// and emits directly to the bus.

// ── Interface agent selection ──────────────────────────────────────────

if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// ── Socket + PID file ────────────────────────────────────────────────────

const { socketPath: SOCKET_PATH, socketUI } = await startInterfaceRuntime({
  socketEnabled: SOCKET_ENABLED,
  persistDir: PERSIST_DIR,
  instanceLabel: INSTANCE_LABEL,
  interfaceAgent,
  bus,
  manager,
  getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
});

// ── Prompt helper ──────────────────────────────────────────────────────

function emitPrompt(): void {
  bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
  if (process.stdin.isTTY) {
    const prefix = INSTANCE ? `[${INSTANCE}] ` : "";
    process.stdout.write(`\n${prefix}you> `);
  }
}

// ── Startup ────────────────────────────────────────────────────────────

if (STATUS_MODE) {
  // ── Status mode: print dashboard and exit ──────────────────────────
  await runStatusMode({ persistDir: PERSIST_DIR, notify: NOTIFY });
  process.exit(0);
}

if (MESSAGE_MODE) {
  // ── Send mode: deliver message to agent and exit ───────────────────
  process.exit(await runMessageMode({ argv: process.argv, persistDir: PERSIST_DIR, agentsRoot: AGENTS_ROOT }));
}

if (RUN_WORKFLOW) {
  // ── Run workflow mode: load and execute a workflow directly ───────
  try {
    await runWorkflowMode({
      mode: RUN_WORKFLOW,
      dryRun: DRY_RUN,
      agentsRoot: AGENTS_ROOT,
      projectRoot: PROJECT_ROOT,
      persistDir: PERSIST_DIR,
      bus,
      manager,
      models,
      apiKey: LITELLM_API_KEY,
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
  // ── Oneshot mode: single session, JSON result to stdout, then exit ──
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
  persistDir: PERSIST_DIR,
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

// ── Write identity ─────────────────────────────────────────────────────

writeIdentity({
  pid: process.pid,
  agent: interfaceAgent,
  instance: INSTANCE_LABEL,
  socket: SOCKET_ENABLED ? SOCKET_PATH : "",
  startedAt: new Date().toISOString(),
  startedBy: CHAT_MODE ? "human" : INSTANCE.startsWith("job-") ? "cron:" + INSTANCE.replace("job-", "") : "task",
  task: INITIAL_TASK,
  status: "running",
  sessionId: taskSessionId,
});

// ── Start cron jobs (--cron to enable) ──────────────────────────────────

if (CRON_ENABLED) {
  await startCronRuntime({
    manager,
    bus,
    loaderOpts,
    chatMode: CHAT_MODE,
    chatSession,
  });
}

// ── Telegram bot (--telegram flag to enable) ─────────────────────────

telegramBot = TELEGRAM_ENABLED
  ? attachTelegramBot({
      bus,
      manager,
      persistDir: PERSIST_DIR,
      projectRoot: PROJECT_ROOT,
      getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
      interfaceAgent,
    })
  : { close: () => {}, sendAlert: () => {} };

// ── Main loop ──────────────────────────────────────────────────────────

if (!CHAT_MODE && !CRON_ENABLED && !WEB_ENABLED && !SOCKET_ENABLED && !TELEGRAM_ENABLED) {
  // Task mode: agent already ran to completion above.
  bus.emit({ type: "info", message: `[task] Task completed. Exiting.` });
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
