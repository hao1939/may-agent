import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, appendFileSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager, evaluateTask, writeSkippedEvaluations } from "../src/index.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./ui/console.js";
import { attachSocketUI } from "./ui/socket.js";
import { attachTelegramBot } from "./ui/telegram.js";
import { loadAgents, reloadAgents, setAgentSessionId, getAgentSessionId, runAgentCleanup, getAgentCrons, loadAgentHandlers, type AgentLoaderOptions } from "./agent-loader.js";

const PROJECT_ROOT = resolve(process.env.PROJECT_ROOT || dirname(fileURLToPath(import.meta.url)), process.env.PROJECT_ROOT ? "." : "..");
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
const PERSIST_DIR = resolve(process.env.STATE_DIR || resolve(PROJECT_ROOT, ".state"));

// ── Instance identity ───────────────────────────────────────────────────

const INSTANCE = process.env.INSTANCE || "";
const INSTANCE_LABEL = INSTANCE || "default";

// ── Identity file ─────────────────────────────────────────────────────
// Every instance writes identity.json so callers can track it.
// All instance files live under .state/instances/<name>/.

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
  try { existing = JSON.parse(readFileSync(IDENTITY_PATH, "utf-8")); } catch {}
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
const CONSOLE_ENABLED = process.argv.includes("--console");
const SOCKET_ENABLED = process.argv.includes("--socket");
const CHAT_MODE = process.argv.includes("--chat");
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

// ── Detached sub-agent env vars ──────────────────────────────────────────
// When spawned by spawnDetachedAgent(), these env vars override defaults.
const ENV_SESSION_ID = process.env.SESSION_ID || undefined;
const ENV_PARENT_SESSION_ID = process.env.PARENT_SESSION_ID || undefined;
const ENV_PARENT_AGENT = process.env.PARENT_AGENT || undefined;

// ── Models ──────────────────────────────────────────────────────────────

const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";

const models: Record<string, any> = {
  opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: 128000,
    baseUrl: MODEL_BASE_URL,
  },
  gpt52: {
    ...getModel("openai", "gpt-5.2"),
    baseUrl: MODEL_BASE_URL,
  },
  gemini3pro: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "gemini-3-pro-preview",
    baseUrl: MODEL_BASE_URL,
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

let sid: string;

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
if (CONSOLE_ENABLED) attachConsoleUI(bus);

bus.emit({ type: "info", message: `[may.ts] Starting (pid=${process.pid}, instance=${INSTANCE_LABEL}, root=${PROJECT_ROOT})` });

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
    setAgentSessionId(agentName, sessionId);
  },
  onSessionComplete: (info) => {
    // Run cleanup for tools that track per-session resources (background_exec, socket_watch)
    runAgentCleanup(info.agent);

    // Auto-evaluate completed task trees
    // Only evaluate child sessions of the interface agent (May's children)
    // Skip meta agents (evaluator, optimizer, bob) to avoid eval loops
    if (info.parentSessionId && info.parentSessionId === sid) {
      // Debounce: wait a moment for sibling sessions to complete
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
            bus.emit({ type: "info", message: `[eval] Auto-evaluated ${result.sessionIds.length} session(s) (${agentNames}): ${verdict}` });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          bus.emit({ type: "info", message: `[eval] Auto-evaluation failed: ${msg}` });
        }
      }, 3000); // 3 second debounce for sibling sessions
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

// Write deterministic evaluations for sessions that never need LLM scoring
// (meta-agents like evaluator/optimizer/may, and sessions with no transcript).
// This is a JS shortcut that saves ~$0.05-0.15 per evaluator call.
const skipped = writeSkippedEvaluations(PERSIST_DIR);
if (skipped > 0) bus.emit({ type: "info", message: `[eval] Wrote ${skipped} skipped evaluation(s) (meta-agents/no-transcript) — no LLM needed` });

// ── Event routing ──────────────────────────────────────────────────────

const interfaceAgent = (() => {
  const idx = process.argv.indexOf("--agent");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.AGENT || "may";
})();

function attachAgentEvents(label: string, sessionId: string): void {
  const isChat = label === interfaceAgent;

  if (!isChat) {
    // Background sessions (heartbeat, cron, sub-agents): only emit a summary
    // line per turn. Suppress per-event detail to keep the terminal clean.
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

  // Chat session: full event streaming
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
        const text = event.result?.content?.[0]?.text ?? "";
        bus.emit({ type: "tool_result", agent: label, tool: event.toolName, preview: text.slice(0, 200), isError: !!event.isError, channel });
        break;
      }
    }
  });
}

