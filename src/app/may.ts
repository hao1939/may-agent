import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
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
  loadAgents,
  reloadAgents,
  setAgentSessionId,
  runAgentCleanup,
  getAgentCrons,
  generateAutoHeartbeats,
  type AgentLoaderOptions,
} from "./agent-loader.js";
import { resolveProjectRoot } from "./bundle-mode.js";
import { getDb, closeAllDbs } from "../lib/requests.js";
import { log } from "../lib/log.js";
import { parseEmitMode, runEmitMode } from "./modes/emit.js";
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
let EMIT_MODE: ReturnType<typeof parseEmitMode>;
try {
  EMIT_MODE = parseEmitMode(process.argv);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
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

// DB writer subscriber — persists events to SQLite.
// Registered with priority "first": v2 invariant that events are durable
// BEFORE any side-effect handler runs. If a handler triggers work, the
// originating event is already on disk (audit/replay safety).
import { DbWriter } from "../lib/db-writer.js";
const dbWriter = new DbWriter(PERSIST_DIR);
bus.subscribe(dbWriter.handler, { priority: "first" });

// Session lifecycle subscribers — decoupled side effects
import {
  createStuckDetector,
  createAutoResume,
  createDigestWriter,
  createLastSessionWriter,
} from "../lib/session-subscribers.js";
bus.subscribe(createDigestWriter(PERSIST_DIR));
bus.subscribe(createLastSessionWriter(PROJECT_ROOT));
bus.subscribe(createStuckDetector(
  (sessionId, _reason) => {
    bus.emit({ type: "cancel", sessionId } as any);
  },
  (agent, sessionId, reason) => {
    // Circuit-breaker → diagnosis feedback loop: notify May to investigate
    bus.emit({
      type: "message.created",
      from: "system:circuit-breaker",
      to: "may",
      content: `[circuit-breaker] Agent "${agent}" terminated (session ${sessionId}): ${reason}. Investigate the root cause — check the session transcript, recent errors, and whether the agent needs guidance or a code fix.`,
      intent: "investigate",
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
    bus.emit({ type: "message.created", from: "may", to: "human", content: `⚠️ *Agent Blocked*\n${agent} — ${reason}` } as any);
  },
  PERSIST_DIR,
  () => manager,
));

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

// Agent-loader bookkeeping (track active session IDs, run cleanup on completion)
bus.subscribe((event) => {
  if (event.type === "session.start" && "agent" in event && "sessionId" in event) {
    setAgentSessionId(event.agent as string, event.sessionId as string);
  }
  if (event.type === "session.end" && "agent" in event) {
    runAgentCleanup(event.agent as string);
  }
});

// ── Session lifecycle → domain events (thin translator) ────────────────
// Translates session.end bus events into domain events (dot-separated types).
// DbWriter persists them, Cron dispatches them to handlers — both via bus subscription.
bus.subscribe((event) => {
  if (event.type !== "session.end") return;
  const info = event as any;

  // Translate → session.failed (for recovery handler)
  if (info.error && info.status === "error") {
    bus.emit({ type: "session.failed",
      sessionId: info.sessionId, agent: info.agent, error: info.error, task: info.task,
    } as any);
  }

  // Translate → session.escalated (for escalation handler)
  const fp = info.finishParams;
  if (fp && (fp.status === "blocked" || fp.status === "failure")) {
    bus.emit({ type: "session.escalated",
      sessionId: info.sessionId, agent: info.agent, finishParams: fp,
    } as any);
  }

  // Translate → session.completed (for eval handler)
  if (info.agent !== "evaluator" && info.agent !== "judge") {
    bus.emit({ type: "session.completed",
      sessionId: info.sessionId, agent: info.agent,
      parentSessionId: info.parentSessionId, outcome: info.outcome,
      status: info.status, source: info.source, kind: info.kind,
    } as any);
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
console.log(`[agents] Loaded ${loadResult.added.length}: ${loadResult.added.join(", ")}`);


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

// Subscribe all crons to bus for event-driven handler dispatch
for (const cron of getAgentCrons().values()) {
  cron.subscribeToBus(bus);
}

// ── Startup workflow validation ───────────────────────────────────────
// Pre-flight: try importing all heartbeat workflows to catch syntax errors early.
// A broken shared workflow (like heartbeat-data.ts) silently kills ALL heartbeats.
{
  const sharedWfDir = join(AGENTS_ROOT, "shared", "workflows");
  const heartbeatFiles = autoHeartbeats.map(e => {
    const agentWfDir = join(AGENTS_ROOT, e.agent!, "workflows");
    return join(agentWfDir, `${e.agent}-heartbeat.ts`);
  }).filter(f => existsSync(f));

  let failures = 0;
  for (const f of heartbeatFiles) {
    try {
      await import(f);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[startup-check] ⚠️ WORKFLOW BROKEN: ${f.split("/").slice(-3).join("/")} — ${msg}` });
      console.error(`[startup-check] BROKEN WORKFLOW: ${f}\n  ${msg}`);
    }
  }
  if (failures > 0) {
    bus.emit({ type: "info", message: `[startup-check] ⚠️ ${failures} heartbeat workflow(s) failed to load! Heartbeats will NOT fire for those agents.` });
  }
}

// ── Event routing ──────────────────────────────────────────────────────

// ── Context Learning ──────────────────────────────────────────────────
// Moved to agents/may/handlers/context-learn.ts (event-driven handler).
// Subscribes to "context-learn" events via cron.json `on` field.

// ── Graceful shutdown / restart ─────────────────────────────────────────

let shuttingDown = false;
let activeRL: ReturnType<typeof createInterface> | null = null;
/** Track whether Ctrl+C cancel has been issued (second Ctrl+C force-quits). */
let cancelledOnce = false;

function gracefulShutdown(opts: { preserveSessions?: boolean } = {}) {
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

  if (opts.preserveSessions) {
    bus.emit({ type: "info", message: "[shutdown] Preserving running sessions for restart/resume" });
  } else {
    // Explicit close/cancel semantics: mark sessions interrupted.
    chatSession?.cancelAll();
    for (const s of manager.status()) {
      if (s.status === "running") {
        manager.cancel(s.sessionId);
      }
    }
  }

  // Give 2s for sessions to cancel, then checkpoint DB and exit.
  // SIGKILL at 5s guarantees exit if process.exit hangs (Bun + open HTTP streams).
  setTimeout(() => {
    try { closeAllDbs(); } catch { /* best-effort */ }
    process.exit(0);
  }, 2000);
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
  // Supervisor/docker restarts should leave running sessions resumable.
  gracefulShutdown({ preserveSessions: true });
});
process.on("SIGHUP", () => {
  bus.emit({ type: "info", message: "[signal] SIGHUP received (ignoring)" });
});
process.on("uncaughtException", (err) => {
  try { console.error(`[fatal] Uncaught exception: ${err.message}\n${err.stack}`); } catch {}
  try { closeAllDbs(); } catch {}
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  try { console.error(`[fatal] Unhandled rejection: ${reason}`); } catch {}
});
process.on("exit", (code) => {
  try { closeAllDbs(); } catch {}
  try {
    writeIdentity({
      status: code === 0 ? "done" : "error",
      exitCode: code,
      endedAt: new Date().toISOString(),
      duration: formatDurationMs(Date.now() - PROCESS_START_TIME),
    });
  } catch {}
});

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
    createSession: DRY_RUN
      ? async (opts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
          console.log(`\n${'='.repeat(60)}\nDRY RUN createSession: ${opts.label || "session"} (tools: ${opts.tools})\n${'='.repeat(60)}\nSystem prompt: ${opts.systemPrompt.slice(0, 200)}...\n`);
          let lastPrompt = "";
          return {
            async prompt(message: string) { console.log(`  [${opts.label || "session"}] prompt (${message.length} chars):\n${message.slice(0, 300)}...\n`); lastPrompt = message; },
            lastText() { return `(dry run response to: ${lastPrompt.slice(0, 80)}...)`; },
            close() {},
          };
        }
      : async (opts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }) => {
          const { Agent } = await import("@mariozechner/pi-agent-core");
          const { createCodingTools } = await import("../lib/tools/coding.js");
          const { createReadTool } = await import("../lib/tools/read.js");

          const tools = opts.tools === "readonly"
            ? [createReadTool(PROJECT_ROOT)]
            : createCodingTools(PROJECT_ROOT, { agentName: opts.label || "worker" });

          const agentInstance = new Agent({
            initialState: {
              systemPrompt: opts.systemPrompt,
              model: models.opus,
              tools: tools as any[],
            },
            getApiKey: () => LITELLM_API_KEY,
          });

          agentInstance.subscribe(async (event: any) => {
            if (event.type === "tool_execution_start") {
              console.log(`  [${opts.label || "session"}] 🔧 ${event.toolName}(${JSON.stringify(event.args).slice(0, 80)}...)`);
            }
          });

          return {
            async prompt(message: string) { await agentInstance.prompt(message); },
            lastText() {
              const msgs = agentInstance.state.messages;
              for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i] as any;
                if (m.role === "assistant") {
                  return (m.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
                }
              }
              return "";
            },
            close() { /* agent GC'd naturally */ },
          };
        },
  };

  console.log(`Executing workflow: ${wfMod.name} (agent: ${agent}, dry-run: ${DRY_RUN})\n`);
  const result = await wfMod.execute(ctx);
  console.log(`\nResult: ${result.type}`);
  if (result.type === "done") console.log(result.summary);
  if (result.type === "escalate") console.log("Reason:", result.reason);
  process.exit(0);
}

if (!CHAT_MODE && !INITIAL_TASK && !CRON_ENABLED && !ONESHOT_MODE && !WEB_ENABLED && !SOCKET_ENABLED && !TELEGRAM_ENABLED) {
  console.error("Error: need --chat, --task, --oneshot, --status, --message, --emit, --web, --socket, --telegram, or --cron.");
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

const telegramBot = TELEGRAM_ENABLED
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
