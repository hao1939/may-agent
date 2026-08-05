#!/usr/bin/env node
const net = require("node:net");
const path = require("node:path");
const readline = require("node:readline");
const { spawn } = require("node:child_process");

const stateDir = process.env.STATE_DIR || "/app/.state";
const instance = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "background";
const daemonAgent = process.env.DAEMON_AGENT || "may";
const socketPath = path.join(stateDir, "instances", instance, `${daemonAgent}.sock`);
const source = "may-console";

let socket = null;
let connected = false;
let closing = false;
let reconnectTimer = null;
let reconnectDelayMs = 250;
let buffer = "";
let raw = false;
let debug = false;
let watchMode = "may"; // may | all | current
let watchedSessionId = null;
let showNextStatus = false;
let lastDisconnectedMessage = "";

const knownSessions = new Map();
const sessionsWithText = new Set();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  historySize: 1000,
});

function shortSessionId(sessionId) {
  const text = String(sessionId || "");
  if (text.length <= 12) return text;
  return text.slice(0, 10);
}

function promptText() {
  if (!connected) return "may[disconnected]> ";
  return "may> ";
}

function refreshPrompt() {
  rl.setPrompt(promptText());
  rl.prompt(true);
}

function writeStdout(text) {
  process.stdout.write(text);
}

function printLine(text = "") {
  try {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  } catch {
    // Non-TTY output is fine in tests and logs.
  }
  writeStdout(`${text}\n`);
  refreshPrompt();
}

function printResponseText(text = "") {
  try {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  } catch {
    // Non-TTY output is fine in tests and logs.
  }
  const value = String(text || "");
  if (!value) return;
  writeStdout(value.endsWith("\n") ? value : `${value}\n`);
}

function eventPayload(event) {
  return event && typeof event.data === "object" && event.data && !Array.isArray(event.data)
    ? event.data
    : {};
}

function flatPayload(event) {
  const data = eventPayload(event);
  return Object.keys(data).length > 0 ? data : event || {};
}

function eventSessionId(event) {
  const data = flatPayload(event);
  return typeof data.sessionId === "string" ? data.sessionId : null;
}

function rememberSession(item) {
  if (!item || typeof item !== "object") return;
  const sessionId = typeof item.sessionId === "string" ? item.sessionId : null;
  if (!sessionId) return;
  const previous = knownSessions.get(sessionId) || {};
  knownSessions.set(sessionId, {
    ...previous,
    ...item,
    sessionId,
    updatedAt: Date.now(),
  });
}

function rememberStatusItems(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    rememberSession(item);
  }
}

function watchSessions() {
  if (watchMode === "current" && watchedSessionId) return [watchedSessionId];
  // Bounded May turns are independent job sessions, so the socket cannot use
  // its legacy persistent-chat filter. Subscribe broadly and keep the normal
  // May view quiet in this client.
  return ["*"];
}

function sendFrame(frame, opts = {}) {
  if (!connected || !socket || socket.destroyed) {
    if (!opts.silent) printLine(`[disconnected] ${socketPath}`);
    return false;
  }
  try {
    socket.write(`${JSON.stringify(frame)}\n`);
    return true;
  } catch (err) {
    if (!opts.silent) printLine(`[socket write failed] ${err && err.message ? err.message : String(err)}`);
    return false;
  }
}

function ownerForAgent(agent) {
  const value = String(agent || daemonAgent || "may").trim() || "may";
  return value.startsWith("agent:") || value.startsWith("human:") ? value : `agent:${value}`;
}

function canonicalFrame(type, data = {}, opts = {}) {
  const owner = opts.owner || ownerForAgent(opts.agent || daemonAgent);
  return {
    type,
    source,
    owner,
    ...(opts.urgency ? { urgency: opts.urgency } : {}),
    data,
  };
}

function mayInputFrame(message) {
  return canonicalFrame("human.input.received", {
    actor: "human",
    text: message,
    conversation: {
      id: `${source}:local-terminal:agent:${daemonAgent}`,
      channel: source,
      channelThreadId: "local-terminal",
    },
    target: { agent: daemonAgent },
    context: { forceNew: true },
  });
}

