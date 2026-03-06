import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, appendFileSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager, evaluateTask, writeSkippedEvaluations } from "../src/index.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./console-ui.js";
import { attachSocketUI } from "./socket-ui.js";
import { attachOpenClawUI } from "./openclaw-ui.js";
import { attachTelegramBot } from "./telegram-ui.js";
import { loadAgents, reloadAgents, setAgentSessionId, runAgentCleanup, getAgentCrons, type AgentLoaderOptions } from "./agent-loader.js";
import { handleSystemStatus } from "./system-status.js";
import { handleEvaluateSessions } from "./evaluate-sessions.js";
import { createDrainTodoHandler } from "./drain-todo.js";

const PROJECT_ROOT = resolve(process.env.PROJECT_ROOT || dirname(fileURLToPath(import.meta.url)), process.env.PROJECT_ROOT ? "." : "..");
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
const PERSIST_DIR = resolve(process.env.STATE_DIR || resolve(PROJECT_ROOT, ".state"));

// ── Instance identity ───────────────────────────────────────────────────

const INSTANCE = process.env.INSTANCE || "";
const INSTANCE_LABEL = INSTANCE || "default";

// ── Identity file ─────────────────────────────────────────────────────
// Every instance writes identity.json so callers can track it.

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

const IDENTITY_PATH = resolve(PERSIST_DIR, INSTANCE_LABEL, "identity.json");
const PROCESS_START_TIME = Date.now();