// ── Socket commands ────────────────────────────────────────────────────

/** Parse @agent prefix from input. Returns [agentName, message] or [null, original]. */
function parseAgentPrefix(input: string): [string | null, string] {
  const match = input.match(/^@(\w+)\s+([\s\S]+)/);
  if (match) return [match[1], match[2]];
  return [null, input];
}

/**
 * Unified input handler. All channels (terminal, socket, telegram) route through here.
 * Handles built-in commands, @agent prefixes, and regular input to May.
 */
function handleInput(message: string): void {
  const trimmed = message.trim();
  if (!trimmed) return;

  // Built-in commands (case-insensitive for first word)
  const lower = trimmed.toLowerCase();

  if (lower === "cancel") {
    bus.emit({ type: "info", message: "[cmd] Cancel current task" });
    manager.cancel(sid);
    watchForIdle();
    return;
  }
  if (lower === "cancel all") {
    bus.emit({ type: "info", message: "[cmd] Cancel all" });
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    watchForIdle();
    return;
  }
  if (lower === "status") {
    const sessions = manager.status();
    if (sessions.length === 0) {
      bus.emit({ type: "info", message: "[status] No active sessions" });
    } else {
      const lines = sessions.map((s) =>
        `  ${s.agent} (${s.sessionId}): ${s.status} — "${s.task.slice(0, 80)}" [${s.runtime}]`
      );
      bus.emit({ type: "info", message: `[status] ${sessions.length} active session(s):\n${lines.join("\n")}` });
    }
    return;
  }
  if (lower === "reload") {
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
    return;
  }
  if (lower === "close") {
    bus.emit({ type: "info", message: "[cmd] Closing session (will not resume on restart)..." });
    manager.close(sid);
    gracefulShutdown();
    return;
  }
  if (lower === "restart") {
    bus.emit({ type: "info", message: "[cmd] Restarting (exit 100 for launcher hot-reload)..." });
    gracefulRestart();
    return;
  }

  // @agent prefix — direct agent invocation
  const [targetAgent, agentMessage] = parseAgentPrefix(trimmed);
  if (targetAgent) {
    runDirect(targetAgent, agentMessage);
    watchForIdle();
    return;
  }

  // Default: send to interface agent
  sendInput(trimmed);
  watchForIdle();
}

bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "input":
      handleInput(cmd.message);
      return { ok: true };
    case "steer": {
      // Raw steer — bypass command parsing, used for programmatic control.
      // Optional sessionId targets a specific session; default: interface agent.
      const targetSid = cmd.sessionId ?? sid;
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
      handleInput("close");
      return { ok: true };
    case "status":
      handleInput("status");
      return { ok: true };
    case "run": {
      runDirect(cmd.agent, cmd.message);
      watchForIdle();
      return { ok: true };
    }
    case "reload_agents":
      handleInput("reload");
      return { ok: true };
    case "restart":
      handleInput("restart");
      return { ok: true };
    default:
      return { ok: false, message: `Unknown command type: ${(cmd as { type: string }).type}` };
  }
});

// ── Input handling ──────────────────────────────────────────────────────

let humanInputLogFailed = false;

/**
 * Send input to the interface agent. Steers if busy, follows up if idle.
 * From the user's perspective, they just type — the runner picks the right verb.
 */