function steerFrame(sessionId, message) {
  return canonicalFrame("session.steer.requested", { sessionId, message });
}

function cancelFrame(sessionId) {
  return canonicalFrame("session.cancel.requested", { sessionId }, { urgency: "high" });
}

function cancelAllFrame() {
  return canonicalFrame("session.cancel_all.requested", { reason: "human requested cancel all" }, { urgency: "high" });
}

function runtimeFrame(type) {
  const urgency = type === "runtime.reload.requested" ? undefined : "high";
  return canonicalFrame(type, {}, { urgency });
}

function subscribe(mode = watchMode) {
  watchMode = mode;
  return sendFrame({ type: "subscribe", sessions: watchSessions() });
}

function requestStatus() {
  showNextStatus = true;
  if (!sendFrame({ type: "status" })) showNextStatus = false;
}

function resolveSessionId(input) {
  const needle = String(input || "").trim();
  if (!needle) return { ok: false, message: "missing session id" };
  if (knownSessions.has(needle)) return { ok: true, sessionId: needle };
  const matches = [...knownSessions.keys()].filter((id) => id.startsWith(needle) || id.endsWith(needle));
  if (matches.length === 1) return { ok: true, sessionId: matches[0] };
  if (matches.length > 1) return { ok: false, message: `ambiguous session id '${needle}': ${matches.map(shortSessionId).join(", ")}` };
  return { ok: false, message: `unknown session id '${needle}'. Run /sessions first.` };
}

function renderStatus(items) {
  rememberStatusItems(items);
  if (!Array.isArray(items) || items.length === 0) return "[status] No active sessions";
  return items
    .map((item) => {
      const sessionId = String(item.sessionId || "?");
      const agent = String(item.agent || item.name || "?");
      const status = String(item.status || "?");
      const kind = String(item.kind || "?");
      const task = String(item.task || "").replace(/\s+/g, " ").slice(0, 100);
      return `${shortSessionId(sessionId).padEnd(10)}  ${agent.padEnd(12)}  ${status.padEnd(8)}  ${kind.padEnd(6)}  "${task}"`;
    })
    .join("\n");
}

function shouldShowSessionEvent(event) {
  if (watchMode === "all") return true;
  const sid = eventSessionId(event);
  if (!sid) return true;
  if (watchMode === "current") return !!watchedSessionId && sid === watchedSessionId;
  const data = flatPayload(event);
  const known = knownSessions.get(sid) || {};
  return String(data.agent || known.agent || "") === daemonAgent;
}

function formatToolArgs(tool, args) {
  if (!args || typeof args !== "object") return "";
  if (tool === "bash") return String(args.command || "").slice(0, 160);
  if (tool === "read" || tool === "write" || tool === "edit") return String(args.path || "");
  if (tool === "finish") return `${args.status || "?"}: ${String(args.summary || "").slice(0, 100)}`;
  return JSON.stringify(args).slice(0, 160);
}

function handleConnected(event) {
  connected = true;
  reconnectDelayMs = 250;
  rememberStatusItems(event.activeAgents);
  printLine(`Connected to ${event.agent || daemonAgent} (${event.instance || instance})`);
}

function handleSessionStart(event) {
  const data = flatPayload(event);
  rememberSession({
    sessionId: data.sessionId,
    agent: data.agent,
    status: "running",
    kind: data.kind,
    task: data.task,
    parentSessionId: data.parentSessionId,
  });
  if (!debug && watchMode === "may") return;
  const parent = data.parentSessionId ? ` child of ${shortSessionId(data.parentSessionId)}` : "";
  printLine(`[${data.agent || daemonAgent}] started ${shortSessionId(data.sessionId)}${parent}: ${String(data.task || "").slice(0, 100)}`);
}

