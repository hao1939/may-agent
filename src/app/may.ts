import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import type { ModelWithApiKey } from "../lib/types.js";
import {
  SubagentManager,
} from "../lib/index.js";
import { EventBus } from "./event-bus.js";
import { ChatSession } from "./chat-session.js";
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
} from "./daemon.js";
import { resolveProjectRoot } from "./bundle-mode.js";
import { getDb, closeAllDbs } from "../lib/requests.js";
import { log } from "../lib/log.js";
import { parseEmitMode, runEmitMode } from "./modes/emit.js";
import { parseOneshotTimeoutMinutes, runOneshotMode } from "./modes/oneshot.js";
import { parseRunWorkflowMode, runWorkflowMode } from "./modes/run-workflow.js";
import { parseWebPort, runWebOnlyMode, startWebMode } from "./modes/web.js";

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

// CLI args
const CRON_ENABLED = process.argv.includes("--cron");
const TELEGRAM_ENABLED = process.argv.includes("--telegram");
const CONSOLE_ENABLED = process.argv.includes("--console") || process.argv.includes("--chat");
const SOCKET_ENABLED = process.argv.includes("--socket");
const WEB_ENABLED = process.argv.includes("--web");
const CHAT_MODE = process.argv.includes("--chat");
const ONESHOT_MODE = process.argv.includes("--oneshot");
const STATUS_MODE = process.argv.includes("--status");
const MESSAGE_MODE = process.argv.includes("--message");
let EMIT_MODE: ReturnType<typeof parseEmitMode>;
try {
  EMIT_MODE = parseEmitMode(process.argv);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
const RUN_WORKFLOW = parseRunWorkflowMode(process.argv);
const DRY_RUN = process.argv.includes("--dry-run");
const INITIAL_TASK = (() => {
  const idx = process.argv.indexOf("--task");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  const fileIdx = process.argv.indexOf("--task-file");
  if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
    const taskFile = process.argv[fileIdx + 1];
    if (existsSync(taskFile)) return readFileSync(taskFile, "utf-8").trim();
    console.error(`Task file not found: ${taskFile}`);
    process.exit(1);
  }
  return null;
})();

const interfaceAgent = (() => {
  // Support both --agent <name> and --agent=<name>
  const eqArg = process.argv.find((a) => a.startsWith("--agent="));
  if (eqArg) return eqArg.split("=")[1]!;
  const idx = process.argv.indexOf("--agent");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.AGENT || "may";
})();

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

const WEB_ONLY_MODE = WEB_ENABLED
  && !CHAT_MODE
  && !CRON_ENABLED
  && !SOCKET_ENABLED
  && !TELEGRAM_ENABLED
  && !ONESHOT_MODE
  && !STATUS_MODE
  && !MESSAGE_MODE
  && !RUN_WORKFLOW
  && !INITIAL_TASK;

if (WEB_ONLY_MODE) {
  await runWebOnlyMode({
    stateDir: PERSIST_DIR,
    port: parseWebPort(process.env.WEB_PORT),
    instanceLabel: INSTANCE_LABEL,
    writeIdentity,
  });
}

// --oneshot CLI parameters
const ONESHOT_TIMEOUT_MINUTES = parseOneshotTimeoutMinutes(process.argv);

// ── Detached sub-agent env vars ──────────────────────────────────────────
const ENV_SESSION_ID = process.env.SESSION_ID || undefined;
const ENV_PARENT_SESSION_ID = process.env.PARENT_SESSION_ID || undefined;
const ENV_PARENT_AGENT = process.env.PARENT_AGENT || undefined;

// ── Models ──────────────────────────────────────────────────────────────

const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";

const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.ANTHROPIC_API_KEY || "not-needed";

// Bypass LiteLLM for Anthropic when ANTHROPIC_API_KEY is set.
// LiteLLM strips cache_control fields, breaking prompt caching (~40% cost savings).
// When ANTHROPIC_API_KEY is available, route directly to Anthropic's API.
const ANTHROPIC_DIRECT = process.env.ANTHROPIC_API_KEY
  ? { baseUrl: "https://api.anthropic.com", apiKey: process.env.ANTHROPIC_API_KEY }
  : { baseUrl: MODEL_BASE_URL, apiKey: LITELLM_API_KEY };

