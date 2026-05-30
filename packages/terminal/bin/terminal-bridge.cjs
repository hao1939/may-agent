#!/usr/bin/env node
const pty = require("node-pty");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const config = JSON.parse(process.argv[2] || "{}");
const cols = Number.isFinite(config.cols) ? config.cols : 120;
const rows = Number.isFinite(config.rows) ? config.rows : 32;
const profileId = String(config.profileId || "");
const tmuxName = String(config.tmuxName || "may-web-shell");
const cwd = String(config.cwd || process.cwd());
const command = String(config.command || "bash -i");
const tmuxSocket = String(config.tmuxSocket || "may-web");
const commandHash = createHash("sha256").update(command).digest("hex").slice(0, 16);

function send(frame) {
  process.stdout.write(JSON.stringify(frame) + "\n");
}

function tmux(args) {
  return spawnSync("tmux", ["-L", tmuxSocket, ...args], { stdio: "ignore" });
}

function tmuxText(args) {
  return spawnSync("tmux", ["-L", tmuxSocket, ...args], { encoding: "utf8" });
}

function tmuxEnvironmentValue(name) {
  const result = tmuxText(["show-environment", "-t", tmuxName, name]);
  if (result.status !== 0) return null;
  const text = String(result.stdout || "").trim();
  const prefix = `${name}=`;
  return text.startsWith(prefix) ? text.slice(prefix.length) : null;
}

function markTmuxSession() {
  if (profileId) tmux(["set-environment", "-t", tmuxName, "MAY_TERMINAL_PROFILE_ID", profileId]);
  tmux(["set-environment", "-t", tmuxName, "MAY_TERMINAL_COMMAND_HASH", commandHash]);
}

function existingTmuxSessionIsCurrent() {
  const existing = tmux(["has-session", "-t", tmuxName]);
  if (existing.status !== 0) return false;

  const actualProfileId = tmuxEnvironmentValue("MAY_TERMINAL_PROFILE_ID");
  const actualCommandHash = tmuxEnvironmentValue("MAY_TERMINAL_COMMAND_HASH");
  return actualProfileId === profileId && actualCommandHash === commandHash;
}

function configureTmux() {
  const options = [
    ["set-option", "-g", "mouse", "on"],
    ["set-option", "-g", "history-limit", "100000"],
    ["set-option", "-g", "focus-events", "on"],
    ["set-option", "-g", "escape-time", "10"],
  ];

  for (const args of options) {
    tmux(args);
  }
}

function ensureTmuxSession() {
  const existing = tmux(["has-session", "-t", tmuxName]);
  if (existing.status === 0 && !existingTmuxSessionIsCurrent()) {
    tmux(["kill-session", "-t", tmuxName]);
  }

  if (!existingTmuxSessionIsCurrent()) {
    const created = tmux([
      "new-session",
      "-d",
      "-s",
      tmuxName,
      "-c",
      cwd,
      command,
    ]);
    if (created.status !== 0) {
      send({ type: "error", message: `Unable to create tmux session: ${tmuxName}` });
    } else {
      markTmuxSession();
    }
  }
}

ensureTmuxSession();
configureTmux();

const term = pty.spawn("tmux", [
  "-L",
  tmuxSocket,
  "attach-session",
  "-t",
  tmuxName,
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