function writeIdentity(data: Partial<InstanceIdentity>): void {
  const dir = resolve(PERSIST_DIR, INSTANCE_LABEL);
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
const SCHEDULERS_ENABLED = process.argv.includes("--cron");
const TASK_MODE = (() => {
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
attachConsoleUI(bus);

// ── OpenClaw bridge (OPENCLAW_TARGET=<id> to enable) ────────────────────

let openclawUI: ReturnType<typeof attachOpenClawUI> | null = null;
if (process.env.OPENCLAW_TARGET) {
  openclawUI = attachOpenClawUI({ bus, interfaceAgent: process.env.AGENT || "may" });
  bus.emit({ type: "info", message: `[openclaw-ui] Enabled — sending to ${process.env.OPENCLAW_CHANNEL || "telegram"}:${process.env.OPENCLAW_TARGET}` });
}

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
  schedulersEnabled: SCHEDULERS_ENABLED,
};

const loadResult = loadAgents(loaderOpts);
bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

// Write deterministic evaluations for sessions that never need LLM scoring
// (meta-agents like evaluator/optimizer/may, and sessions with no transcript).
// This is a JS shortcut that saves ~$0.05-0.15 per evaluator call.
const skipped = writeSkippedEvaluations(PERSIST_DIR);
if (skipped > 0) bus.emit({ type: "info", message: `[eval] Wrote ${skipped} skipped evaluation(s) (meta-agents/no-transcript) — no LLM needed` });

// ── Event routing ──────────────────────────────────────────────────────

const interfaceAgent = process.env.AGENT || "may";

function attachAgentEvents(label: string, sessionId: string): void {
  manager.subscribe(sessionId, (event) => {
    // Tag interface agent's assistant text as "chat" channel
    const channel = label === interfaceAgent ? "chat" as const : undefined;

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
        bus.emit({ type: "tool_call", agent: label, tool: event.toolName, args: event.args });
        break;
      case "tool_execution_end": {
        const text = event.result?.content?.[0]?.text ?? "";
        bus.emit({ type: "tool_result", agent: label, tool: event.toolName, preview: text.slice(0, 200), isError: !!event.isError });
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
      break;
    case "steer":
      // Raw steer — bypass command parsing, used for programmatic control
      try {
        manager.steer(sid, cmd.message, "human");
      } catch {
        bus.emit({ type: "info", message: "[steer] Cannot steer — session not running" });
      }
      break;
    case "cancel":
      bus.emit({ type: "info", message: `[cmd] Cancel: ${cmd.sessionId}` });
      manager.cancel(cmd.sessionId);
      break;
    case "cancel_all":
      handleInput("cancel all");
      break;
    case "cancel_task":
      handleInput("cancel");
      break;
    case "close":
      handleInput("close");
      break;
    case "status":
      handleInput("status");
      break;
    case "run": {
      runDirect(cmd.agent, cmd.message);
      watchForIdle();
      break;
    }
    case "reload_agents":
      handleInput("reload");
      break;
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

function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const stack = new Error("gracefulShutdown trace").stack;
  bus.emit({ type: "info", message: `Shutting down...\n${stack}` });

  // Stop all cron jobs
  for (const cron of getAgentCrons().values()) {
    cron.stop();
  }

  // Stop Telegram bot
  telegramBot.close();

  // Cancel non-persistent child sessions but leave the interface agent's
  // persistent session intact for resume on next startup.
  for (const s of manager.status()) {
    if (s.status === "running" && s.sessionId !== sid) {
      manager.cancel(s.sessionId);
    }
  }

  // Give handleCompletion a moment to archive children, then exit
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", () => {
  bus.emit({ type: "info", message: "[signal] SIGINT received" });
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
  const err = new Error("exit trace");
  console.error(`[exit] Process exiting with code ${code}\n${err.stack}`);
});

// ── Interface agent selection ──────────────────────────────────────────

// Verify the interface agent is registered
if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// Runtime options for the interface agent's session
const interfaceRunOpts = {
  persistent: !TASK_MODE,  // task mode = non-persistent (ephemeral)
  compaction: TASK_MODE ? false : {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info: { messagesCompacted: number; tokensBefore: number; tokensAfter: number }) => {
      bus.emit({ type: "info", message: `Compaction: ${info.messagesCompacted} messages compacted (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
    },
  },
};

// ── Socket + PID file ────────────────────────────────────────────────────

// Socket name: may.sock (default) or may.<instance>.sock (named)
const sockName = INSTANCE ? `${interfaceAgent}.${INSTANCE}.sock` : `${interfaceAgent}.sock`;
const pidName = INSTANCE ? `${interfaceAgent}.${INSTANCE}.pid` : `${interfaceAgent}.pid`;
const SOCKET_PATH = resolve(PERSIST_DIR, sockName);
const PID_PATH = resolve(PERSIST_DIR, pidName);

// Write PID file so may.sh can manage this instance
mkdirSync(PERSIST_DIR, { recursive: true });
writeFileSync(PID_PATH, String(process.pid), "utf-8");
const cleanupPid = () => {
  try {
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);
  } catch { /* ignore */ }
};
process.on("exit", cleanupPid);

const socketUI = await attachSocketUI({
  socketPath: SOCKET_PATH,
  bus,
  manager,
  getSessionId: () => sid,
});

bus.emit({ type: "info", message: `[instance:${INSTANCE_LABEL}] PID ${process.pid}, socket ${sockName}` });

// ── Startup ────────────────────────────────────────────────────────────

if (TASK_MODE) {
  // Task mode: start fresh with task message, no resume
  const initialTask = TASK_MODE;
  sid = manager.run(interfaceAgent, initialTask, interfaceRunOpts);
  bus.emit({ type: "info", message: `[task] Started ${interfaceAgent} task session: ${sid}` });
  await manager.waitForIdle(sid);
} else {
  // Interactive mode: try resume, fall back to fresh
  let resumeError: string | null = null;
  try {
    const resumed = manager.resumeAgent(interfaceAgent, interfaceRunOpts);
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
    sid = manager.run(interfaceAgent, initialTask, interfaceRunOpts);
    bus.emit({ type: "info", message: `Started persistent ${interfaceAgent} session: ${sid}` });

    // Wait for initial processing to complete (agent goes idle)
    await manager.waitForIdle(sid);
  }
}

// ── Write identity ─────────────────────────────────────────────────────

writeIdentity({
  pid: process.pid,
  agent: interfaceAgent,
  instance: INSTANCE_LABEL,
  socket: resolve(PERSIST_DIR, INSTANCE_LABEL + ".sock"),
  startedAt: new Date().toISOString(),
  startedBy: TASK_MODE ? (INSTANCE.startsWith("job-") ? "cron:" + INSTANCE.replace("job-", "") : "task") : "human",
  task: TASK_MODE || null,
  status: "running",
  sessionId: sid,
});

// ── Start cron jobs (SCHEDULERS=1 to enable) ───────────────────────────

if (SCHEDULERS_ENABLED) {
  for (const [name, cron] of getAgentCrons()) {
    // Register JS handlers for formulaic cron jobs (LLM-to-JS #3)
    if (name === "may") {
      cron.registerHandler("system-status", async () => {
        await handleSystemStatus({
          persistDir: PERSIST_DIR,
          projectRoot: PROJECT_ROOT,
          agentsRoot: AGENTS_ROOT,
          healthLogPath: resolve(AGENTS_ROOT, "may", "workspace", "health-log.md"),
        });
        bus.emit({ type: "text", agent: "may", channel: "chat" as any, message: "✅ [cron:system-status] Health check completed — see health-log.md" });
      });
      bus.emit({ type: "info", message: `[cron:may] Registered JS handler for system-status (no LLM needed)` });
      cron.registerHandler("evaluate-sessions", async () => {
        const result = await handleEvaluateSessions({
          persistDir: PERSIST_DIR,
          manager,
          onLog: (msg) => bus.emit({ type: "info", message: msg }),
        });
        if (result.sessionsEvaluated > 0 || result.skipped > 0) {
          bus.emit({ type: "text", agent: "may", channel: "chat" as any, message: `✅ [cron:evaluate-sessions] ${result.skipped} skipped, ${result.sessionsEvaluated} evaluated, ${result.errors.length} errors` });
        }
      });
      bus.emit({ type: "info", message: `[cron:may] Registered JS handler for evaluate-sessions (no LLM needed)` });

      // Register JS handlers for drain-todo cron jobs (LLM-to-JS #4)
      const drainTodoOpts = {
        agentsRoot: AGENTS_ROOT,
        manager,
        onLog: (msg: string) => bus.emit({ type: "text", agent: "may", channel: "chat" as any, message: `📋 ${msg}` }),
      };

      // May self-drain: followUp into May's own persistent session
      cron.registerHandler("drain-todo", createDrainTodoHandler(
        { sourceAgent: "may", targetAgent: "may", mode: "followUp", getSessionId: () => sid },
        drainTodoOpts,
      ));

      // Optimizer drain: spawn new optimizer session
      cron.registerHandler("optimizer-drain-todo", createDrainTodoHandler(
        { sourceAgent: "optimizer", targetAgent: "optimizer", mode: "run" },
        drainTodoOpts,
      ));

      // Bob drain: spawn new bob session
      cron.registerHandler("bob-drain-todo", createDrainTodoHandler(
        { sourceAgent: "bob", targetAgent: "bob", mode: "run" },
        drainTodoOpts,
      ));

      bus.emit({ type: "info", message: `[cron:may] Registered JS handlers for drain-todo, optimizer-drain-todo, bob-drain-todo (no LLM needed)` });
    }
    // Notify on job fire (goes to Telegram via bus)
    cron.onFire((entry, type) => {
      const emoji = type === "js" ? "⚡" : type === "task" ? "🚀" : "💓";
      const label = type === "js" ? "JS handler" : type === "task" ? `task → ${entry.agent}` : "heartbeat";
      bus.emit({
        type: "text",
        agent: "may",
        channel: "chat" as any,
        message: `${emoji} [cron] ${entry.name} fired (${label})`,
      });
    });

    const entries = cron.getEntries();
    if (entries.length > 0) {
      bus.emit({ type: "info", message: `[cron:${name}] Starting ${entries.length} job(s)` });
      cron.start();
    }
  }
}

// ── Heartbeat timer ──────────────────────────────────────────────────────

if (!TASK_MODE) {
  // Read heartbeatMs from agent.json
  const agentConfigPath = resolve(AGENTS_ROOT, interfaceAgent, "agent.json");
  try {
    const agentConfig = JSON.parse(readFileSync(agentConfigPath, "utf-8"));
    if (agentConfig.heartbeatMs && agentConfig.heartbeatMs >= 60_000) {
      const heartbeatFile = resolve(AGENTS_ROOT, interfaceAgent, "heartbeat.md");
      if (existsSync(heartbeatFile)) {
        const timer = setInterval(() => {
          const msg = `[heartbeat] Read ${heartbeatFile} and work through each section. This is your periodic wake-up.`;
          try {
            manager.followUp(sid, msg, "system");
            watchForIdle();
            bus.emit({ type: "info", message: `[heartbeat] Fired for ${interfaceAgent}` });
          } catch (err) {
            bus.emit({ type: "info", message: `[heartbeat] Failed: ${err}` });
          }
        }, agentConfig.heartbeatMs);
        timer.unref();
        bus.emit({ type: "info", message: `[heartbeat] Enabled for ${interfaceAgent} (every ${Math.round(agentConfig.heartbeatMs / 60000)}min)` });
      }
    }
  } catch {}
}

// ── Telegram bot (TELEGRAM_BOT_TOKEN to enable) ─────────────────────────

const telegramBot = attachTelegramBot({
  bus,
  manager,
  getSessionId: () => sid,
  interfaceAgent,
});

// ── Idle prompt ────────────────────────────────────────────────────────

/**
 * Track whether the interface agent is busy so we can prompt at the right time.
 * Subscribe to the interface session to detect idle transitions.
 */
function emitPrompt(): void {
  // Notify all UI layers (telegram, openclaw, etc.) that the turn is done
  bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
  if (process.stdin.isTTY) {
    const prefix = INSTANCE ? `[${INSTANCE}] ` : "";
    process.stdout.write(`\n${prefix}you> `);
  }
}

// Emit prompt when the interface agent finishes processing (skip in task mode)
if (!TASK_MODE) {
  manager.subscribe(sid, (event) => {
    if (event.type === "turn_end") {
      // Check if this is the last turn (agent going idle).
      // We detect this by checking if the stop reason indicates natural end.
      // The handleCompletion in manager sets status to "idle" for persistent sessions.
    }
  });
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

// Watch for initial idle (skip in task mode — session already complete)
if (!TASK_MODE) watchForIdle();

// ── Main loop ──────────────────────────────────────────────────────────

if (TASK_MODE) {
  // Task mode: agent already ran to completion above (waitForIdle).
  // Exit cleanly.
  bus.emit({ type: "info", message: `[task] Task completed. Exiting.` });
  process.exit(0);
} else if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

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

  for await (const line of rl) {
    const input = line.trim();
    if (input === "exit" || input === "quit") break;
    if (!input) { emitPrompt(); continue; }

    // All input goes through the unified handler via bus command
    bus.command({ type: "input", message: input });
  }

  socketUI.close();
  openclawUI?.close();
  telegramBot.close();
  rl.close();
} else {
  // Daemon mode: no TTY, keep alive via socket + keepalive timer.
  // Without a TTY, process.stdin is /dev/null which emits 'end' immediately.
  // We need explicit mechanisms to keep the event loop alive.
  bus.emit({ type: "info", message: `[daemon] Running in daemon mode (no TTY). Interface agent: ${interfaceAgent}. Use socket for control.` });

  // Keep the event loop alive. This timer is referenced (not unref'd),
  // so Node.js won't exit while it's active.
  setInterval(() => {}, 30_000);

  // Prevent stdin from causing exit
  process.stdin.on("end", () => {});
  process.stdin.resume();

  // Wait forever
  await new Promise(() => {});
}
