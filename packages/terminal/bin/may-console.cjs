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
let watchMode = "chat"; // chat | all | current
let selectedTarget = "may"; // may | session
let currentSessionId = null;
let currentSessionStatus = null;
let mayChatSessionId = null;
let forceNewChat = false;
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

function promptStatus(status) {
  if (!status || status === "idle") return "";
  return ` ${status}`;
}

function mayChatDisplayStatus(status) {
  if (status === "done") return "ready";
  return status;
}

function promptText() {
  if (!connected) return "may[disconnected]> ";
  if (selectedTarget === "session" && currentSessionId) {
    return `may[${shortSessionId(currentSessionId)}${promptStatus(currentSessionStatus)}]> `;
  }
  const mayStatus = mayChatSessionId ? mayChatDisplayStatus(knownSessions.get(mayChatSessionId)?.status) : null;
  const mayTarget = mayChatSessionId
    ? `may:${shortSessionId(mayChatSessionId)}${promptStatus(mayStatus)}`
    : "may";
  return `may[${mayTarget}]> `;
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
  if (!forceNewChat && String(item.agent || previous.agent || "") === daemonAgent && String(item.kind || previous.kind || "") === "chat") {
    mayChatSessionId = sessionId;
  }
}

function updateCurrentStatus(status) {
  currentSessionStatus = status || null;
}

function isMayChatSession(item) {
  if (!item || typeof item !== "object") return false;
  const previous = typeof item.sessionId === "string" ? knownSessions.get(item.sessionId) || {} : {};
  return String(item.agent || previous.agent || "") === daemonAgent && String(item.kind || previous.kind || "") === "chat";
}

function rememberStatusItems(items) {
  if (!Array.isArray(items)) return false;
  let sawMayChat = false;
  for (const item of items) {
    if (isMayChatSession(item)) sawMayChat = true;
    rememberSession(item);
  }
  if (!sawMayChat && !forceNewChat) mayChatSessionId = null;
  return sawMayChat;
}

function watchSessions() {
  if (watchMode === "all") return ["*"];
  if (watchMode === "current" && currentSessionId) return [currentSessionId];
  return ["chat"];
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

function chatStartFrame(message, opts = {}) {
  const agent = opts.agent || daemonAgent;
  return canonicalFrame("chat.start.requested", {
    agent,
    message,
    channel: source,
    channelThreadId: "local-terminal",
    ...(opts.forceNew ? { forceNew: true } : {}),
  }, { agent });
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
  return sendFrame({ type: "status" });
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
  if (watchMode === "current") return !!currentSessionId && sid === currentSessionId;
  return true;
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
  const sid = typeof event.sessionId === "string" && event.sessionId ? event.sessionId : null;
  if (sid) {
    mayChatSessionId = sid;
    rememberSession({ sessionId: sid, agent: event.agent || daemonAgent, status: "idle", kind: "chat", task: "May chat" });
  }
  const sawMayChat = rememberStatusItems(event.activeAgents);
  if (!sid && !sawMayChat && !forceNewChat) mayChatSessionId = null;
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
  });
  if (String(data.agent || "") === daemonAgent && String(data.kind || "") === "chat") {
    mayChatSessionId = String(data.sessionId || "");
    forceNewChat = false;
  }
  if (data.sessionId === currentSessionId) updateCurrentStatus("running");
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
  if (sessionId === currentSessionId) updateCurrentStatus(status);
  const isMayChat = agent === daemonAgent && (kind === "chat" || sessionId === mayChatSessionId);
  const rawSummary = String(data.summary || data.error || "").trim();
  if (isMayChat && status === "done" && rawSummary && !sessionsWithText.has(sessionId)) {
    printResponseText(rawSummary);
  }
  const summary = isMayChat && status === "done" ? "" : rawSummary;
  const displayStatus = isMayChat ? mayChatDisplayStatus(status) : status;
  printLine(`[${agent}] ${shortSessionId(sessionId)} ${displayStatus}${summary ? `: ${summary.slice(0, 180)}` : ""}`);
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
      return;
    case "error":
      printLine(`[error] ${event.message || "unknown error"}`);
      return;
    case "status":
      printLine(renderStatus(event.activeAgents));
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
      printLine(`[tool] ${event.tool || "unknown"} ${formatToolArgs(event.tool, event.args)}`.trim());
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
      printLine(String(event.message || ""));
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
    "  /watch chat|all|current",
    "  /use <sessionId>",
    "  /steer <message>",
    "  /may",
    "  /cancel, /cancel all",
    "  /new, /reload, /restart",
    "  /raw, /shell, /exit",
  ].join("\n"));
}

function commandNeedsCurrent(name) {
  if (currentSessionId) return true;
  printLine(`[${name}] No current session. Run /sessions then /use <sessionId>.`);
  return false;
}

function commandNeedsSelectedSession(name) {
  if (selectedTarget === "session" && currentSessionId) return true;
  printLine(`[${name}] No selected session. Run /sessions then /use <sessionId>.`);
  return false;
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
      if (mode === "chat") {
        subscribe("chat");
        refreshPrompt();
        return;
      }
      if (mode === "all") {
        subscribe("all");
        return;
      }
      if (mode === "current") {
        if (!commandNeedsCurrent("watch")) return;
        subscribe("current");
        return;
      }
      printLine("Usage: /watch chat|all|current");
      return;
    }
    case "use": {
      const resolved = resolveSessionId(rest);
      if (!resolved.ok) {
        printLine(`[use] ${resolved.message}`);
        return;
      }
      currentSessionId = resolved.sessionId;
      currentSessionStatus = knownSessions.get(currentSessionId)?.status || null;
      selectedTarget = "session";
      subscribe("current");
      refreshPrompt();
      return;
    }
    case "may":
      selectedTarget = "may";
      subscribe("chat");
      refreshPrompt();
      return;
    case "steer":
      if (!commandNeedsSelectedSession("steer")) return;
      if (!rest) {
        printLine("Usage: /steer <message>");
        return;
      }
      sendFrame(steerFrame(currentSessionId, rest));
      return;
    case "cancel":
      if (rest.toLowerCase() === "all") {
        sendFrame(cancelAllFrame());
        return;
      }
      if (selectedTarget === "session" && currentSessionId) {
        sendFrame(cancelFrame(currentSessionId));
        return;
      }
      if (mayChatSessionId) {
        sendFrame(cancelFrame(mayChatSessionId));
        return;
      }
      printLine("[cancel] No May chat session is known. Use /sessions then /use <sessionId>, or /cancel all.");
      return;
    case "new":
      selectedTarget = "may";
      currentSessionId = null;
      currentSessionStatus = null;
      mayChatSessionId = null;
      forceNewChat = true;
      subscribe("chat");
      refreshPrompt();
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

  // Compatibility aliases from the original console banner.
  const lower = input.toLowerCase();
  if (lower === "status") return requestStatus();
  if (lower === "cancel") return handleCommand("/cancel");
  if (lower === "reload") return sendFrame(runtimeFrame("runtime.reload.requested"));
  if (lower === "restart") return sendFrame(runtimeFrame("runtime.restart.requested"));
  if (lower === "exit") return closeAndExit(0);

  if (selectedTarget === "session") {
    if (!commandNeedsCurrent("target")) return;
    sendFrame(steerFrame(currentSessionId, input));
  } else if (!forceNewChat && mayChatSessionId) {
    sendFrame(steerFrame(mayChatSessionId, input));
  } else {
    if (sendFrame(chatStartFrame(input, { forceNew: forceNewChat }))) forceNewChat = false;
  }
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
