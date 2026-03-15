import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager, evaluateTask, writeSkippedEvaluations } from "../lib/index.js";
import { EventBus } from "./event-bus.js";
import { ChatSession } from "./chat-session.js";
import { attachConsoleUI } from "./ui/console.js";
import { attachSocketUI } from "./ui/socket.js";
import { attachTelegramBot } from "./ui/telegram.js";
import {
  loadAgents,
  reloadAgents,
  setAgentSessionId,
  getAgentSessionId,
  runAgentCleanup,
  getAgentCrons,
  loadAgentHandlers,
  type AgentLoaderOptions,
} from "./agent-loader.js";
import { resolveProjectRoot } from "./bundle-mode.js";

const PROJECT_ROOT = resolveProjectRoot(import.meta.url);
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
const PERSIST_DIR = resolve(process.env.STATE_DIR || resolve(PROJECT_ROOT, ".state"));

// ── Instance identity ───────────────────────────────────────────────────

const INSTANCE = process.env.INSTANCE || "";
const INSTANCE_LABEL = INSTANCE || "default";

interface InstanceIdentity {
  pid: number;
  agent: string;
  instance: string;
  socket: string;
  startedAt: string;
  startedBy: string;
  task: string | null;
  status: "running" | "done" | "error";
  exitCode?: number | null;
  endedAt?: string;
  duration?: string;
  sessionId?: string;
}

const INSTANCES_DIR = resolve(PERSIST_DIR, "instances");
const IDENTITY_PATH = resolve(INSTANCES_DIR, INSTANCE_LABEL, "identity.json");
const PROCESS_START_TIME = Date.now();

function writeIdentity(data: Partial<InstanceIdentity>): void {
  const dir = resolve(INSTANCES_DIR, INSTANCE_LABEL);
  mkdirSync(dir, { recursive: true });
  let existing: Partial<InstanceIdentity> = {};
  try {
    existing = JSON.parse(readFileSync(IDENTITY_PATH, "utf-8"));
  } catch {}
  const merged = { ...existing, ...data };
  writeFileSync(IDENTITY_PATH, JSON.stringify(merged, null, 2));
}

function formatDurationMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return seconds + "s";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return minutes + "m" + secs + "s";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours + "h" + mins + "m";
}

// CLI args
const CRON_ENABLED = process.argv.includes("--cron");
const TELEGRAM_ENABLED = process.argv.includes("--telegram");
const CONSOLE_ENABLED = process.argv.includes("--console") || process.argv.includes("--chat");
const SOCKET_ENABLED = process.argv.includes("--socket");
const CHAT_MODE = process.argv.includes("--chat");
const ONESHOT_MODE = process.argv.includes("--oneshot");
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

// --oneshot CLI parameters
const ONESHOT_TIMEOUT_MINUTES = (() => {
  const arg = process.argv.find((a) => a.startsWith("--timeout="));
  if (arg) {
    const val = parseInt(arg.split("=")[1]!, 10);
    return isNaN(val) ? 5 : val;
  }
  return 5;
})();

// ── Detached sub-agent env vars ──────────────────────────────────────────
const ENV_SESSION_ID = process.env.SESSION_ID || undefined;
const ENV_PARENT_SESSION_ID = process.env.PARENT_SESSION_ID || undefined;
const ENV_PARENT_AGENT = process.env.PARENT_AGENT || undefined;

// ── Models ──────────────────────────────────────────────────────────────

const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";

const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.ANTHROPIC_API_KEY || "not-needed";

