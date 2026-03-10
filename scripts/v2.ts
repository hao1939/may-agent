/**
 * V2 Runner Script — minimal entry point for the new chat-loop system.
 *
 * Wires together: SubagentManager + EventBus + ChatLoop + readline.
 * Loads agents dynamically, boots a chat loop, and feeds stdin to
 * chatLoop.handleInput().
 *
 * Usage:
 *   npm run v2
 *   npm run v2 -- --agent bob
 *
 * Phase 3 of the V2 implementation plan.
 */

import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager } from "../src/lib/manager.js";
import { EventBus } from "../src/app/event-bus.js";
import { ChatLoop } from "../src/v2/chat-loop.js";
import { attachConsoleUI } from "../src/app/ui/console.js";
import { loadAgents, reloadAgents, type AgentLoaderOptions } from "../src/app/agent-loader.js";

// ── Paths ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
const PERSIST_DIR = resolve(process.env.STATE_DIR || resolve(PROJECT_ROOT, ".state"));

mkdirSync(PERSIST_DIR, { recursive: true });

// ── CLI args ────────────────────────────────────────────────────────────

const interfaceAgent = (() => {
  const idx = process.argv.indexOf("--agent");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.AGENT || "may";
})();

// ── Models ──────────────────────────────────────────────────────────────

const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.ANTHROPIC_API_KEY || "not-needed";

const models: Record<string, any> = {
  opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: 128000,
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
attachConsoleUI(bus);

bus.emit({ type: "info", message: `[v2] Starting (pid=${process.pid}, root=${PROJECT_ROOT})` });

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  projectRoot: PROJECT_ROOT,
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
  },
});

// ── Load agents ─────────────────────────────────────────────────────────

const loaderOpts: AgentLoaderOptions = {
  agentsRoot: AGENTS_ROOT,
  projectRoot: PROJECT_ROOT,
  persistDir: PERSIST_DIR,
  models,
  manager,
  bus,
  cronEnabled: false,
};

const loadResult = loadAgents(loaderOpts);
bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// ── Event routing ──────────────────────────────────────────────────────

function attachAgentEvents(label: string, sessionId: string): void {
  const isChat = label === interfaceAgent;

  if (!isChat) {
    // Background sessions: compact log
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

  // Chat session: full streaming
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

// ── Graceful shutdown ──────────────────────────────────────────────────

let shuttingDown = false;
let activeRL: ReturnType<typeof createInterface> | null = null;
let chatLoop: ChatLoop | undefined;

function gracefulShutdown(): void {
  if (shuttingDown) {
    process.exit(1);
  }
  shuttingDown = true;
  bus.emit({ type: "info", message: "Shutting down..." });

  if (activeRL) {
    activeRL.close();
    activeRL = null;
  }

  chatLoop?.cancelAll();
  for (const s of manager.status()) {
    if (s.status === "running") {
      manager.cancel(s.sessionId);
    }
  }

  setTimeout(() => process.exit(0), 2000);
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

process.on("SIGINT", () => gracefulShutdown());
process.on("SIGTERM", () => gracefulShutdown());
process.on("uncaughtException", (err) => {
  bus.emit({ type: "info", message: `[fatal] Uncaught exception: ${err.message}\n${err.stack}` });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  bus.emit({ type: "info", message: `[fatal] Unhandled rejection: ${reason}` });
});

// ── Resume stale sessions ──────────────────────────────────────────────

const { resumed, interrupted } = manager.resumeStaleSessions();
if (resumed.length > 0) {
  bus.emit({ type: "info", message: `[startup] Resumed ${resumed.length} session(s): ${resumed.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}` });
}
if (interrupted.length > 0) {
  bus.emit({ type: "info", message: `[startup] Could not resume ${interrupted.length} session(s): ${interrupted.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}` });
}

let startupContext: string | undefined;
if (interrupted.length > 0) {
  const lines = interrupted.map((s) =>
    `- ${s.agent} (${s.sessionId}): "${(s.task ?? "").slice(0, 120)}" — ${s.error ?? "unknown"}`
  );
  startupContext =
    `Process restarted. ${resumed.length} session(s) were automatically resumed. ` +
    `The following ${interrupted.length} session(s) could NOT be resumed:\n` +
    lines.join("\n") +
    `\n\nThese sessions are lost. Check if any work needs to be re-dispatched.`;
}

// ── Chat Loop ──────────────────────────────────────────────────────────

function emitPrompt(): void {
  bus.emit({ type: "prompt", message: interfaceAgent, channel: "chat" });
  if (process.stdin.isTTY) {
    process.stdout.write(`\nyou> `);
  }
}

chatLoop = new ChatLoop({
  manager,
  bus,
  agentName: interfaceAgent,
  startupContext,
  onSessionDone: () => {
    emitPrompt();
  },
  onReload: handleReload,
  onClose: () => {
    bus.emit({ type: "info", message: "[cmd] Closing..." });
    gracefulShutdown();
  },
  onRestart: () => {
    bus.emit({ type: "info", message: "[cmd] Restarting..." });
    gracefulShutdown();
  },
});

bus.emit({ type: "info", message: `[v2] Chat loop ready. Agent: ${interfaceAgent}. Type 'status' for info, 'close' to quit.` });

// ── Command routing (bus commands → chat loop) ─────────────────────────

bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "input":
      chatLoop!.handleInput(cmd.message);
      return { ok: true };
    case "cancel_all":
      chatLoop!.handleInput("cancel all");
      return { ok: true };
    case "status":
      chatLoop!.handleInput("status");
      return { ok: true };
    case "close":
      gracefulShutdown();
      return { ok: true };
    case "reload_agents":
      handleReload();
      return { ok: true };
    default:
      return { ok: false, message: `Unknown command: ${(cmd as { type: string }).type}` };
  }
});

// ── Input loop (readline) ──────────────────────────────────────────────

emitPrompt();

const rl = createInterface({ input: process.stdin, output: process.stdout });
activeRL = rl;

let cancelledOnce = false;

rl.on("SIGINT", () => {
  if (chatLoop && chatLoop.getActiveCount() > 0 && !cancelledOnce) {
    cancelledOnce = true;
    bus.emit({ type: "info", message: "\n[ctrl+c] Cancelling active sessions... (press again to force quit)" });
    chatLoop.cancelAll();
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    emitPrompt();
  } else {
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
  if (!joined) { emitPrompt(); return; }
  if (joined === "exit" || joined === "quit") {
    rl.close();
    return;
  }
  cancelledOnce = false;
  chatLoop!.handleInput(joined);
};

rl.on("line", (line: string) => {
  pasteBuffer.push(line);
  if (pasteTimer) clearTimeout(pasteTimer);
  pasteTimer = setTimeout(flushPaste, PASTE_WINDOW_MS);
});

await new Promise<void>((resolve) => {
  rl.on("close", () => {
    if (pasteTimer) { clearTimeout(pasteTimer); flushPaste(); }
    resolve();
  });
});
