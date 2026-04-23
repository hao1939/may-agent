import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, mkdirSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import type { ModelWithApiKey } from "../lib/types.js";
import {
  SubagentManager,
} from "../lib/index.js";
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
  generateAutoHeartbeats,
  loadAgentHandlers,
  type AgentLoaderOptions,
} from "./agent-loader.js";
import { resolveProjectRoot } from "./bundle-mode.js";
import { trackRequest, getDb } from "../lib/requests.js";
import { log } from "../lib/log.js";

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
  // Overwrite completely — don't merge with previous process's state.
  // Merging causes stale status (e.g., previous process wrote "error",
  // new process startup writes "running" but other fields leak through).
  writeFileSync(IDENTITY_PATH, JSON.stringify(data, null, 2));
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
const WEB_ENABLED = process.argv.includes("--web");
const CHAT_MODE = process.argv.includes("--chat");
const ONESHOT_MODE = process.argv.includes("--oneshot");
const STATUS_MODE = process.argv.includes("--status");
const MESSAGE_MODE = process.argv.includes("--message");
const EMIT_MODE = (() => {
  const idx = process.argv.indexOf("--emit");
  if (idx !== -1 && process.argv[idx + 1]) {
    return { event: process.argv[idx + 1], data: process.argv[idx + 2] ? JSON.parse(process.argv[idx + 2]) : undefined };
  }
  return null;
})();
const RUN_WORKFLOW = (() => {
  const idx = process.argv.indexOf("--run-workflow");
  if (idx !== -1 && process.argv[idx + 1]) {
    return { name: process.argv[idx + 1], input: process.argv[idx + 2] || "" };
  }
  return null;
})();
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
  kimi: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "kimi-k2.5",
    contextWindow: 262144,
    baseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
    apiKey: process.env.KIMI_API_KEY || "",
  },
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();

// DB writer subscriber — persists events to SQLite
import { DbWriter } from "../lib/db-writer.js";
const dbWriter = new DbWriter(PERSIST_DIR);
bus.subscribe(dbWriter.handler);

// Session lifecycle subscribers — decoupled side effects
import {
  createContextUpdater,
  createRequestTracker,
  createStuckDetector,
  createAutoResume,
  createDigestWriter,
  createLastSessionWriter,
  createFileReadTracker,
  createFindingsTracker,
} from "../lib/session-subscribers.js";
bus.subscribe(createContextUpdater(PROJECT_ROOT));
bus.subscribe(createRequestTracker(PERSIST_DIR));
bus.subscribe(createDigestWriter(PERSIST_DIR));
bus.subscribe(createLastSessionWriter(PROJECT_ROOT));
bus.subscribe(createFileReadTracker(PERSIST_DIR));
bus.subscribe(createFindingsTracker(PROJECT_ROOT, PERSIST_DIR));
bus.subscribe(createStuckDetector(
  (sessionId, _reason) => {
    bus.emit({ type: "cancel", sessionId } as any);
  },
  (agent, sessionId, reason) => {
    // Circuit-breaker → diagnosis feedback loop: notify May to investigate
    bus.emit({
      type: "message_created",
      fromEntity: "system:circuit-breaker",
      toAgent: "may",
      method: "notify",
      task: `[circuit-breaker] Agent "${agent}" terminated (session ${sessionId}): ${reason}. Investigate the root cause — check the session transcript, recent errors, and whether the agent needs guidance or a code fix.`,
      source: "circuit-breaker",
      priority: "P1",
    } as any);
  },
  PERSIST_DIR,
  () => manager,
));
bus.subscribe(createAutoResume(
  (sessionId, agent, _attempt) => {
    const ok = manager.resumeInterrupted(sessionId);
    if (ok) {
      log("info", `[resume] Resumed ${agent} session ${sessionId}`);
    } else {
      log("warn", `[resume] Failed to resume ${sessionId}`);
    }
  },
  (agent, _sessionId, reason) => {
    log("warn", `[resume] ${agent} exhausted resume attempts — escalating`);
    // Persist + notify (same as RuntimeCtx.escalate)
    try {
      const escalationPath = resolve(PERSIST_DIR, "escalations.jsonl");
      appendFileSync(escalationPath, JSON.stringify({ ts: new Date().toISOString(), agent, reason, notified: true }) + "\n", "utf-8");
    } catch { /* best-effort */ }
    bus.emit({ type: "notification", agent: "may", text: `⚠️ *Agent Blocked*\n${agent} — ${reason}` });
  },
  PERSIST_DIR,
  () => manager,
));