const models: Record<string, any> = {
  opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: 72000, // LiteLLM proxy enforces 72K limit — must match so compaction triggers before overflow
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  gpt52: {
    ...getModel("openai", "gpt-5.2"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  gemini3pro: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "gemini-3-pro-preview",
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  kimi: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "kimi-k2.5",
    contextWindow: 262144,
    baseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
    apiKey: process.env.KIMI_API_KEY || "",
  },
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
if (CONSOLE_ENABLED) attachConsoleUI(bus);

bus.emit({
  type: "info",
  message: `[may.ts] Starting (pid=${process.pid}, instance=${INSTANCE_LABEL}, root=${PROJECT_ROOT})`,
});

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  projectRoot: PROJECT_ROOT,
  infraRetryMax: 3,
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
    setAgentSessionId(agentName, sessionId);
  },
  onSessionComplete: (info) => {
    runAgentCleanup(info.agent);

    // Surface errors for completed task sessions
    if (info.error && info.status === "error") {
      bus.emit({ type: "info", message: `[${info.agent}] ⚠️ Session ${info.status}: ${info.error}` });
    }

    // Auto-evaluate completed task trees (children of task-mode sessions)
    if (info.parentSessionId && taskSessionId && info.parentSessionId === taskSessionId) {
      setTimeout(async () => {
        try {
          const result = await evaluateTask({
            manager,
            persistDir: PERSIST_DIR,
            parentSessionId: info.parentSessionId!,
          });
          if (result) {
            const agentNames = Object.keys(result.agents).join(", ");
            const verdict = result.overall.verdict;
            bus.emit({
              type: "info",
              message: `[eval] Auto-evaluated ${result.sessionIds.length} session(s) (${agentNames}): ${verdict}`,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          bus.emit({ type: "info", message: `[eval] Auto-evaluation failed: ${msg}` });
        }
      }, 3000);
    }
  },
});

// ── Load agents from agents/*/agent.json ────────────────────────────────

const loaderOpts: AgentLoaderOptions = {
  agentsRoot: AGENTS_ROOT,
  projectRoot: PROJECT_ROOT,
  persistDir: PERSIST_DIR,
  models,
  manager,
  bus,
  cronEnabled: CRON_ENABLED,
};

const loadResult = loadAgents(loaderOpts);
bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

writeSkippedEvaluations(PERSIST_DIR).then((skipped) => {
  if (skipped > 0)
    bus.emit({
      type: "info",
      message: `[eval] Wrote ${skipped} skipped evaluation(s) (meta-agents/no-transcript) — no LLM needed`,
    });
});

// ── Event routing ──────────────────────────────────────────────────────

const interfaceAgent = (() => {
  // Support both --agent <name> and --agent=<name>
  const eqArg = process.argv.find((a) => a.startsWith("--agent="));
  if (eqArg) return eqArg.split("=")[1]!;
  const idx = process.argv.indexOf("--agent");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.AGENT || "may";
})();

function attachAgentEvents(label: string, sessionId: string): void {
  const isChat = label === interfaceAgent;

  if (!isChat) {
    let toolCalls = 0;
    let turnStart = Date.now();

    manager.subscribe(sessionId, (event) => {
      switch (event.type) {
        case "turn_start":
          turnStart = Date.now();
          toolCalls = 0;
          break;
        case "tool_execution_start":
          toolCalls++;
          break;
        case "turn_end": {
          const elapsed = ((Date.now() - turnStart) / 1000).toFixed(0);
          bus.emit({ type: "info", message: `[${label}] turn done (${elapsed}s, ${toolCalls} tool calls)` });
          break;
        }
      }
    });
    return;
  }

  // Chat/task session: full event streaming
  manager.subscribe(sessionId, (event) => {
    const channel = "chat" as const;

    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          bus.emit({ type: "prompt", message: label, channel });
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          bus.emit({ type: "text", agent: label, text: event.assistantMessageEvent.delta, channel });
        }
        break;
      case "tool_execution_start":
        bus.emit({ type: "tool_call", agent: label, tool: event.toolName, args: event.args, channel });
        break;
      case "tool_execution_end": {
        // P84 wrapping prepends <tool_output name="..."> as content[0] and appends
        // </tool_output> as the last block. Skip those wrapper blocks to get the
        // actual tool output for the preview.
        const blocks = event.result?.content ?? [];
        const firstReal = blocks.find(
          (b: any) => b?.type === "text" && !b.text?.startsWith("<tool_output") && b.text !== "</tool_output>",
        );
        const text = firstReal?.text ?? "";
        bus.emit({
          type: "tool_result",
          agent: label,
          tool: event.toolName,
          preview: text.slice(0, 200),
          isError: !!event.isError,
          channel,
        });
        break;
      }
    }
  });
}

// ── Graceful shutdown / restart ─────────────────────────────────────────

let shuttingDown = false;
let activeRL: ReturnType<typeof createInterface> | null = null;
/** Track whether Ctrl+C cancel has been issued (second Ctrl+C force-quits). */
let cancelledOnce = false;
let taskSessionId: string | undefined;
/** Chat session instance (only set in --chat mode). */
let chatSession: ChatSession | undefined;

function gracefulShutdown() {
  if (shuttingDown) {
    process.exit(1);
  }
  shuttingDown = true;
  bus.emit({ type: "info", message: `Shutting down...` });

  for (const cron of getAgentCrons().values()) {
    cron.stop();
  }

  telegramBot.close();

  if (activeRL) {
    activeRL.close();
    activeRL = null;
  }

  // Cancel all running sessions
  chatSession?.cancelAll();
  for (const s of manager.status()) {
    if (s.status === "running") {
      manager.cancel(s.sessionId);
    }
  }

  setTimeout(() => process.exit(0), 2000);
}