function sendInput(message: string): void {
  // Log human input (skip cron messages)
  if (!message.startsWith("[cron:")) {
    try {
      const logDir = resolve(AGENTS_ROOT, interfaceAgent, "workspace");
      mkdirSync(logDir, { recursive: true });
      const logPath = resolve(logDir, "human-inputs.md");
      const truncated = message.length > 200 ? message.slice(0, 200) : message;
      appendFileSync(logPath, `- [${new Date().toISOString()}] ${truncated}\n`);
    } catch (err) {
      if (!humanInputLogFailed) {
        humanInputLogFailed = true;
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[human-input-log] Write failed (will not retry): ${msg}` });
      }
    }
  }

  try {
    const sessions = manager.status();
    const session = sessions.find(s => s.sessionId === sid);
    if (session && session.status === "running") {
      manager.steer(sid, message, "human");
    } else {
      manager.followUp(sid, message, "human");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `Input error: ${msg}` });
  }
}

/** Run a fresh ephemeral session on any agent directly (bypasses interface agent). */
function runDirect(agentName: string, message: string): void {
  try {
    const sessionId = manager.run(agentName, message);
    bus.emit({ type: "info", message: `[direct] Started ${agentName} session: ${sessionId}` });
    // Non-blocking: don't await. Session result will be logged via onSessionComplete.
    manager.waitFor(sessionId).then(() => {
      bus.emit({ type: "info", message: `[direct] ${agentName} session completed: ${sessionId}` });
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[direct] ${agentName} session error: ${msg}` });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[direct] Error: ${msg}` });
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────

let shuttingDown = false;
let activeRL: ReturnType<typeof createInterface> | null = null;
let notificationDrainTimer: ReturnType<typeof setInterval> | undefined;

function gracefulShutdown() {
  if (shuttingDown) {
    // Second call (repeated Ctrl+C) — force exit immediately
    process.exit(1);
  }
  shuttingDown = true;
  bus.emit({ type: "info", message: `Shutting down...` });

  // Stop notification watcher
  manager.stopNotificationWatcher();
  clearInterval(notificationDrainTimer);

  // Stop all cron jobs
  for (const cron of getAgentCrons().values()) {
    cron.stop();
  }

  // Stop Telegram bot
  telegramBot.close();

  // Close readline if active (triggers rl.on("close") cleanup)
  if (activeRL) {
    activeRL.close();
    activeRL = null;
  }

  // Cancel child task sessions but leave the interface agent's
  // session intact for resume on next startup.
  for (const s of manager.status()) {
    if (s.status === "running" && s.sessionId !== sid) {
      manager.cancel(s.sessionId);
    }
  }

  // Give handleCompletion a moment to archive children, then exit
  setTimeout(() => process.exit(0), 2000);
}

// Exit code 100 = hot-reload signal to launcher.ts
// Same cleanup as gracefulShutdown, but exit 100 instead of 0
const EXIT_RELOAD = 100;

function gracefulRestart() {
  // If already restarting, force-exit immediately
  if (shuttingDown) {
    process.exit(EXIT_RELOAD);
    return;
  }
  shuttingDown = true;
  bus.emit({ type: "info", message: "Restarting (hot-reload)..." });

  manager.stopNotificationWatcher();
  clearInterval(notificationDrainTimer);
  for (const cron of getAgentCrons().values()) {
    cron.stop();
  }
  telegramBot.close();
  if (activeRL) {
    activeRL.close();
    activeRL = null;
  }
  // Cancel ALL running sessions (including the interface agent's)
  for (const s of manager.status()) {
    if (s.status === "running") {
      manager.cancel(s.sessionId);
    }
  }

  // Exit synchronously — don't rely on timers which can be starved
  // by an active agent loop (LLM streaming, compaction, etc.)
  process.exit(EXIT_RELOAD);
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
  // Update identity with exit info
  try {
    writeIdentity({
      status: code === 0 ? "done" : "error",
      exitCode: code,
      endedAt: new Date().toISOString(),
      duration: formatDurationMs(Date.now() - PROCESS_START_TIME),
    });
  } catch {}
});

// ── Interface agent selection ──────────────────────────────────────────

// Verify the interface agent is registered
if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// Chat+Task model: chat session is created explicitly via createChatSession/resumeChatSession.
// All other sessions are ephemeral task sessions (autoClose: "immediate").

// Runtime options for the chat session (compaction enabled only in chat mode)
const chatRunOpts = {
  compaction: !CHAT_MODE ? false : {
    threshold: 0.6,
    keepRatio: 0.3,
    onCompact: (info: { messagesCompacted: number; tokensBefore: number; tokensAfter: number }) => {
      bus.emit({ type: "info", message: `Compaction: ${info.messagesCompacted} messages compacted (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
    },
  },
};

// ── Socket + PID file ────────────────────────────────────────────────────

// All instance files (identity.json, PID, socket) live under .state/instances/<name>/
const INSTANCE_DIR = resolve(INSTANCES_DIR, INSTANCE_LABEL);
const sockName = `${interfaceAgent}.sock`;
const pidName = `${interfaceAgent}.pid`;
const SOCKET_PATH = resolve(INSTANCE_DIR, sockName);
const PID_PATH = resolve(INSTANCE_DIR, pidName);

// Write PID file so may.sh can manage this instance
mkdirSync(INSTANCE_DIR, { recursive: true });
writeFileSync(PID_PATH, String(process.pid), "utf-8");
const cleanupPid = () => {
  try {
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);
  } catch { /* ignore */ }
};
process.on("exit", cleanupPid);

// Socket is opt-in via --socket flag
const socketUI = SOCKET_ENABLED
  ? await attachSocketUI({
      socketPath: SOCKET_PATH,
      bus,
      manager,
      getSessionId: () => sid,
      agentName: interfaceAgent,
      instance: INSTANCE_LABEL,
    })
  : { close: () => {}, clientCount: () => 0 };