const models: Record<string, ModelWithApiKey> = {
  opus: process.env.ANTHROPIC_API_KEY
    ? {
        ...getModel("anthropic", "claude-sonnet-4-20250514"),
        id: "claude-opus-4.6",
        contextWindow: 200000,
        baseUrl: ANTHROPIC_DIRECT.baseUrl,
        apiKey: ANTHROPIC_DIRECT.apiKey,
      }
    : {
        ...getModel("anthropic", "claude-sonnet-4-20250514"),
        id: "claude-opus-4.6",
        contextWindow: 72000,
        baseUrl: MODEL_BASE_URL,
        apiKey: LITELLM_API_KEY,
      },
  gpt52: {
    ...getModel("openai", "gpt-5.2"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  "gpt-5.4": {
    ...getModel("github-copilot", "gpt-5.4"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  kimi: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "kimi-k2.5",
    contextWindow: 262144,
    baseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
    apiKey: process.env.KIMI_API_KEY || "",
  },
  // New powerful models (via LiteLLM -> GitHub Copilot)
  "gpt-5.5": {
    ...getModel("github-copilot", "gpt-5.5"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  "opus-4.7": {
    ...getModel("github-copilot", "claude-opus-4.7"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  "gemini-3.1-pro": {
    ...getModel("github-copilot", "gemini-3.1-pro-preview"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
attachEventPersistence({ bus, persistDir: PERSIST_DIR });

let taskSessionId: string | undefined;
let chatSession: ChatSession | undefined;

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

if (process.env.ANTHROPIC_API_KEY) {
  bus.emit({
    type: "info",
    message: `[may.ts] Anthropic direct mode: opus routing to api.anthropic.com (prompt caching enabled)`,
  });
} else {
  bus.emit({
    type: "info",
    message: `[may.ts] LiteLLM proxy mode: all models via ${MODEL_BASE_URL} (prompt caching may be limited)`,
  });
}

// ── API concurrency gate ───────────────────────────────────────────────
import { ApiGate } from "../lib/api-gate.js";

const apiGate = new ApiGate(
  {
    defaultConcurrency: parseInt(process.env.API_GATE_CONCURRENCY ?? "8", 10),
    overrides: process.env.API_GATE_OVERRIDES ? JSON.parse(process.env.API_GATE_OVERRIDES) : undefined,
  },
  (event) => {
    // Emit gate events on the bus for observability
    if (event.action === "queued") {
      log("info", `[api-gate] ${event.agent} (${event.sessionId.slice(0, 12)}) queued for ${event.endpoint.slice(0, 30)}... (${event.active}/${event.active} active, ${event.queued} waiting)`);
    } else if (event.action === "acquired" && event.waitMs) {
      log("info", `[api-gate] ${event.agent} acquired slot after ${event.waitMs}ms wait (${event.active} active, ${event.queued} waiting)`);
    }
  },
);

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
  const { printRequestStatus, notifyStatus } = await import("../lib/tools/request-status.js");
  const statusOutput = printRequestStatus(PERSIST_DIR);
  console.log(statusOutput);
  if (process.argv.includes("--notify")) {
    await notifyStatus(PERSIST_DIR);
  }
  process.exit(0);
}

if (MESSAGE_MODE) {
  // ── Send mode: deliver message to agent and exit ───────────────────
  const { parseSendArgs, cliSend } = await import("./cli-send.js");
  const sendOpts = parseSendArgs(process.argv);
  if (sendOpts) {
    sendOpts.persistDir = PERSIST_DIR;
    sendOpts.agentsRoot = AGENTS_ROOT;
    const delivered = await cliSend(sendOpts);
    process.exit(delivered ? 0 : 1);
  }
  process.exit(0);
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
} else if (INITIAL_TASK && !CHAT_MODE) {
  // ── Task mode: single session, run to completion ─────────────────
  // Only track as human request if not a detached sub-agent (those have ENV_PARENT_SESSION_ID)
  taskSessionId = manager.run(interfaceAgent, INITIAL_TASK, {
    kind: "job",
    ...(ENV_SESSION_ID ? { sessionId: ENV_SESSION_ID } : {}),
    ...(ENV_PARENT_SESSION_ID ? { parentSessionId: ENV_PARENT_SESSION_ID } : {}),
    ...(ENV_PARENT_AGENT ? { parentAgentName: ENV_PARENT_AGENT } : {}),
  });
  bus.emit({ type: "info", message: `[task] Started ${interfaceAgent} task session: ${taskSessionId}` });
  await manager.waitForIdle(taskSessionId);
} else if (CHAT_MODE) {
  // ── Chat mode: persistent session via ChatSession ────────────────
  chatSession = new ChatSession({
    manager,
    bus,
    agentName: interfaceAgent,
    persistDir: PERSIST_DIR,
    onDone: () => {
      emitPrompt();
    },
    onReload: handleReload,
    onClose: () => {
      bus.emit({ type: "info", message: "[cmd] Closing..." });
      gracefulShutdown();
    },
    onRestart: () => {
      bus.emit({ type: "info", message: "[cmd] Restarting (supervisord will restart)..." });
      gracefulRestart();
    },
  });

  bus.emit({ type: "info", message: `[chat] Chat session ready. Agent: ${interfaceAgent}` });
} else {
  // ── Cron-only mode ───────────────────────────────────────────────
  bus.emit({ type: "info", message: `[cron-only] No chat session. Running cron jobs only.` });
}

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