function handleSessionEnd(event) {
  const data = flatPayload(event);
  const sessionId = typeof data.sessionId === "string" ? data.sessionId : "";
  const agent = String(data.agent || daemonAgent);
  const kind = String(data.kind || knownSessions.get(sessionId)?.kind || "");
  const status = String(data.status || "done");
  rememberSession({
    sessionId,
    agent,
    status,
    kind,
    task: data.task,
  });
  const isMayTurn = agent === daemonAgent;
  const rawSummary = String(data.summary || data.error || "").trim();
  if (isMayTurn && status === "done" && rawSummary && !sessionsWithText.has(sessionId)) {
    printResponseText(rawSummary);
  }
  if (!debug && watchMode === "may" && status === "done") {
    refreshPrompt();
    return;
  }
  const summary = isMayTurn && status === "done" ? "" : rawSummary;
  printLine(`[${agent}] ${shortSessionId(sessionId)} ${status}${summary ? `: ${summary.slice(0, 180)}` : ""}`);
}

function handleEvent(event) {
  if (!event || typeof event !== "object") return;
  if (raw) {
    printLine(JSON.stringify(event));
    return;
  }

  if (!shouldShowSessionEvent(event)) return;
  const data = flatPayload(event);
  switch (event.type) {
    case "connected":
      handleConnected(event);
      return;
    case "ok":
      if (event.command === "human.input.received") {
        printLine(`[accepted${event.eventId ? ` #${event.eventId}` : ""}] May is handling this turn.`);
      }
      return;
    case "error":
      printLine(`[error] ${event.message || "unknown error"}`);
      return;
    case "status":
      {
        const rendered = renderStatus(event.activeAgents);
        if (showNextStatus || debug || watchMode === "all") printLine(rendered);
        showNextStatus = false;
      }
      return;
    case "session.start":
      handleSessionStart(event);
      return;
    case "text":
      {
        const sid = eventSessionId(event);
        if (sid) sessionsWithText.add(sid);
        try {
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
        } catch {}
      }
      writeStdout(String(event.text || ""));
      return;
    case "tool_call":
      if (debug) printLine(`[tool] ${event.tool || "unknown"} ${formatToolArgs(event.tool, event.args)}`.trim());
      return;
    case "tool_result":
      if (event.isError) printLine(`[tool error] ${event.tool || "unknown"}: ${String(event.preview || "").slice(0, 200)}`);
      return;
    case "session.end":
      handleSessionEnd(event);
      return;
    case "message.created": {
      const normalizedTarget = typeof data.to === "string" ? data.to.trim().toLowerCase() : "";
      if (normalizedTarget === "human" || normalizedTarget === "human:operator") {
        printLine(`${data.from || "may"}: ${data.content || data.message || ""}`);
      }
      return;
    }
    case "info":
      if (debug || watchMode === "all") printLine(String(event.message || ""));
      return;
  }
}

function connectSocket() {
  if (closing) return;
  if (socket && !socket.destroyed) return;

  socket = net.createConnection(socketPath);

  socket.on("connect", () => {
    connected = true;
    reconnectDelayMs = 250;
    lastDisconnectedMessage = "";
    sendFrame({ type: "subscribe", sessions: watchSessions() }, { silent: true });
    sendFrame({ type: "status" }, { silent: true });
    refreshPrompt();
  });

  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleEvent(JSON.parse(line));
      } catch {
        printLine(line);
      }
    }
  });

  socket.on("error", (err) => {
    connected = false;
    const message = err && err.message ? err.message : String(err);
    if (message !== lastDisconnectedMessage) {
      lastDisconnectedMessage = message;
      printLine(`[socket] waiting for daemon: ${message}`);
    }
  });

  socket.on("close", () => {
    connected = false;
    socket = null;
    refreshPrompt();
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (closing || reconnectTimer) return;
  const delay = reconnectDelayMs;
  reconnectDelayMs = Math.min(5000, Math.floor(reconnectDelayMs * 1.8));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

function printHelp() {
  printLine([
    "Commands:",
    "  /status, /sessions",
    "  /watch may|all|<sessionId>",
    "  /steer <sessionId> <message>",
    "  /cancel <sessionId>|all",
    "  /debug, /raw",
    "  /reload, /restart, /shell, /exit",
    "",
    "Bare text always starts a bounded turn with May.",
  ].join("\n"));
}

function resolveCommandSession(name, reference) {
  const resolved = resolveSessionId(reference);
  if (!resolved.ok) {
    printLine(`[${name}] ${resolved.message}`);
    return null;
  }
  return resolved.sessionId;
}

function handleCommand(input) {
  const [commandRaw, ...restParts] = input.slice(1).trim().split(/\s+/);
  const command = (commandRaw || "help").toLowerCase();
  const rest = restParts.join(" ").trim();

  switch (command) {
    case "help":
      printHelp();
      return;
    case "status":
    case "sessions":
      requestStatus();
      return;
    case "watch": {
      const mode = rest.toLowerCase();
      if (mode === "may" || mode === "chat") {
        watchedSessionId = null;
        subscribe("may");
        return;
      }
      if (mode === "all") {
        watchedSessionId = null;
        subscribe("all");
        return;
      }
      if (mode === "current") {
        if (!watchedSessionId) {
          printLine("[watch] No watched session. Use /watch <sessionId>.");
          return;
        }
        subscribe("current");
        return;
      }
      const sessionId = resolveCommandSession("watch", rest);
      if (!sessionId) {
        if (!rest) printLine("Usage: /watch may|all|<sessionId>");
        return;
      }
      watchedSessionId = sessionId;
      subscribe("current");
      return;
    }
    case "use":
      printLine("[/use] Input always goes to May. Use /watch <sessionId> to inspect or /steer <sessionId> <message> to steer.");
      return;
    case "may":
      watchedSessionId = null;
      subscribe("may");
      printLine("Bare text goes to May.");
      return;
    case "steer": {
      const [reference, ...messageParts] = restParts;
      const message = messageParts.join(" ").trim();
      if (!reference || !message) {
        printLine("Usage: /steer <sessionId> <message>");
        return;
      }
      const sessionId = resolveCommandSession("steer", reference);
      if (sessionId) sendFrame(steerFrame(sessionId, message));
      return;
    }
    case "cancel":
      if (rest.toLowerCase() === "all") {
        sendFrame(cancelAllFrame());
        return;
      }
      if (!rest) {
        printLine("Usage: /cancel <sessionId>|all");
        return;
      }
      {
        const sessionId = resolveCommandSession("cancel", rest);
        if (sessionId) sendFrame(cancelFrame(sessionId));
      }
      return;
    case "new":
      printLine("Every message already starts a bounded May turn.");
      return;
    case "reload":
      sendFrame(runtimeFrame("runtime.reload.requested"));
      return;
    case "restart":
      sendFrame(runtimeFrame("runtime.restart.requested"));
      return;
    case "raw":
      raw = !raw;
      printLine(`[raw ${raw ? "on" : "off"}]`);
      return;
    case "debug":
      debug = !debug;
      printLine(`[debug ${debug ? "on" : "off"}]`);
      return;
    case "shell":
      closing = true;
      if (socket) socket.end();
      rl.close();
      spawn("bash", ["-i"], { stdio: "inherit" }).on("exit", (code) => process.exit(code || 0));
      return;
    case "exit":
    case "quit":
      closeAndExit(0);
      return;
    default:
      printLine(`Unknown command: /${command}. Try /help.`);
  }
}

function handleInput(line) {
  const input = line.trim();
  if (!input) {
    refreshPrompt();
    return;
  }

  if (input.startsWith("/")) {
    handleCommand(input);
    return;
  }

  // A session-only watch would hide the bounded May turn that this input
  // starts. Return to the May view before sending so the reply stays visible.
  if (watchMode === "current") {
    watchedSessionId = null;
    subscribe("may");
  }
  sendFrame(mayInputFrame(input));
  refreshPrompt();
}

function closeAndExit(code) {
  closing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) socket.end();
  rl.close();
  process.exit(code);
}

process.on("SIGINT", () => {
  writeStdout("\n");
  refreshPrompt();
});

rl.on("line", handleInput);
rl.on("close", () => {
  if (!closing && socket) socket.end();
});

console.log("May daemon terminal");
console.log(`Socket: ${socketPath}`);
console.log("Type a message for May. Try /help for console commands.");
refreshPrompt();
connectSocket();