if (SOCKET_ENABLED) {
  bus.emit({ type: "info", message: `[instance:${INSTANCE_LABEL}] PID ${process.pid}, socket ${sockName}` });
} else {
  bus.emit({ type: "info", message: `[instance:${INSTANCE_LABEL}] PID ${process.pid}, socket disabled (use --socket to enable)` });
}

// ── Startup ────────────────────────────────────────────────────────────

if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED) {
  console.error("Error: need --chat, --task, or --cron.");
  process.exit(1);
}
if (INITIAL_TASK && !CHAT_MODE) {
  // Task mode: start fresh with task message, no resume
  const initialTask = INITIAL_TASK!;
  sid = manager.run(interfaceAgent, initialTask, {
    ...chatRunOpts,
    ...(ENV_SESSION_ID ? { sessionId: ENV_SESSION_ID } : {}),
    ...(ENV_PARENT_SESSION_ID ? { parentSessionId: ENV_PARENT_SESSION_ID } : {}),
    ...(ENV_PARENT_AGENT ? { parentAgentName: ENV_PARENT_AGENT } : {}),
  });
  bus.emit({ type: "info", message: `[task] Started ${interfaceAgent} task session: ${sid}` });
  await manager.waitForIdle(sid);
} else if (CHAT_MODE) {
  // Chat mode: try resume, fall back to fresh
  let resumeError: string | null = null;
  try {
    const resumed = manager.resumeChatSession(interfaceAgent, chatRunOpts);
    sid = resumed.resumed.sessionId;

    bus.emit({ type: "info", message: `Resumed ${interfaceAgent} session ${sid} (task: "${resumed.resumed.task.slice(0, 80)}")` });
    if (resumed.interrupted.length > 0) {
      bus.emit({ type: "info", message: `${resumed.interrupted.length} sub-agent session(s) marked as interrupted` });
    }

    // Wait for resume processing to complete (agent goes idle)
    await manager.waitForIdle(sid);
  } catch (err) {
    resumeError = err instanceof Error ? err.message : String(err);
  }

  if (resumeError) {
    // No session to resume — start fresh
    bus.emit({ type: "info", message: `[resume] ${resumeError}` });

    const initialTask = "Ready. Waiting for tasks.";
    sid = manager.createChatSession(interfaceAgent, initialTask, chatRunOpts);
    bus.emit({ type: "info", message: `Started ${interfaceAgent} session: ${sid}` });

    // Wait for initial processing to complete (agent goes idle)
    await manager.waitForIdle(sid);
  }
} else {
  // Cron-only mode: no session needed, just tick
  bus.emit({ type: "info", message: `[cron-only] No chat session. Running cron jobs only.` });
}

// ── Start notification watcher (after resume completes) ─────────────────
// Startup order: Load Registry → Resume Agents → Start Watcher/Drain
// fs.watch is a latency optimization; periodic drain is the reliability layer.
manager.startNotificationWatcher();
notificationDrainTimer = setInterval(() => {
  try { manager.drainNotifications(); } catch { /* best-effort */ }
}, 30_000);
notificationDrainTimer.unref();

// ── Write identity ─────────────────────────────────────────────────────

writeIdentity({
  pid: process.pid,
  agent: interfaceAgent,
  instance: INSTANCE_LABEL,
  socket: SOCKET_ENABLED ? SOCKET_PATH : "",
  startedAt: new Date().toISOString(),
  startedBy: CHAT_MODE ? "human" : (INSTANCE.startsWith("job-") ? "cron:" + INSTANCE.replace("job-", "") : "task"),
  task: INITIAL_TASK,
  status: "running",
  sessionId: sid,
});

// ── Start cron jobs (--cron to enable) ──────────────────────────────────


