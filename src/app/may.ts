import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, mkdirSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import type { ModelWithApiKey } from "../lib/types.js";
import { SubagentManager, evaluateTask, writeSkippedEvaluations, writeHeuristicEvaluations, classifyError, readSessionMeta, learnFromSession, learnFromSessionLLM } from "../lib/index.js";
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
import { trackRequest } from "../lib/requests.js";
import { setLogHandler, log } from "../lib/log.js";

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
const STATUS_MODE = process.argv.includes("--status");
const SEND_MODE = process.argv.includes("--send");
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

// Bypass LiteLLM for Anthropic when ANTHROPIC_API_KEY is set.
// LiteLLM strips cache_control fields, breaking prompt caching (~40% cost savings).
// When ANTHROPIC_API_KEY is available, route directly to Anthropic's API.
const ANTHROPIC_DIRECT = process.env.ANTHROPIC_API_KEY
  ? { baseUrl: "https://api.anthropic.com", apiKey: process.env.ANTHROPIC_API_KEY }
  : { baseUrl: MODEL_BASE_URL, apiKey: LITELLM_API_KEY };

const models: Record<string, ModelWithApiKey> = {
  opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: process.env.ANTHROPIC_API_KEY ? 200000 : 72000, // Direct API: full 200K; LiteLLM: 72K proxy limit
    baseUrl: ANTHROPIC_DIRECT.baseUrl,
    apiKey: ANTHROPIC_DIRECT.apiKey,
  },
  gpt52: {
    ...getModel("openai", "gpt-5.2"),
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  gpt54: {
    ...getModel("openai", "gpt-5.2"),
    api: "openai-responses" as const,
    id: "gpt-5.4",
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  gemini3pro: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "gemini-3.1-pro-preview",
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
  },
  gemini3flash: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "gemini-3-flash-preview",
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

// DB writer subscriber — persists events to SQLite
import { DbWriter } from "../lib/db-writer.js";
const dbWriter = new DbWriter(PERSIST_DIR);
bus.subscribe(dbWriter.handler);

setLogHandler((level, message) => {
  if (level === "debug") return; // debug logs don't reach the event system
  bus.emit({ type: "log", level: level as "info" | "warn" | "error", message });
});
if (CONSOLE_ENABLED) attachConsoleUI(bus, () => taskSessionId ?? chatSession?.getSessionId() ?? null, CHAT_MODE);

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

// ── Session Recovery Tracking (Ambulance Protocol — P62) ────────────────
// Track how many times a task has been auto-recovered to prevent infinite loops.
// Key: "agent:taskHash", Value: recovery attempt count.
const recoveryAttempts = new Map<string, number>();
const MAX_RECOVERY_ATTEMPTS = 2;

function recoveryKey(agent: string, task: string): string {
  // Use first 100 chars of task to create a stable key
  return `${agent}:${task.slice(0, 100)}`;
}

// Late-bound Telegram alert function — set after telegramBot is created (line order constraint).
// When Telegram is absent, alerts are still persisted to escalations.jsonl (see below).
let telegramAlert: (text: string) => void = () => {};

/** Persist an escalation event and push to Telegram if available. */
function escalateToHuman(agent: string, reason: string): void {
  // 1. Always persist — survives restarts, Telegram outages, etc.
  const escalationPath = resolve(PERSIST_DIR, "escalations.jsonl");
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    agent,
    reason,
    notified: TELEGRAM_ENABLED,
  });
  try { appendFileSync(escalationPath, entry + "\n", "utf-8"); } catch { /* best-effort */ }

  // 2. Push to Telegram if available (best-effort, non-blocking)
  telegramAlert(`⚠️ *Agent Blocked*\n${agent} — ${reason}`);
}

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

      // ── Session Drop Recovery (Ambulance Protocol — P62) ──
      // If error is transient infrastructure failure, auto-requeue the task.
      const errorClass = classifyError(info.error);
      if (errorClass === "infra") {
        const rKey = recoveryKey(info.agent, info.task);
        const attempts = recoveryAttempts.get(rKey) || 0;
        if (attempts < MAX_RECOVERY_ATTEMPTS) {
          try {
            recoveryAttempts.set(rKey, attempts + 1);
            const newSessionId = manager.run(info.agent, info.task, { kind: "job" });
            bus.emit({
              type: "info",
              message: `[recovery] 🚑 Requeued ${info.agent} session ${info.sessionId} → ${newSessionId} (infra error, attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS})`,
            });
          } catch (requeueErr) {
            const msg = requeueErr instanceof Error ? requeueErr.message : String(requeueErr);
            bus.emit({
              type: "info",
              message: `[recovery] ❌ Failed to requeue ${info.agent}: ${msg}`,
            });
          }
        } else {
          bus.emit({
            type: "info",
            message: `[recovery] ⛔ ${info.agent} exhausted ${MAX_RECOVERY_ATTEMPTS} recovery attempts for task — escalating`,
          });
          escalateToHuman(info.agent, `exhausted ${MAX_RECOVERY_ATTEMPTS} recovery retries`);
        }
      }
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

            // Emit context-learn events for each evaluated agent
            for (const sessionId of result.sessionIds) {
              const meta = readSessionMeta(PERSIST_DIR, sessionId);
              if (meta && meta.agent) {
                bus.emit({ type: "context-learn", agentName: meta.agent, sessionId, persistDir: PERSIST_DIR });
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          bus.emit({ type: "info", message: `[eval] Auto-evaluation failed: ${msg}` });
        }
      }, 3000);
    }
  },
  onSessionBlocked: (agentName, sessionId, reason) => {
    bus.emit({ type: "info", message: `[escalation] ⚠️ ${agentName} session ${sessionId} blocked/failed: ${reason}` });
    // Track escalation as a request targeting May
    try {
      trackRequest(PERSIST_DIR, {
        fromEntity: agentName,
        toAgent: "may",
        task: `[escalation] ${agentName} session ${sessionId} — ${reason}`,
        method: "send",
        sessionId,
      });
    } catch { /* best-effort */ }

    // Push notification to human via Telegram
    escalateToHuman(agentName, reason);
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

const loadResult = await loadAgents(loaderOpts);
bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

writeSkippedEvaluations(PERSIST_DIR).then((skipped) => {
  if (skipped > 0)
    bus.emit({
      type: "info",
      message: `[eval] Wrote ${skipped} skipped evaluation(s) (meta-agents/no-transcript) — no LLM needed`,
    });
});

writeHeuristicEvaluations(PERSIST_DIR).then((written) => {
  if (written > 0)
    bus.emit({
      type: "info",
      message: `[eval] Wrote ${written} heuristic evaluation(s) (deterministic scoring from transcripts)`,
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
        bus.emit({ type: "tool_call", sessionId, agent: label, tool: event.toolName, args: event.args });
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          bus.emit({ type: "text", sessionId, agent: label, text: event.assistantMessageEvent.delta });
        }
        break;
      case "tool_execution_end": {
        const blocks = event.result?.content ?? [];
        const firstReal = blocks.find(
          (b: any) => b?.type === "text" && !b.text?.startsWith("<tool_output") && b.text !== "</tool_output>",
        );
        const text = firstReal?.text ?? "";
        bus.emit({
          type: "tool_result",
          sessionId,
          agent: label,
          tool: event.toolName,
          preview: text.slice(0, 200),
          isError: !!event.isError,
        });
        break;
      }
      case "turn_end": {
        const durationMs = Date.now() - turnStart;
        bus.emit({ type: "turn_end", sessionId, agent: label, toolCalls, durationMs });
        break;
      }
    }
  });
}

