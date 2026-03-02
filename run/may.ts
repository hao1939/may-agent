import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import {
  SubagentManager,
  createReadTool,
  createWriteTool,
  createExecTool,
} from "../src/index.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./console-ui.js";
import { attachSocketUI } from "./socket-ui.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = resolve(PROJECT_ROOT, "agents");
const PERSIST_DIR = resolve(PROJECT_ROOT, ".state");
const SOCKET_PATH = resolve(PERSIST_DIR, "may.sock");

// ── Model ──────────────────────────────────────────────────────────────

const opus = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  baseUrl: "http://localhost:4000",
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
attachConsoleUI(bus);

const manager = new SubagentManager({ persistDir: PERSIST_DIR });

function projectRead() {
  return createReadTool({ projectRoot: PROJECT_ROOT });
}

function projectExec() {
  return createExecTool({
    cwd: PROJECT_ROOT,
    echoCwd: true,
    warnOutsideRoot: PROJECT_ROOT,
    denyPatterns: [
      /^\s*find\s+\/\s/,      // find / ...
      /^\s*ls\s+\/\s*$/,      // ls /
      /^\s*cd\s+\/(?!home\/hao\/may-agent)/, // cd /anything except our project
    ],
    denyMessage: "Do not explore outside the project root. Use relative paths.",
  });
}

// Read-only exec for May — blocks file-writing commands
function readOnlyExec() {
  return createExecTool({
    cwd: PROJECT_ROOT,
    echoCwd: true,
    warnOutsideRoot: PROJECT_ROOT,
    denyPatterns: [
      /^\s*find\s+\/\s/,
      /^\s*ls\s+\/\s*$/,
      /^\s*cd\s+\/(?!home\/hao\/may-agent)/,
      // Block file-writing commands
      /\bsed\s+-i\b/,                         // sed -i (in-place edit)
      /\bcat\s*>[^&]/,                          // cat > file (but not cat >&)
      /<<\s*['"]?\w+['"]?/,                     // heredoc (cat << EOF, cat <<'EOF')
      /\btee\s/,                                // tee file
      /\b(echo|printf)\b.*>{1,2}[^&]/,        // echo > file or echo >> file
      /\bmv\s|\bcp\s|\brm\s/,                  // mv, cp, rm (followed by space)
      /\bmkdir\b/,                             // mkdir
      /\btouch\b/,                             // touch
      /\bchmod\b|\bchown\b/,                   // chmod, chown
      /\bpython3?\s+-c\b.*open\(/,             // python -c "...open(..."
      /\bnode\s+-e\b/,                          // node -e
      /\bgit\s+(add|commit|reset|checkout)\b/,  // git write operations
    ],
    denyMessage: "You cannot write files. Delegate code changes to coder: subagents.delegate(\"coder\", task)",
  });
}

// ── Register agents ────────────────────────────────────────────────────

manager.register({
  name: "coder",
  description: "Writes code, tests, commits",
  domain: "may-agent implementation",
  systemPromptFiles: [
    resolve(AGENTS_ROOT, "coder/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "coder/knowledge/codebase.md"),
    resolve(AGENTS_ROOT, "coder/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "coder/knowledge"),
  workspace: resolve(AGENTS_ROOT, "coder/workspace"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [projectRead(), createWriteTool(), projectExec()],
  apiKey: "not-needed",
  maxTurns: 30,
});

manager.register({
  name: "may",
  description: "Supervisor — delegates to coder, reviews results",
  domain: "may-agent coordination",
  systemPromptFiles: [
    resolve(AGENTS_ROOT, "may/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "may/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "may/knowledge"),
  workspace: resolve(AGENTS_ROOT, "may/workspace"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [readOnlyExec(), manager.createTool({
    onSessionStart: (agent, sessionId) => {
      attachAgentEvents(agent, sessionId);
    },
    getCallerSessionId: () => sid,
  })],
  apiKey: "not-needed",
  maxTurns: 20,
  compaction: {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info) => {
      bus.emit({ type: "info", message: `Compaction: ${info.messagesCompacted} messages compacted (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
    },
  },
});

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

// ── Session management ─────────────────────────────────────────────────

let sid: string;

function startSession(task: string): string {
  const sessionId = manager.run("may", task);
  attachAgentEvents("may", sessionId);
  return sessionId;
}

async function waitForCompletion(sessionId: string): Promise<void> {
  const result = await manager.waitFor(sessionId);

  if (result.status === "error" && result.error) {
    bus.emit({ type: "info", message: `Session error: ${result.error.slice(0, 200)}` });
  }
}

// ── Input handling ─────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });
let closed = false;
rl.on("close", () => { closed = true; });
// readline intercepts SIGINT — forward it to our graceful shutdown
rl.on("SIGINT", () => { gracefulShutdown(); });

const inputQueue: string[] = [];
let inputWaiter: ((line: string) => void) | null = null;

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (inputWaiter) {
    const waiter = inputWaiter;
    inputWaiter = null;
    waiter(trimmed);
  } else {
    inputQueue.push(trimmed);
  }
});

function waitForInput(): Promise<string> {
  if (inputQueue.length > 0) return Promise.resolve(inputQueue.shift()!);
  return new Promise((resolve) => { inputWaiter = resolve; });
}

// ── Command handling (from socket) ─────────────────────────────────────

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
      inputQueue.push(cmd.message);
      if (inputWaiter) {
        const waiter = inputWaiter;
        inputWaiter = null;
        waiter(inputQueue.shift()!);
      }
      break;
  }
});

// ── Graceful shutdown ──────────────────────────────────────────────────

let shuttingDown = false;

function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  bus.emit({ type: "info", message: "Shutting down — cancelling active sessions..." });
  if (sid) {
    manager.cancel(sid); // cascades to all children
  }
  // Give handleCompletion a moment to archive, then exit
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// ── Startup ────────────────────────────────────────────────────────────

// Try to resume May's session from a previous process crash/stop
const resumed = manager.resumeAgent("may");

if (resumed) {
  const { resumed: resumedSession, interrupted } = resumed;
  sid = resumedSession.sessionId;
  attachAgentEvents("may", sid);

  bus.emit({ type: "info", message: `Resumed session ${sid} (task: "${resumedSession.task.slice(0, 80)}")` });
  if (interrupted.length > 0) {
    bus.emit({ type: "info", message: `${interrupted.length} sub-agent session(s) marked as interrupted` });
  }
} else {
  // No session to resume — start fresh
  const stale = manager.cleanupStaleSessions();
  if (stale.length > 0) {
    bus.emit({ type: "info", message: `Cleaned up ${stale.length} stale session(s)` });
  }

  const cliTask = process.argv.slice(2).join(" ");
  let firstMessage: string;

  if (cliTask) {
    firstMessage = cliTask;
  } else {
    process.stdout.write("\nyou> ");
    const input = await waitForInput();
    if (!input) { rl.close(); process.exit(0); }
    firstMessage = input;
  }

  sid = startSession(firstMessage);
}

const socketUI = attachSocketUI({
  socketPath: SOCKET_PATH,
  bus,
  manager,
  getSessionId: () => sid,
});

await waitForCompletion(sid);

// ── Main loop ──────────────────────────────────────────────────────────

while (!closed) {
  process.stdout.write("\nyou> ");
  const input = await waitForInput();
  if (!input || input === "exit" || input === "quit") break;

  sid = startSession(input);
  await waitForCompletion(sid);
}

socketUI.close();
rl.close();
