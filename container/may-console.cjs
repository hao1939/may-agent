#!/usr/bin/env node
const net = require("node:net");
const path = require("node:path");
const readline = require("node:readline");
const { spawn } = require("node:child_process");

const stateDir = process.env.STATE_DIR || "/app/.state";
const instance = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "background";
const daemonAgent = process.env.DAEMON_AGENT || "may";
const socketPath = path.join(stateDir, "instances", instance, `${daemonAgent}.sock`);

let currentSessionId = null;
let raw = false;
let connected = false;
let buffer = "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "may> ",
});

function write(frame) {
  if (!connected) {
    printLine(`[not connected] ${socketPath}`);
    return;
  }
  socket.write(`${JSON.stringify(frame)}\n`);
}

function printLine(text = "") {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`${text}\n`);
  rl.prompt(true);
}

function payload(event) {
  return event && typeof event.data === "object" && event.data && !Array.isArray(event.data)
    ? event.data
    : event;
}

function eventSessionId(event) {
  const data = payload(event);
  return typeof data.sessionId === "string" ? data.sessionId : null;
}

function isCurrentSessionEvent(event) {
  const sid = eventSessionId(event);
  return !sid || !currentSessionId || sid === currentSessionId;
}

function formatStatus(items) {
  if (!Array.isArray(items) || items.length === 0) return "[status] No active agents";
  return items
    .map((item) => {
      const agent = String(item.agent || item.name || "?");
      const status = String(item.status || "?");
      const task = String(item.task || "").slice(0, 100);
      return `  ${agent}: ${status}${task ? ` - ${task}` : ""}`;
    })
    .join("\n");
}

function handleEvent(event) {
  if (!event || typeof event !== "object") return;
  if (raw) {
    printLine(JSON.stringify(event));
    return;
  }

  const data = payload(event);
  switch (event.type) {
    case "connected":
      connected = true;
      currentSessionId = typeof event.sessionId === "string" && event.sessionId ? event.sessionId : currentSessionId;
      printLine(`Connected to ${event.agent || daemonAgent} (${event.instance || instance})`);
      write({ type: "subscribe", sessions: ["*"] });
      return;
    case "ok":
      return;
    case "error":
      printLine(`[error] ${event.message || "unknown error"}`);
      return;
    case "status":
      printLine(formatStatus(event.activeAgents));
      return;
    case "session.start":
      if (String(data.agent || "") === daemonAgent || String(data.kind || "") === "chat" || !currentSessionId) {
        currentSessionId = String(data.sessionId || currentSessionId || "");
        printLine(`[${data.agent || daemonAgent}] started ${currentSessionId}`);
      }
      return;
    case "text":
      if (isCurrentSessionEvent(event)) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(String(event.text || ""));
      }
      return;
    case "tool_call":
      if (isCurrentSessionEvent(event)) printLine(`[tool] ${event.tool || "unknown"}`);
      return;
    case "tool_result":
      if (isCurrentSessionEvent(event) && event.isError) printLine(`[tool error] ${event.tool || "unknown"}: ${String(event.preview || "").slice(0, 200)}`);
      return;
    case "session.end":
      if (isCurrentSessionEvent(event)) {
        const status = String(data.status || "done");
        const summary = String(data.summary || data.error || "").trim();
        printLine(`[${data.agent || daemonAgent}] ${status}${summary ? `: ${summary}` : ""}`);
      }
      return;
    case "message.created":
      if (data.to === "human") printLine(`${data.from || "may"}: ${data.content || ""}`);
      return;
    case "info":
      printLine(String(event.message || ""));
      return;
  }
}

const socket = net.createConnection(socketPath);

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

socket.on("connect", () => {
  connected = true;
});

socket.on("error", (err) => {
  printLine(`[socket error] ${err.message}`);
  printLine(`Expected daemon socket: ${socketPath}`);
});

socket.on("close", () => {
  connected = false;
  printLine("[disconnected]");
});

process.on("SIGINT", () => {
  process.stdout.write("\n");
  rl.prompt(true);
});

rl.on("line", (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }
  if (input === "exit" || input === "/exit") {
    socket.end();
    process.exit(0);
  }
  if (input === "/shell") {
    socket.end();
    rl.close();
    spawn("bash", ["-i"], { stdio: "inherit" }).on("exit", (code) => process.exit(code || 0));
    return;
  }
  if (input === "/raw") {
    raw = !raw;
    printLine(`[raw ${raw ? "on" : "off"}]`);
    return;
  }
  write({ type: "input", message: input, source: "may-console" });
  rl.prompt();
});

rl.on("close", () => {
  socket.end();
});

console.log("May daemon terminal");
console.log(`Socket: ${socketPath}`);
console.log("Type a message for May. Commands: status, cancel, reload, /raw, /shell, exit.");
rl.prompt();
