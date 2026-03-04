import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager } from "../src/index.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./console-ui.js";
import { attachSocketUI } from "./socket-ui.js";
import { loadAgents, reloadAgents, setAgentSessionId, runAgentCleanup, type AgentLoaderOptions } from "./agent-loader.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = resolve(PROJECT_ROOT, "agents");
const PERSIST_DIR = resolve(PROJECT_ROOT, process.env.STATE_DIR || ".state");

// ── Models ──────────────────────────────────────────────────────────────

const models: Record<string, any> = {
  opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    baseUrl: "http://localhost:4000",
  },
  gpt52: {
    ...getModel("openai", "gpt-5.2"),
    baseUrl: "http://localhost:4000",
  },
  gemini3pro: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "gemini-3-pro-preview",
    baseUrl: "http://localhost:4000",
  },
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
attachConsoleUI(bus);

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
    setAgentSessionId(agentName, sessionId);
  },
  onSessionComplete: (info) => {
    // Run cleanup for tools that track per-session resources (background_exec, socket_watch)
    runAgentCleanup(info.agent);
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
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
  },
};

const loadResult = loadAgents(loaderOpts);
bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

// ── Event routing ──────────────────────────────────────────────────────

function attachAgentEvents(label: string, sessionId: string): void {
  manager.subscribe(sessionId, (event) => {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          bus.emit({ type: "prompt", message: label });
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          bus.emit({ type: "text", agent: label, text: event.assistantMessageEvent.delta });
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

let sid: string;

bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "steer":
      bus.emit({ type: "info", message: `[socket] Steering: "${cmd.message.slice(0, 80)}"` });
      try {
        manager.steer(sid, cmd.message);
      } catch {
        bus.emit({ type: "info", message: `[socket] Cannot steer — session not running` });
      }
      break;
    case "cancel":
      bus.emit({ type: "info", message: `[socket] Cancel: ${cmd.sessionId}` });
      manager.cancel(cmd.sessionId);
      break;
    case "cancel_all":
      bus.emit({ type: "info", message: "[socket] Cancel all" });
      for (const s of manager.status()) {
        if (s.status === "running") manager.cancel(s.sessionId);
      }
      break;
    case "cancel_task":
      bus.emit({ type: "info", message: "[socket] Cancel current task" });
      manager.cancel(sid);
      break;
    case "close":
      bus.emit({ type: "info", message: "[socket] Closing session (will not resume on restart)..." });
      manager.close(sid);
      gracefulShutdown();
      break;
    case "status": {
      const sessions = manager.status();
      if (sessions.length === 0) {
        bus.emit({ type: "info", message: "[status] No active sessions" });
      } else {
        const lines = sessions.map((s) =>
          `  ${s.agent} (${s.sessionId}): ${s.status} — "${s.task.slice(0, 80)}" [${s.runtime}]`
        );
        bus.emit({ type: "info", message: `[status] ${sessions.length} active session(s):\n${lines.join("\n")}` });
      }
      break;
    }
    case "input":
      bus.emit({ type: "info", message: `[socket] Input: "${cmd.message.slice(0, 80)}"` });
      lastUserInput = Date.now();
      sendToInterface(cmd.message);
      break;
    case "run": {
      bus.emit({ type: "info", message: `[socket] Run @${cmd.agent}: "${cmd.message.slice(0, 80)}"` });
      lastUserInput = Date.now();
      runDirect(cmd.agent, cmd.message);
      break;
    }
    case "reload_agents": {
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
      break;
    }
  }
});

// ── Send input to interface agent's persistent session ─────────────────

let lastUserInput = Date.now();

async function sendToInterface(message: string): Promise<void> {
  try {
    await manager.send(sid, message);
    // If send() steered into a running session, wait for it to finish
    await manager.waitForIdle(sid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `Send error: ${msg}` });
  }
}

/** Run a fresh ephemeral session on any agent directly (bypasses interface agent). */
async function runDirect(agentName: string, message: string): Promise<void> {
  try {
    const sessionId = manager.run(agentName, message);
    bus.emit({ type: "info", message: `[direct] Started ${agentName} session: ${sessionId}` });
    await manager.waitFor(sessionId);
    bus.emit({ type: "info", message: `[direct] ${agentName} session completed: ${sessionId}` });
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
  // This fires synchronously just before the process exits
  const err = new Error("exit trace");
  console.error(`[exit] Process exiting with code ${code}\n${err.stack}`);
});

// ── Interface agent selection ──────────────────────────────────────────

const interfaceAgent = process.env.AGENT || "may";

// Verify the interface agent is registered
if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// Runtime options for the interface agent's persistent session
const interfaceRunOpts = {
  persistent: true,
  compaction: {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info: { messagesCompacted: number; tokensBefore: number; tokensAfter: number }) => {
      bus.emit({ type: "info", message: `Compaction: ${info.messagesCompacted} messages compacted (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
    },
  },
};

// ── Socket (always available — created BEFORE startup so it's reachable during resume) ──

const SOCKET_PATH = resolve(PERSIST_DIR, `${interfaceAgent}.sock`);

const socketUI = attachSocketUI({
  socketPath: SOCKET_PATH,
  bus,
  manager,
  getSessionId: () => sid,
});

// ── Startup ────────────────────────────────────────────────────────────

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

// ── Main loop ──────────────────────────────────────────────────────────

/** Parse @agent prefix from input. Returns [agentName, message] or [null, original]. */
function parseAgentPrefix(input: string): [string | null, string] {
  const match = input.match(/^@(\w+)\s+([\s\S]+)/);
  if (match) return [match[1], match[2]];
  return [null, input];
}

if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Track whether we're in the middle of a task (sendToInterface or runDirect)
  let taskRunning = false;

  rl.on("SIGINT", () => {
    if (taskRunning) {
      // Ctrl+C while a task is running: cancel the task, keep the session
      bus.emit({ type: "info", message: "\n[ctrl+c] Cancelling current task..." });
      manager.cancel(sid);
      // Also cancel any direct-agent sessions
      for (const s of manager.status()) {
        if (s.status === "running" && s.sessionId !== sid) {
          manager.cancel(s.sessionId);
        }
      }
    } else {
      // Ctrl+C when idle: shutdown
      gracefulShutdown();
    }
  });

  const prompt = () => { process.stdout.write(`\nyou> `); };
  prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (input === "exit" || input === "quit") break;
    if (input === "close") {
      bus.emit({ type: "info", message: "Closing session (will not resume on restart)..." });
      manager.close(sid);
      break;
    }
    if (input === "cancel") {
      manager.cancel(sid);
      prompt();
      continue;
    }
    if (input === "reload") {
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
      prompt();
      continue;
    }
    if (!input) { prompt(); continue; }

    lastUserInput = Date.now();
    taskRunning = true;

    const [targetAgent, message] = parseAgentPrefix(input);
    if (targetAgent) {
      // Direct agent invocation: @agent message
      await runDirect(targetAgent, message);
    } else {
      // Default: send to interface agent
      await sendToInterface(input);
    }

    taskRunning = false;
    prompt();
  }

  socketUI.close();
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