const EXIT_RELOAD = 100;

function gracefulRestart() {
  if (shuttingDown) {
    process.exit(EXIT_RELOAD);
    return;
  }
  shuttingDown = true;
  bus.emit({ type: "info", message: "Restarting (hot-reload)..." });

  for (const cron of getAgentCrons().values()) {
    cron.stop();
  }
  telegramBot.close();
  if (activeRL) {
    activeRL.close();
    activeRL = null;
  }
  chatSession?.cancelAll();
  for (const s of manager.status()) {
    if (s.status === "running") {
      manager.cancel(s.sessionId);
    }
  }

  process.exit(EXIT_RELOAD);
}

function handleReload(): void {
  const result = reloadAgents(loaderOpts);
  if (result.errors.length > 0) {
    bus.emit({ type: "info", message: `[reload] Validation errors:\n${result.errors.join("\n")}` });
  } else if (result.added.length > 0 || result.updated.length > 0) {
    const parts: string[] = [];
    if (result.added.length > 0) parts.push(`${result.added.length} new (${result.added.join(", ")})`);
    if (result.updated.length > 0) parts.push(`${result.updated.length} updated (${result.updated.join(", ")})`);
    bus.emit({ type: "info", message: `[reload] ${parts.join(", ")}` });
  } else {
    bus.emit({ type: "info", message: "[reload] No changes" });
  }
}

process.on("SIGINT", () => {
  gracefulShutdown();
});
process.on("SIGTERM", () => {
  bus.emit({ type: "info", message: "[signal] SIGTERM received" });
  gracefulShutdown();
});
process.on("SIGHUP", () => {
  bus.emit({ type: "info", message: "[signal] SIGHUP received (ignoring)" });
});
process.on("uncaughtException", (err) => {
  bus.emit({ type: "info", message: `[fatal] Uncaught exception: ${err.message}\n${err.stack}` });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  bus.emit({ type: "info", message: `[fatal] Unhandled rejection: ${reason}` });
});
process.on("exit", (code) => {
  try {
    writeIdentity({
      status: code === 0 ? "done" : "error",
      exitCode: code,
      endedAt: new Date().toISOString(),
      duration: formatDurationMs(Date.now() - PROCESS_START_TIME),
    });
  } catch {}
});

// ── Command routing (socket/telegram → chat loop or built-in) ───────────

/**
 * Unified input handler. All channels (terminal, socket, telegram) route here.
 * In chat mode, delegates to ChatSession. In task/cron mode, handles commands directly.
 */
function handleInput(message: string, source?: string): void {
  cancelledOnce = false;
  if (chatSession) {
    chatSession.handleInput(message, source);
    return;
  }

  // Task/cron mode: only handle built-in commands
  const lower = message.trim().toLowerCase();
  if (lower === "status") {
    const sessions = manager.status();
    if (sessions.length === 0) {
      bus.emit({ type: "info", message: "[status] No active sessions" });
    } else {
      const lines = sessions.map(
        (s) => `  ${s.agent} (${s.sessionId}): ${s.status} — "${s.task.slice(0, 80)}" [${s.runtime}]`,
      );
      bus.emit({ type: "info", message: `[status] ${sessions.length} active session(s):\n${lines.join("\n")}` });
    }
    return;
  }
  if (lower === "cancel" || lower === "cancel all") {
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    bus.emit({ type: "info", message: "[cmd] Cancelled all running sessions" });
    return;
  }
  if (lower === "reload") {
    handleReload();
    return;
  }
  if (lower === "restart") {
    gracefulRestart();
    return;
  }
  if (lower === "close") {
    gracefulShutdown();
    return;
  }

  bus.emit({ type: "info", message: `[cmd] Input ignored (no chat session). Use --chat for interactive mode.` });
}

bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "input":
      handleInput(cmd.message, cmd.source);
      return { ok: true };
    case "steer": {
      // Steer a specific session by ID (for programmatic control from socket).
      const targetSid = cmd.sessionId;
      if (!targetSid) {
        return { ok: false, message: "steer requires sessionId in V2" };
      }
      try {
        manager.steer(targetSid, cmd.message, "human");
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[steer] ${msg}` });
        return { ok: false, message: msg };
      }
    }
    case "cancel":
      bus.emit({ type: "info", message: `[cmd] Cancel: ${cmd.sessionId}` });
      manager.cancel(cmd.sessionId);
      return { ok: true };
    case "cancel_all":
      handleInput("cancel all");
      return { ok: true };
    case "cancel_task":
      handleInput("cancel");
      return { ok: true };
    case "close":
      gracefulShutdown();
      return { ok: true };
    case "status":
      handleInput("status");
      return { ok: true };
    case "run": {
      // Direct agent invocation from socket
      if (chatSession) {
        chatSession.handleInput(`@${cmd.agent} ${cmd.message}`, "socket");
      } else {
        const sessionId = manager.run(cmd.agent, cmd.message, { kind: "job" });
        bus.emit({ type: "info", message: `[direct] Started ${cmd.agent} session: ${sessionId}` });
      }
      return { ok: true };
    }
    case "reload_agents":
      handleReload();
      return { ok: true };
    case "restart":
      gracefulRestart();
      return { ok: true };
    default:
      return { ok: false, message: `Unknown command type: ${(cmd as { type: string }).type}` };
  }
});

// ── Interface agent selection ──────────────────────────────────────────

if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// ── Socket + PID file ────────────────────────────────────────────────────

const INSTANCE_DIR = resolve(INSTANCES_DIR, INSTANCE_LABEL);
const sockName = `${interfaceAgent}.sock`;
const pidName = `${interfaceAgent}.pid`;
const SOCKET_PATH = resolve(INSTANCE_DIR, sockName);
const PID_PATH = resolve(INSTANCE_DIR, pidName);

mkdirSync(INSTANCE_DIR, { recursive: true });
writeFileSync(PID_PATH, String(process.pid), "utf-8");
const cleanupPid = () => {
  try {
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);
  } catch {
    /* ignore */
  }
};
process.on("exit", cleanupPid);

const socketUI = SOCKET_ENABLED
  ? await attachSocketUI({
      socketPath: SOCKET_PATH,
      bus,
      manager,
      getSessionId: () => taskSessionId ?? "",
      agentName: interfaceAgent,
      instance: INSTANCE_LABEL,
    })
  : { close: () => {}, clientCount: () => 0 };

if (SOCKET_ENABLED) {
  bus.emit({ type: "info", message: `[instance:${INSTANCE_LABEL}] PID ${process.pid}, socket ${sockName}` });
} else {
  bus.emit({
    type: "info",
    message: `[instance:${INSTANCE_LABEL}] PID ${process.pid}, socket disabled (use --socket to enable)`,
  });
}

// ── Prompt helper ──────────────────────────────────────────────────────

function emitPrompt(): void {
  bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
  if (process.stdin.isTTY) {
    const prefix = INSTANCE ? `[${INSTANCE}] ` : "";
    process.stdout.write(`\n${prefix}you> `);
  }
}

// ── Startup ────────────────────────────────────────────────────────────

if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED && !ONESHOT_MODE) {
  console.error("Error: need --chat, --task, --oneshot, or --cron.");
  process.exit(1);
}

if (ONESHOT_MODE) {
  // ── Oneshot mode: single session, JSON result to stdout, then exit ──
  const oneshotTask = INITIAL_TASK;
  if (!oneshotTask) {
    console.error("Error: --oneshot requires --task <description>");
    process.exit(1);
  }

  const oneshotStart = Date.now();
  const timeoutMs = ONESHOT_TIMEOUT_MINUTES * 60 * 1000;

  taskSessionId = manager.run(interfaceAgent, oneshotTask, { kind: "job" });

  // Set up timeout
  const timeoutTimer = setTimeout(() => {
    manager.cancel(taskSessionId!);
    const result = {
      sessionId: taskSessionId,
      status: "timeout",
      duration: `${ONESHOT_TIMEOUT_MINUTES}m`,
      result: `Session timed out after ${ONESHOT_TIMEOUT_MINUTES} minutes`,
    };
    console.log(JSON.stringify(result));
    process.exit(1);
  }, timeoutMs);
  timeoutTimer.unref();

  await manager.waitForIdle(taskSessionId);
  clearTimeout(timeoutTimer);

  const durationMs = Date.now() - oneshotStart;
  const sessions = manager.status();
  const session = sessions.find((s) => s.sessionId === taskSessionId);
  const status = session?.status === "error" ? "error" : "success";

  const result = {
    sessionId: taskSessionId,
    status,
    duration: formatDurationMs(durationMs),
    result: session ? `Agent ${interfaceAgent} completed (${session.status})` : `Agent ${interfaceAgent} completed`,
  };
  console.log(JSON.stringify(result));
  process.exit(status === "success" ? 0 : 1);
} else if (INITIAL_TASK && !CHAT_MODE) {
  // ── Task mode: single session, run to completion ─────────────────
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
      bus.emit({ type: "info", message: "[cmd] Restarting (exit 100 for launcher hot-reload)..." });
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
  // Resume stale job sessions from a previous process crash.
  // Only job sessions — chat and call sessions are left untouched.
  const { resumed, interrupted } = manager.resumeStaleSessions({ kinds: ["job"] });
  if (resumed.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Resumed ${resumed.length} session(s): ${resumed.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
  if (interrupted.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] ${interrupted.length} session(s) could not resume: ${interrupted.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }

  const handlerResult = await loadAgentHandlers({
    ...loaderOpts,
    getSessionId: (agentName: string) => {
      return getAgentSessionId(agentName) ?? null;
    },
  });
  if (handlerResult.registered.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] Registered ${handlerResult.registered.length}: ${handlerResult.registered.join(", ")}`,
    });
  }
  if (handlerResult.errors.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] ⚠️ ${handlerResult.errors.length} error(s): ${handlerResult.errors.join("; ")}`,
    });
  }

  for (const [name, cron] of getAgentCrons()) {
    cron.onFire((entry, type) => {
      const label = type === "js" ? "JS handler" : type === "detached" ? `detached → ${entry.agent}` : "heartbeat";
      bus.emit({
        type: "info",
        message: `[cron] ${entry.name} fired (${label})`,
      });
    });

    const entries = cron.getEntries();
    if (entries.length > 0) {
      bus.emit({ type: "info", message: `[cron:${name}] Starting ${entries.length} job(s)` });
      cron.start();
    }
  }
}

// ── Telegram bot (--telegram flag to enable) ─────────────────────────

const telegramBot = TELEGRAM_ENABLED
  ? attachTelegramBot({
      bus,
      manager,
      getSessionId: () => taskSessionId ?? "",
      interfaceAgent,
    })
  : { close: () => {} };

// ── Main loop ──────────────────────────────────────────────────────────

if (!CHAT_MODE && !CRON_ENABLED) {
  // Task mode: agent already ran to completion above.
  bus.emit({ type: "info", message: `[task] Task completed. Exiting.` });
  process.exit(0);
} else if (process.stdin.isTTY) {
  // Interactive mode: readline for human input
  if (chatSession) emitPrompt();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  activeRL = rl;

  // Moved to module scope for handleInput() reset access

  rl.on("SIGINT", () => {
    if (chatSession && chatSession.isRunning() && !cancelledOnce) {
      // First Ctrl+C while sessions are running: cancel all
      cancelledOnce = true;
      bus.emit({ type: "info", message: "\n[ctrl+c] Cancelling active sessions... (press again to force quit)" });
      chatSession.cancelAll();
      for (const s of manager.status()) {
        if (s.status === "running") manager.cancel(s.sessionId);
      }
      emitPrompt();
    } else {
      // Second Ctrl+C or idle: shutdown
      gracefulShutdown();
    }
  });

  // Paste detection: accumulate rapid lines, flush as single input
  let pasteBuffer: string[] = [];
  let pasteTimer: ReturnType<typeof setTimeout> | null = null;
  const PASTE_WINDOW_MS = 50;

  const flushPaste = () => {
    pasteTimer = null;
    const joined = pasteBuffer.join("\n").trim();
    pasteBuffer = [];
    if (!joined) {
      emitPrompt();
      return;
    }
    if (joined === "exit" || joined === "quit") {
      rl.close();
      return;
    }
    handleInput(joined, "console");
  };

  rl.on("line", (line: string) => {
    pasteBuffer.push(line);
    if (pasteTimer) clearTimeout(pasteTimer);
    pasteTimer = setTimeout(flushPaste, PASTE_WINDOW_MS);
  });

  await new Promise<void>((resolve) => {
    rl.on("close", () => {
      if (pasteTimer) {
        clearTimeout(pasteTimer);
        flushPaste();
      }
      socketUI.close();
      telegramBot.close();
      resolve();
    });
  });
} else {
  // Daemon mode: no TTY, keep alive via socket + keepalive timer.
  bus.emit({
    type: "info",
    message: `[daemon] Running in daemon mode (no TTY). Interface agent: ${interfaceAgent}.${SOCKET_ENABLED ? " Use socket for control." : " Socket disabled — no external control available."}`,
  });

  setInterval(() => {}, 30_000);

  process.stdin.on("end", () => {});
  process.stdin.resume();

  await new Promise(() => {});
}