// ── Context Learning (event-driven) ────────────────────────────────────
// Listen for "context-learn" events and extract durable facts from the session.
// Enabled per-agent via CONTEXT_LEARN_AGENTS env var (comma-separated, default: none).
// Set CONTEXT_LEARN_AGENTS=all to enable for all agents.
// Uses LLM (evaluator agent) for extraction; falls back to mechanical if LLM unavailable.

const contextLearnAgents = new Set(
  (process.env.CONTEXT_LEARN_AGENTS ?? "").split(",").map(s => s.trim()).filter(Boolean),
);

bus.on((event) => {
  if (event.type !== "context-learn") return;
  const { agentName, sessionId, persistDir } = event;

  // Filter: only learn for enabled agents
  if (!contextLearnAgents.has("all") && !contextLearnAgents.has(agentName)) return;
  // Never learn from meta-agents
  if (["evaluator", "coach", "judge"].includes(agentName)) return;

  setTimeout(async () => {
    try {
      const { readSessionMessages, readSessionMeta: readMeta } = require("../lib/index.js") as typeof import("../lib/index.js");
      const messages = readSessionMessages(persistDir, sessionId);
      if (messages.length === 0) return;

      const agentDir = resolve(AGENTS_ROOT, agentName);
      if (!existsSync(agentDir)) return;

      const meta = readMeta(persistDir, sessionId);
      const task = meta?.task ?? "";

      // Try LLM extraction (evaluator agent), fall back to mechanical
      let result: { added: string[]; removed: string[] };
      try {
        result = await learnFromSessionLLM({
          agentDir,
          messages: messages as Parameters<typeof learnFromSessionLLM>[0]["messages"],
          agentName,
          task,
          manager,
        });
      } catch {
        result = learnFromSession({
          agentDir,
          messages: messages as Parameters<typeof learnFromSession>[0]["messages"],
        });
      }

      if (result.added.length > 0 || result.removed.length > 0) {
        const parts: string[] = [];
        if (result.added.length > 0) parts.push(`+${result.added.length} added`);
        if (result.removed.length > 0) parts.push(`-${result.removed.length} removed`);
        bus.emit({
          type: "info",
          message: `[context-learn] ${agentName}: ${parts.join(", ")} from session ${sessionId}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[context-learn] Error for ${agentName}/${sessionId}: ${msg}` });
    }
  }, 1000);
});

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

async function handleReload(): Promise<void> {
  const result = await reloadAgents(loaderOpts);
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

// ── Core command subscriber — handles commands from the EventBus ────────
bus.subscribe((event) => {
  switch (event.type) {
    case "input":
      handleInput(event.message ?? event.text ?? "", event.source);
      break;
    case "steer": {
      const targetSid = event.sessionId;
      const steerText = event.message ?? event.text ?? "";
      if (!targetSid) break;
      try {
        const sessions = manager.status();
        const target = sessions.find(s => s.sessionId === targetSid);
        if (target?.status === "idle") {
          manager.input(targetSid, steerText);
        } else {
          manager.steer(targetSid, steerText, "human");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "log", level: "error", message: `[steer] ${msg}` });
      }
      break;
    }
    case "cancel":
      if (event.sessionId) manager.cancel(event.sessionId);
      break;
    case "cancel_all":
      handleInput("cancel all");
      break;
    case "fork":
      if ("agent" in event && "task" in event) {
        if (chatSession) {
          chatSession.handleInput(`@${event.agent} ${event.task}`, "socket");
        } else {
          const sessionId = manager.run(event.agent, event.task, { kind: "job" });
          bus.emit({ type: "log", level: "info", message: `[fork] Started ${event.agent} session: ${sessionId}` });
        }
      }
      break;
    case "reload":
      handleReload();
      break;
    case "restart":
      gracefulRestart();
      break;
    case "shutdown":
      gracefulShutdown();
      break;
  }
});

// ── Backward compat: old command handler for socket.ts ──────────────────
// Socket.ts still uses bus.command() for request/response commands (status, subscribe).
// These will be migrated to direct DB reads in a future phase.
bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "input":
      handleInput((cmd as any).message ?? (cmd as any).text ?? "", (cmd as any).source);
      return { ok: true };
    case "steer": {
      const targetSid = (cmd as any).sessionId;
      const steerText = (cmd as any).message ?? (cmd as any).text ?? "";
      if (!targetSid) return { ok: false, message: "steer requires sessionId" };
      try {
        const sessions = manager.status();
        const target = sessions.find(s => s.sessionId === targetSid);
        if (target?.status === "idle") {
          manager.input(targetSid, steerText);
        } else {
          manager.steer(targetSid, steerText, "human");
        }
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: msg };
      }
    }
    case "cancel":
      if ((cmd as any).sessionId) manager.cancel((cmd as any).sessionId);
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
      if (chatSession) {
        chatSession.handleInput(`@${(cmd as any).agent} ${(cmd as any).message}`, "socket");
      } else {
        let requestId: string | undefined;
        try {
          requestId = trackRequest(PERSIST_DIR, {
            fromEntity: "human",
            toAgent: (cmd as any).agent,
            task: (cmd as any).message,
            method: "call",
            source: "socket",
          });
        } catch { /* non-fatal */ }
        const sessionId = manager.run((cmd as any).agent, (cmd as any).message, { kind: "job", requestId });
        bus.emit({ type: "log", level: "info", message: `[direct] Started ${(cmd as any).agent} session: ${sessionId}` });
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
      getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
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

if (SEND_MODE) {
  // ── Send mode: deliver message to agent and exit ───────────────────
  const { parseSendArgs, cliSend } = await import("./cli-send.js");
  const sendOpts = parseSendArgs(process.argv);
  if (sendOpts) {
    sendOpts.persistDir = PERSIST_DIR;
    sendOpts.agentsRoot = AGENTS_ROOT;
    await cliSend(sendOpts);
  }
  process.exit(0);
}

if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED && !ONESHOT_MODE) {
  console.error("Error: need --chat, --task, --oneshot, --status, --send, or --cron.");
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

  taskSessionId = manager.run(interfaceAgent, oneshotTask, { kind: "job", requestId: (() => {
    try { return trackRequest(PERSIST_DIR, { fromEntity: "human", toAgent: interfaceAgent, task: oneshotTask, method: "call", source: "cli-oneshot" }); } catch { return undefined; }
  })() });

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
  const status = (session?.status === "error" || session?.status === "interrupted") ? "error" : "success";

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
  let taskRequestId: string | undefined;
  // Only track as human request if not a detached sub-agent (those have ENV_PARENT_SESSION_ID)
  if (!ENV_PARENT_SESSION_ID) {
    try { taskRequestId = trackRequest(PERSIST_DIR, { fromEntity: "human", toAgent: interfaceAgent, task: INITIAL_TASK, method: "call", source: "cli-task" }); } catch { /* non-fatal */ }
  }
  taskSessionId = manager.run(interfaceAgent, INITIAL_TASK, {
    kind: "job",
    requestId: taskRequestId,
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
  const { resumed, interrupted } = manager.resumeStaleSessions({ kinds: ["job"] });
  // Clean up orphaned non-job sessions (call) — these have no trigger to self-resume.
  // Chat sessions are handled separately: in CHAT_MODE they're resumed, otherwise interrupted.
  const { interrupted: orphansCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["call"] });
  if (!CHAT_MODE) {
    // Daemon mode: also clean up orphaned chat sessions
    const { interrupted: chatCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["chat"] });
    orphansCleaned.push(...chatCleaned);
  } else {
    // Chat mode: resume idle chat sessions (preserves conversation history)
    const { resumed: chatResumed } = manager.resumeStaleSessions({ kinds: ["chat"] });
    resumed.push(...chatResumed);
    // Now that sessions are loaded, let ChatSession attach to the newest
    // and close orphan duplicates
    if (chatSession) chatSession.resumeAfterLoad();
  }
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
  if (orphansCleaned.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Cleaned up ${orphansCleaned.length} orphaned session(s): ${orphansCleaned.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }

  // Archive zombie sessions: dirs in sessions/ with terminal status that were never archived
  const zombiesArchived = manager.cleanupZombieSessions();
  if (zombiesArchived > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Archived ${zombiesArchived} zombie session(s) with terminal status`,
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
      getSessionId: () => taskSessionId ?? chatSession?.getSessionId() ?? "",
      interfaceAgent,
    })
  : { close: () => {}, sendAlert: () => {} };

// Wire late-bound Telegram alert now that telegramBot is initialized
telegramAlert = (text: string) => telegramBot.sendAlert(text);

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