if (CRON_ENABLED) {
  // Auto-discover and register JS handlers from agent handler directories
  const handlerResult = await loadAgentHandlers({
    ...loaderOpts,
    getSessionId: (agentName: string) => {
      if (agentName === interfaceAgent) return sid;
      return getAgentSessionId(agentName) ?? null;
    },
  });
  if (handlerResult.registered.length > 0) {
    bus.emit({ type: "info", message: `[handlers] Registered ${handlerResult.registered.length}: ${handlerResult.registered.join(", ")}` });
  }
  if (handlerResult.errors.length > 0) {
    bus.emit({ type: "info", message: `[handlers] ⚠️ ${handlerResult.errors.length} error(s): ${handlerResult.errors.join("; ")}` });
  }

  // Start all crons with onFire notification
  for (const [name, cron] of getAgentCrons()) {
    cron.onFire((entry, type) => {
      const label = type === "js" ? "JS handler" : type === "task" ? `task → ${entry.agent}` : "heartbeat";
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
      getSessionId: () => sid,
      interfaceAgent,
    })
  : { close: () => {} };

// ── Idle prompt ────────────────────────────────────────────────────────

/**
 * Track whether the interface agent is busy so we can prompt at the right time.
 * Subscribe to the interface session to detect idle transitions.
 */
function emitPrompt(): void {
  // Notify all UI layers (telegram, etc.) that the turn is done
  bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
  if (process.stdin.isTTY) {
    const prefix = INSTANCE ? `[${INSTANCE}] ` : "";
    process.stdout.write(`\n${prefix}you> `);
  }
}

// Simpler approach: poll status briefly after each followUp completes.
// But actually — the best approach is a waitForIdle-based watcher.
// After each input, waitForIdle in the background and prompt when done.
let idleWatcher: Promise<void> | null = null;

function watchForIdle(): void {
  // Cancel any previous watcher
  idleWatcher = manager.waitForIdle(sid).then(() => {
    emitPrompt();
  }).catch(() => {
    // Session error — still prompt
    emitPrompt();
  });
}

// Watch for initial idle (only in chat mode — task mode already completed)
if (CHAT_MODE) watchForIdle();

// ── Main loop ──────────────────────────────────────────────────────────

if (!CHAT_MODE && !CRON_ENABLED) {
  // Task mode: agent already ran to completion above (waitForIdle).
  // Exit cleanly. (Cron-only mode must stay alive for timers.)
  bus.emit({ type: "info", message: `[task] Task completed. Exiting.` });
  process.exit(0);
} else if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  activeRL = rl;
  rl.on("SIGINT", () => {
    // Check if the interface agent is currently running
    const sessions = manager.status();
    const interfaceSession = sessions.find(s => s.sessionId === sid);
    if (interfaceSession && interfaceSession.status === "running") {
      // Ctrl+C while busy: cancel the task
      bus.emit({ type: "info", message: "\n[ctrl+c] Cancelling current task..." });
      manager.cancel(sid);
      // Also cancel any direct-agent sessions
      for (const s of sessions) {
        if (s.status === "running" && s.sessionId !== sid) {
          manager.cancel(s.sessionId);
        }
      }
    } else {
      // Ctrl+C when idle: shutdown
      gracefulShutdown();
    }
  });

  // Use event-based input instead of async iterator to support paste detection.
  // The async iterator (`for await (const line of rl)`) conflicts with the
  // temporary listener needed to collect pasted lines.
  let pasteBuffer: string[] = [];
  let pasteTimer: ReturnType<typeof setTimeout> | null = null;
  const PASTE_WINDOW_MS = 50;

  const flushPaste = () => {
    pasteTimer = null;
    const joined = pasteBuffer.join("\n").trim();
    pasteBuffer = [];
    if (!joined) { emitPrompt(); return; }
    if (joined === "exit" || joined === "quit") {
      rl.close();
      return;
    }
    bus.command({ type: "input", message: joined });
  };

  rl.on("line", (line: string) => {
    pasteBuffer.push(line);
    if (pasteTimer) clearTimeout(pasteTimer);
    pasteTimer = setTimeout(flushPaste, PASTE_WINDOW_MS);
  });

  // Keep the process alive until rl closes (Ctrl+D or exit/quit)
  // Single close listener: flush pending paste, cleanup UIs, then resolve.
  await new Promise<void>((resolve) => {
    rl.on("close", () => {
      if (pasteTimer) { clearTimeout(pasteTimer); flushPaste(); }
      socketUI.close();
      telegramBot.close();
      resolve();
    });
  });
} else {
  // Daemon mode: no TTY, keep alive via socket + keepalive timer.
  // Without a TTY, process.stdin is /dev/null which emits 'end' immediately.
  // We need explicit mechanisms to keep the event loop alive.
  bus.emit({ type: "info", message: `[daemon] Running in daemon mode (no TTY). Interface agent: ${interfaceAgent}.${SOCKET_ENABLED ? " Use socket for control." : " Socket disabled — no external control available."}` });

  // Keep the event loop alive. This timer is referenced (not unref'd),
  // so Node.js won't exit while it's active.
  setInterval(() => {}, 30_000);

  // Prevent stdin from causing exit
  process.stdin.on("end", () => {});
  process.stdin.resume();

  // Wait forever
  await new Promise(() => {});
}
