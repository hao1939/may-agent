#!/usr/bin/env node
const pty = require("node-pty");

const config = JSON.parse(process.argv[2] || "{}");
const cols = Number.isFinite(config.cols) ? config.cols : 120;
const rows = Number.isFinite(config.rows) ? config.rows : 32;
const tmuxName = String(config.tmuxName || "may-web-shell");
const cwd = String(config.cwd || process.cwd());
const command = String(config.command || "bash -i");

function send(frame) {
  process.stdout.write(JSON.stringify(frame) + "\n");
}

const term = pty.spawn("tmux", [
  "new-session",
  "-A",
  "-s",
  tmuxName,
  "-c",
  cwd,
  command,
], {
  name: "xterm-256color",
  cols,
  rows,
  cwd,
  env: {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  },
});

send({ type: "ready", pid: term.pid });

term.onData((data) => send({ type: "data", data }));
term.onExit((event) => {
  send({ type: "exit", exitCode: event.exitCode, signal: event.signal });
  process.exit(event.exitCode || 0);
});

let inputBuffer = "";
process.stdin.on("data", (chunk) => {
  inputBuffer += chunk.toString();
  const lines = inputBuffer.split("\n");
  inputBuffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const frame = JSON.parse(line);
      if (frame.type === "input") term.write(String(frame.data || ""));
      if (frame.type === "resize") term.resize(Number(frame.cols) || cols, Number(frame.rows) || rows);
    } catch (err) {
      send({ type: "error", message: err && err.message ? err.message : String(err) });
    }
  }
});

function shutdown() {
  try { term.kill(); } catch {}
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