let taskSessionId: string | undefined;
let chatSession: ChatSession | undefined;

if (CONSOLE_ENABLED) attachConsoleUI(bus, () => taskSessionId ?? chatSession?.getSessionId() ?? null, CHAT_MODE);

// Web UI — runs in-process when --web is passed
if (WEB_ENABLED) {
  const webPort = parseInt(process.env.WEB_PORT || "8080", 10);
  const { startWebUI } = await import("./ui/web.js");
  const { port } = startWebUI({ stateDir: PERSIST_DIR, port: webPort });
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

// Agent-loader bookkeeping (track active session IDs, run cleanup on completion)
bus.subscribe((event) => {
  if (event.type === "session_start" && "agent" in event && "sessionId" in event) {
    setAgentSessionId(event.agent as string, event.sessionId as string);
  }
  if (event.type === "session_end" && "agent" in event) {
    runAgentCleanup(event.agent as string);
  }
});

// ── Session lifecycle → agent events (thin translator) ────────────────
// Classifies session_end bus events and emits agent-level events for handlers.
// Actual decision logic lives in handlers: session-recovery, session-eval, escalation.
bus.subscribe((event) => {
  if (event.type !== "session_end") return;
  const info = event as any;

  // Translate → session.failed (for recovery handler)
  if (info.error && info.status === "error") {
    bus.emit({ type: "emit", event: "session.failed", data: {
      sessionId: info.sessionId, agent: info.agent, error: info.error, task: info.task,
    }} as any);
  }

  // Translate → session.escalated (for escalation handler)
  const fp = info.finishParams;
  if (fp && (fp.status === "blocked" || fp.status === "failure")) {
    bus.emit({ type: "emit", event: "session.escalated", data: {
      sessionId: info.sessionId, agent: info.agent, finishParams: fp,
    }} as any);
  }

  // Translate → session.completed (for eval handler)
  if (info.parentSessionId && info.agent !== "evaluator") {
    bus.emit({ type: "emit", event: "session.completed", data: {
      sessionId: info.sessionId, agent: info.agent,
      parentSessionId: info.parentSessionId, outcome: info.outcome,
    }} as any);
  }
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

// Auto-generate heartbeat entries for agents with heartbeat workflows (convention-defaults Phase 3)
const autoHeartbeats = generateAutoHeartbeats(AGENTS_ROOT);
if (autoHeartbeats.length > 0) {
  // Inject into May's cron (where all heartbeats live)
  const mayCron = getAgentCrons().get("may");
  if (mayCron) {
    for (const entry of autoHeartbeats) {
      mayCron.addSyntheticEntry(entry);
    }
    bus.emit({ type: "info", message: `[auto-heartbeat] Generated ${autoHeartbeats.length} heartbeat(s): ${autoHeartbeats.map(e => e.agent).join(", ")}` });
  }
}

// ── Event routing ──────────────────────────────────────────────────────

const interfaceAgent = (() => {
  // Support both --agent <name> and --agent=<name>
  const eqArg = process.argv.find((a) => a.startsWith("--agent="));
  if (eqArg) return eqArg.split("=")[1]!;
  const idx = process.argv.indexOf("--agent");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.AGENT || "may";
})();

// ── Context Learning ──────────────────────────────────────────────────
// Moved to agents/may/handlers/context-learn.ts (event-driven handler).
// Subscribes to "context-learn" events via cron.json `on` field.

// ── Graceful shutdown / restart ─────────────────────────────────────────

let shuttingDown = false;
let activeRL: ReturnType<typeof createInterface> | null = null;
/** Track whether Ctrl+C cancel has been issued (second Ctrl+C force-quits). */
let cancelledOnce = false;

function gracefulShutdown() {
  if (shuttingDown) {
    process.kill(process.pid, "SIGKILL");
    return;
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

  // Give 2s for sessions to cancel, then exit.
  // SIGKILL at 5s guarantees exit if process.exit hangs (Bun + open HTTP streams).
  setTimeout(() => process.exit(0), 2000);
  setTimeout(() => process.kill(process.pid, "SIGKILL"), 5000).unref();
}


function gracefulRestart() {
  // Let supervisord handle it: stop this process (SIGTERM → SIGKILL), start fresh.
  // Fire-and-forget — supervisord kills us, we don't need to wait.
  const { exec } = require("node:child_process") as typeof import("node:child_process");
  exec("supervisorctl restart may-agent", { timeout: 10000 });
  // Don't call gracefulShutdown — supervisord sends SIGTERM which triggers it.
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
        const target = sessions.find((s) => s.sessionId === targetSid);
        if (target?.status === "idle") {
          manager.input(targetSid, steerText);
        } else {
          manager.steer(targetSid, steerText, "human");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("error", `[steer] ${msg}`);
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
          let requestId: string | undefined;
          try {
            requestId = trackRequest(PERSIST_DIR, {
              fromEntity: event.opts?.source ?? "agent",
              toAgent: event.agent,
              task: event.task,
              method: "call",
              source: event.opts?.source ?? "bus",
            });
          } catch {
            /* non-fatal */
          }
          const sessionId = manager.run(event.agent, event.task, {
            kind: (event.opts?.kind as "chat" | "job" | "call" | undefined) ?? "job",
            requestId: event.opts?.requestId ?? requestId,
          });
          log("info", `[fork] Started ${event.agent} session: ${sessionId}`);
        }
      }
      break;
    case "reload":
      handleReload();
      break;
    case "emit": {
      // Event-driven handler trigger: {"type":"emit","event":"project.commented","data":{...}}
      const eventType = (event as any).event as string;
      if (eventType) {
        let triggered = 0;
        for (const cron of getAgentCrons().values()) {
          triggered += cron.dispatchEvent(eventType, (event as any).data);
        }
        // Mark dispatched events as done in the events table (convention-defaults: event inbox)
        if (triggered > 0) {
          try {
            const db = getDb(PERSIST_DIR);
            db.run(
              `UPDATE events SET status = 'done', handled_by = 'handler-dispatch'
               WHERE event_type = ? AND status = 'pending' AND timestamp > ?`,
              [eventType, Date.now() - 5000],
            );
          } catch { /* best-effort */ }
        }
        log("info", `[event] ${eventType} → triggered ${triggered} handler(s)`);
      }
      break;
    }
    case "message":
      if ("from" in event && "to" in event && "task" in event) {
        try {
          bus.emit({
            type: "message_created",
            from: (event as any).from ?? "human",
            to: (event as any).to,
            task: (event as any).task,
            requestId: "",
          });
          log("info", `[message] ${(event as any).from ?? "human"} → ${(event as any).to}: ${((event as any).task as string).slice(0, 80)}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log("error", `[message] Failed: ${msg}`);
        }
      }
      break;
    case "resume":
      if ("sessionId" in event && event.sessionId) {
        const ok = manager.resumeInterrupted(event.sessionId);
        if (ok) {
          log("info", `[resume] Resumed session ${event.sessionId}`);
        } else {
          log("warn", `[resume] Failed to resume session ${event.sessionId}`);
        }
      }
      break;
    case "restart":
      gracefulRestart();
      break;
    case "shutdown":
      gracefulShutdown();
      break;
  }
});

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

if (MESSAGE_MODE) {
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

if (EMIT_MODE) {
  // ── Emit mode: send event to running instance via socket ──────────
  const net = await import("node:net");
  const socketPath = SOCKET_PATH;
  const payload = JSON.stringify({ type: "emit", event: EMIT_MODE.event, data: EMIT_MODE.data }) + "\n";
  const client = net.createConnection(socketPath, () => {
    client.write(payload);
    client.end();
  });
  client.on("error", (err: Error) => {
    console.error(`Failed to connect to socket ${socketPath}: ${err.message}`);
    process.exit(1);
  });
  client.on("end", () => {
    console.log(`Event emitted: ${EMIT_MODE.event}`);
    process.exit(0);
  });
  // Don't fall through
  await new Promise(() => {}); // keep alive until socket closes
}

if (RUN_WORKFLOW) {
  // ── Run workflow mode: load and execute a workflow directly ───────
  const { readdirSync } = await import("node:fs");
  const { join: pathJoin } = await import("node:path");
  const { buildRuntimeCtx } = await import("../lib/runtime-ctx.js");

  // Find the workflow file
  let wfPath: string | null = null;
  const searchDirs = [
    ...readdirSync(AGENTS_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith("."))
      .map(d => pathJoin(AGENTS_ROOT, d.name, "workflows")),
    pathJoin(AGENTS_ROOT, "shared", "workflows"),
  ];
  for (const dir of searchDirs) {
    try {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue;
        try {
          const mod = await import(pathJoin(dir, f) + "?t=" + Date.now());
          if (mod.name === RUN_WORKFLOW.name) { wfPath = pathJoin(dir, f); break; }
        } catch { /* skip */ }
      }
    } catch { /* dir doesn't exist */ }
    if (wfPath) break;
  }

  if (!wfPath) {
    console.error(`Workflow "${RUN_WORKFLOW.name}" not found`);
    process.exit(1);
  }

  console.log(`Loading workflow: ${wfPath}`);
  const wfMod = await import(wfPath + "?t=" + Date.now());

  const rtx = buildRuntimeCtx({ bus, persistDir: PERSIST_DIR, projectRoot: PROJECT_ROOT, agentsRoot: AGENTS_ROOT, agentName: "cli" });

  // Extract agent from workflow name or input
  const agentMatch = RUN_WORKFLOW.input?.match(/agent:\s*(\S+)/) || RUN_WORKFLOW.name.match(/^(\w+)-heartbeat$/);
  const agent = agentMatch ? agentMatch[1] : "may";

  const ctx = {
    ...rtx,
    task: RUN_WORKFLOW.input,
    agent,
    runAgent: DRY_RUN
      ? async (agentName: string, prompt: string) => {
          console.log(`\n${'='.repeat(60)}\nDRY RUN: ${agentName}\n${'='.repeat(60)}\n${prompt}\n${'='.repeat(60)}\n`);
          return { sessionId: "dry-run", status: "done" as const, lastAssistantText: "(dry run)", messages: [] as any[], duration: "0s", outputDir: "", turnsUsed: 0 };
        }
      : async (agentName: string, prompt: string) => {
          console.log(`Running agent: ${agentName} (${prompt.length} chars)...`);
          return manager.callAgent(agentName, prompt, { source: "cli" });
        },
    runFunction: async (label: string, fn: () => Promise<string>) => {
      const output = await fn();
      return { sessionId: `fn_${label}`, status: "done" as const, lastAssistantText: output, messages: [] as any[], duration: "0s", outputDir: "", turnsUsed: 0 };
    },
    runWorkflow: async () => ({ type: "escalate" as const, reason: "Sub-workflows not supported in CLI mode" }),
    summarize: (r: any) => r?.lastAssistantText?.slice(0, 500) ?? "",
    done: (s: string) => ({ type: "done" as const, summary: s }),
    escalate: (r: string, c?: unknown) => ({ type: "escalate" as const, reason: r, context: c }),
  };

  console.log(`Executing workflow: ${wfMod.name} (agent: ${agent}, dry-run: ${DRY_RUN})\n`);
  const result = await wfMod.execute(ctx);
  console.log(`\nResult: ${result.type}`);
  if (result.type === "done") console.log(result.summary);
  if (result.type === "escalate") console.log("Reason:", result.reason);
  process.exit(0);
}

if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED && !ONESHOT_MODE) {
  console.error("Error: need --chat, --task, --oneshot, --status, --message, --emit, or --cron.");
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

  taskSessionId = manager.run(interfaceAgent, oneshotTask, {
    kind: "job",
    requestId: (() => {
      try {
        return trackRequest(PERSIST_DIR, {
          fromEntity: "human",
          toAgent: interfaceAgent,
          task: oneshotTask,
          method: "call",
          source: "cli-oneshot",
        });
      } catch {
        return undefined;
      }
    })(),
  });

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
  const status = session?.status === "error" || session?.status === "interrupted" ? "error" : "success";

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
    try {
      taskRequestId = trackRequest(PERSIST_DIR, {
        fromEntity: "human",
        toAgent: interfaceAgent,
        task: INITIAL_TASK,
        method: "call",
        source: "cli-task",
      });
    } catch {
      /* non-fatal */
    }
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
    // Write failures to request DB so they show in --status process health
    for (const err of handlerResult.errors) {
      const handlerName = err.match(/"(\w[\w-]*)\.(js|ts)"/)?.[1] ?? err.match(/"([^"]+)"/)?.[1] ?? "unknown";
      trackRequest(PERSIST_DIR, {
        fromEntity: "cron",
        toAgent: "may",
        task: `[handler-load-failure] ${err}`,
        method: "call",
        artifact: handlerName,
        context: JSON.stringify({ type: "handler" }),
      });
    }
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
