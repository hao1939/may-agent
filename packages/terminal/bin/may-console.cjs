#!/usr/bin/env node
const net = require("node:net");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const readline = require("node:readline");
const { spawn } = require("node:child_process");

const stateDir = process.env.STATE_DIR || "/app/.state";
const instance = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "background";
const daemonAgent = process.env.DAEMON_AGENT || "may";
const socketPath = path.join(stateDir, "instances", instance, `${daemonAgent}.sock`);
const source = "may-console";
const conversationId = `${daemonAgent}:primary`;
const adapterInstanceId = randomUUID();

let socket = null;
let connected = false;
let closing = false;
let reconnectTimer = null;
let reconnectDelayMs = 250;
let buffer = "";
let raw = false;
let debug = false;
let watchedTask = null;
let watchedTaskReadInFlight = false;
let watchedTaskDirty = false;
let lastDisconnectedMessage = "";
let conversationReady = false;
const pendingInputLines = [];

const renderedConversationMessages = new Set();
function rememberRenderedConversationMessage(messageId) {
  renderedConversationMessages.add(messageId);
  // Passive reads contain 30 messages. Retain several windows for reconnect
  // deduplication without growing with the append-only Conversation forever.
  while (renderedConversationMessages.size > 256) {
    const oldest = renderedConversationMessages.values().next().value;
    if (typeof oldest !== "string") break;
    renderedConversationMessages.delete(oldest);
  }
}
let lastConversationSequence = Date.now();
let lastWork = [];
const pendingConversationReads = [];
let conversationSyncDirty = false;
const pendingAppReads = [];
const pendingTaskListReads = [];
const pendingTaskReads = [];
let nextTaskPage = null;
const pendingRuntimeControls = new Map();
const knownAppIds = new Set();
const knownTaskRefs = new Set();

function rememberCompletion(set, value, limit) {
  if (set.has(value)) set.delete(value);
  set.add(value);
  while (set.size > limit) set.delete(set.values().next().value);
}

const ordinaryCommands = [
  "/apps",
  "/tasks",
  "/task",
  "/watch",
  "/unwatch",
  "/cancel",
  "/help",
  "/reload",
  "/restart",
  "/shell",
  "/exit",
];

function completeInput(line) {
  const input = String(line || "");
  const parts = input.split(/\s+/);
  if (parts.length === 1) {
    const matches = ordinaryCommands.filter((command) => command.startsWith(parts[0]));
    return [matches.length ? matches : ordinaryCommands, parts[0]];
  }
  const command = parts[0];
  const current = parts.at(-1) || "";
  const choices =
    command === "/apps"
      ? [...knownAppIds]
      : command === "/tasks"
        ? [...knownAppIds, "all"]
        : command === "/task" || command === "/watch" || command === "/cancel"
          ? [...knownTaskRefs]
          : [];
  const matches = choices.filter((choice) => choice.startsWith(current));
  return [matches.length ? matches : choices, current];
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  historySize: 1000,
  completer: completeInput,
});

function shortSessionId(sessionId) {
  const text = String(sessionId || "");
  if (text.length <= 12) return text;
  return text.slice(0, 10);
}

function promptText() {
  if (!connected) return "you[disconnected]> ";
  if (watchedTask) return `you[task ${watchedTask.ref}]> `;
  return "you> ";
}

function refreshPrompt() {
  if (closing) return;
  rl.setPrompt(promptText());
  rl.prompt(true);
}

function writeStdout(text, callback) {
  process.stdout.write(text, callback);
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

function printConversationText(speaker, text = "", onRendered) {
  try {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  } catch {
    // Non-TTY output is fine in tests and logs.
  }
  const value = String(text || "").trimEnd();
  if (!value) {
    refreshPrompt();
    if (onRendered) onRendered();
    return;
  }
  writeStdout(`\n${speaker}> ${value}\n\n`, onRendered);
  refreshPrompt();
}

function printResponseText(text = "", onRendered) {
  printConversationText("may", text, onRendered);
}

function eventPayload(event) {
  return event && typeof event.data === "object" && event.data && !Array.isArray(event.data) ? event.data : {};
}

function flatPayload(event) {
  const data = eventPayload(event);
  return Object.keys(data).length > 0 ? data : event || {};
}

function subscribedSessions() {
  return debug || raw ? ["*"] : [];
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

function mayInputFrame(message) {
  const sequence = Math.max(Date.now(), lastConversationSequence + 1);
  lastConversationSequence = sequence;
  const messageId = `${source}:${adapterInstanceId}:${sequence}`;
  // Readline already rendered this human turn in the current terminal. Keep
  // its durable identity so a Conversation wake does not echo it back here,
  // while turns from another Console process remain visible.
  rememberRenderedConversationMessage(messageId);
  return {
    type: "publish",
    event: {
      type: "conversation.message.created",
      target: { appId: "may" },
      data: {
        conversationId,
        author: { kind: "human", id: messageId },
        text: message,
        ...(watchedTask ? { context: { focusedTask: { appId: watchedTask.appId, taskId: watchedTask.taskId } } } : {}),
        metadata: { channel: source, channelThreadId: "local-terminal" },
      },
      idempotencyKey: messageId,
    },
  };
}

function requestConversation(kind = "startup") {
  if (
    kind === "sync" &&
    pendingConversationReads.some((pending) => pending.kind === "startup" || pending.kind === "sync")
  ) {
    conversationSyncDirty = true;
    return true;
  }
  if (kind === "sync") conversationSyncDirty = false;
  pendingConversationReads.push({ kind });
  const sent = sendFrame(
    {
      type: "app.conversation.get",
      appId: "may",
      conversationId,
      limit: 30,
      includeWork: false,
    },
    { silent: true },
  );
  if (!sent) pendingConversationReads.pop();
  return sent;
}

function requestWork(options = {}) {
  const detailRequestId = typeof options.detailRequestId === "string" ? options.detailRequestId : null;
  const all = options.all === true;
  const transient = options.transient === true;
  const command = typeof options.command === "string" ? options.command : "/work";
  const pending = detailRequestId
    ? { kind: "detail", requestId: detailRequestId, command, transient }
    : { kind: "list", all, command, transient };
  pendingConversationReads.push(pending);
  const sent = sendFrame(
    {
      type: "app.conversation.get",
      appId: "may",
      conversationId,
      ...(detailRequestId ? { workRequestId: detailRequestId } : {}),
      ...(all ? { allWork: true } : {}),
    },
    { silent: true },
  );
  if (!sent) pendingConversationReads.pop();
  return sent;
}

function requestApps(appId = null, command = "/apps") {
  pendingAppReads.push({ appId, command });
  const sent = sendFrame({ type: "apps.list", ...(appId ? { appId } : {}) }, { silent: true });
  if (!sent) pendingAppReads.pop();
  return sent;
}

function requestTasks(options = {}) {
  const pending = {
    appId: options.appId || null,
    includeDone: options.includeDone === true,
    command: options.command || "/tasks",
    cursor: options.cursor || null,
  };
  pendingTaskListReads.push(pending);
  const sent = sendFrame(
    {
      type: "tasks.list",
      ...(pending.appId ? { appId: pending.appId } : {}),
      ...(pending.includeDone ? { includeDone: true } : {}),
      ...(pending.cursor ? { cursor: pending.cursor } : {}),
      limit: 30,
    },
    { silent: true },
  );
  if (!sent) pendingTaskListReads.pop();
  return sent;
}

function requestTask(input) {
  const pending = {
    kind: input.kind || "detail",
    command: input.command || `/task ${input.ref || ""}`.trim(),
  };
  pendingTaskReads.push(pending);
  if (pending.kind === "watch-refresh") watchedTaskReadInFlight = true;
  const sent = sendFrame(
    {
      type: "task.get",
      ...(input.ref ? { ref: input.ref } : {}),
      ...(input.appId ? { appId: input.appId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
    },
    { silent: true },
  );
  if (!sent) {
    pendingTaskReads.pop();
    if (pending.kind === "watch-refresh") watchedTaskReadInFlight = false;
  }
  return sent;
}

function appendConversationMessage({ author, text, transient = false, metadata = {} }) {
  const sequence = Math.max(Date.now(), lastConversationSequence + 1);
  lastConversationSequence = sequence;
  sendFrame(
    {
      type: "publish",
      event: {
        type: "conversation.message.created",
        target: { appId: "may" },
        data: {
          conversationId,
          author,
          text,
          ...(transient ? { transient: true } : {}),
          metadata: { channel: source, ...metadata },
        },
        idempotencyKey: `${source}:${adapterInstanceId}:conversation:${sequence}`,
      },
    },
    { silent: true },
  );
}

function presentView(command, text, options = {}) {
  printLine(text);
  appendConversationMessage({
    author: { kind: "command", id: source },
    text,
    transient: options.transient === true,
    metadata: {
      command,
      ...(Array.isArray(options.requestIds) && options.requestIds.length > 0 ? { requestIds: options.requestIds } : {}),
      ...(Array.isArray(options.taskRefs) && options.taskRefs.length > 0 ? { taskRefs: options.taskRefs } : {}),
    },
  });
}

function taskIdentity(task) {
  return task && typeof task.appId === "string" && typeof task.taskId === "string"
    ? { appId: task.appId, taskId: task.taskId }
    : null;
}

function taskResult(task) {
  if (typeof task?.response === "string" && task.response.trim()) return task.response.trim();
  if (typeof task?.summary === "string" && task.summary.trim()) return task.summary.trim();
  return "";
}

function renderApps(apps, pending) {
  if (!Array.isArray(apps)) return;
  const lines = ["", pending?.appId ? `App ${pending.appId}:` : "Apps:"];
  if (apps.length === 0) lines.push("  Nothing found.");
  for (const app of apps) {
    if (typeof app.id === "string" && app.id.trim()) rememberCompletion(knownAppIds, app.id.trim(), 256);
    const active = Number(app.activeTasks || 0);
    const details = [
      `${active} active`,
      ...(Number(app.runningTasks || 0) ? [`${app.runningTasks} running`] : []),
      ...(Number(app.waitingTasks || 0) ? [`${app.waitingTasks} waiting`] : []),
      ...(Number(app.attentionTasks || 0) ? [`${app.attentionTasks} attention`] : []),
    ];
    lines.push(`  ${app.id} — ${details.join(" · ")}`);
    if (pending?.appId && typeof app.description === "string" && app.description.trim()) {
      lines.push(`    ${app.description.trim()}`);
    }
  }
  lines.push("");
  presentView(pending?.command || "/apps", lines.join("\n"));
}

function renderTasks(page, pending) {
  const tasks = Array.isArray(page?.items) ? page.items : [];
  const title = pending?.includeDone ? "Tasks (active and recent):" : "Active Tasks:";
  const lines = ["", title];
  if (tasks.length === 0) lines.push("  Nothing found.");
  for (const task of tasks) {
    if (typeof task.ref === "string" && task.ref.trim()) rememberCompletion(knownTaskRefs, task.ref.trim(), 512);
    if (typeof task.appId === "string" && task.appId.trim()) rememberCompletion(knownAppIds, task.appId.trim(), 256);
    const result = taskResult(task);
    lines.push(
      `  ${String(task.ref || "????????").padEnd(16)} ${String(task.appId || "?").padEnd(20)} ${String(task.status || "?").padEnd(9)} ${String(task.outcome || task.taskId || "Task")}`,
    );
    if (task.terminal && result) lines.push(...result.split("\n").map((line) => `    ${line}`));
  }
  nextTaskPage = page?.nextCursor
    ? {
        appId: pending?.appId || null,
        includeDone: pending?.includeDone === true,
        cursor: page.nextCursor,
      }
    : null;
  if (nextTaskPage) lines.push("  More Tasks are available; run /tasks more for the next page.");
  lines.push("");
  presentView(pending?.command || "/tasks", lines.join("\n"), {
    taskRefs: tasks.map(taskIdentity).filter(Boolean),
  });
}

function renderTask(task, command, options = {}) {
  if (!task || typeof task !== "object") {
    printLine("[task] Task not found.");
    return;
  }
  if (typeof task.ref === "string" && task.ref.trim()) rememberCompletion(knownTaskRefs, task.ref.trim(), 512);
  if (typeof task.appId === "string" && task.appId.trim()) rememberCompletion(knownAppIds, task.appId.trim(), 256);
  const lines = [
    "",
    `Task ${task.ref}:`,
    `  App: ${task.appId}`,
    `  ID: ${task.taskId}`,
    `  Status: ${task.status}`,
    `  Outcome: ${task.outcome}`,
    `  Updated: ${formatWorkTime(task.updatedAt)}`,
  ];
  const result = taskResult(task);
  if (result)
    lines.push(task.terminal ? "  Result:" : "  Progress:", ...result.split("\n").map((line) => `    ${line}`));
  if (task.execution?.sessionId) lines.push(`  Diagnostic session: ${task.execution.sessionId}`);
  lines.push("");
  if (options.transient) printLine(lines.join("\n"));
  else presentView(command, lines.join("\n"), { taskRefs: [taskIdentity(task)] });
}

function setWatchedTask(task) {
  watchedTask = task && !task.terminal ? { appId: task.appId, taskId: task.taskId, ref: task.ref } : null;
  watchedTaskDirty = false;
  subscribe();
  refreshPrompt();
}

function refreshWatchedTask() {
  if (!watchedTask) return;
  if (watchedTaskReadInFlight) {
    watchedTaskDirty = true;
    return;
  }
  requestTask({
    kind: "watch-refresh",
    appId: watchedTask.appId,
    taskId: watchedTask.taskId,
    command: `/watch ${watchedTask.ref}`,
  });
}

function renderWorkList(work, pending) {
  if (!Array.isArray(work)) return;
  lastWork = work;
  const all = pending?.all === true;
  const command = pending?.command || (all ? "/work all" : "/work");
  const title = all ? "All work (newest first):" : "Active work:";
  if (work.length === 0) {
    presentView(command, `\n${title} nothing.\n`, { transient: pending?.transient === true });
    return;
  }
  const lines = ["", title];
  work.forEach((item, index) => {
    const message = typeof item.message === "string" && item.message.trim() ? item.message.trim() : "Request";
    const state = workStateLabel(item.state);
    const baseline = Number(item.startedAt ?? item.createdAt);
    const changedAt = Number(item.changedAt);
    const age = formatWorkAge(baseline);
    const changed = formatWorkAge(item.changedAt);
    const showChanged = Number.isFinite(baseline) && Number.isFinite(changedAt) && changedAt > baseline;
    lines.push(`  ${index + 1}. ${message} — ${state} · ${age}${showChanged ? ` · changed ${changed}` : ""}`);
    if (typeof item.progress === "string" && item.progress.trim()) {
      lines.push(`     ${item.progress.trim()}`);
    }
    const result = item.result && typeof item.result === "object" ? item.result : null;
    const resultText =
      result && typeof result.response === "string" && result.response.trim()
        ? result.response.trim()
        : result && typeof result.summary === "string" && result.summary.trim()
          ? result.summary.trim()
          : "";
    if (resultText) {
      lines.push("     Result:", ...resultText.split("\n").map((line) => `       ${line}`));
    }
  });
  lines.push("");
  presentView(command, lines.join("\n"), {
    transient: pending?.transient === true,
    requestIds: work.map((item) => item.requestId).filter((id) => typeof id === "string" && id),
  });
}

function workStateLabel(state) {
  const labels = {
    queued: "Queued",
    working: "Working",
    analyzing: "Analyzing",
    waiting: "Waiting",
    ready: "Ready",
    done: "Done",
  };
  return labels[state] || "Working";
}

function formatWorkTime(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "Unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function formatWorkAge(value, now = Date.now()) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "unknown age";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatWorkRef(ref) {
  if (!ref || typeof ref !== "object" || typeof ref.kind !== "string" || typeof ref.id !== "string") return null;
  return `${ref.kind}:${ref.id}`;
}

function renderWorkDetail(work, requestId, command) {
  if (!Array.isArray(work)) return;
  const index = lastWork.findIndex((item) => item && item.requestId === requestId);
  const selected = lastWork.find((item) => item && item.requestId === requestId);
  const refreshed = work.find((item) => item && item.requestId === requestId);
  if (!refreshed) {
    const message = selected && typeof selected.message === "string" ? selected.message.trim() : "Selected request";
    presentView(
      command,
      ["", `Work ${index >= 0 ? index + 1 : "item"}:`, `  Request: ${message}`, "  Status: Not found", ""].join("\n"),
    );
    return;
  }
  if (index >= 0) lastWork[index] = refreshed;
  const message =
    typeof refreshed.message === "string" && refreshed.message.trim() ? refreshed.message.trim() : "Request";
  const progress =
    typeof refreshed.progress === "string" && refreshed.progress.trim()
      ? refreshed.progress.trim()
      : "No durable progress update yet.";
  const result = refreshed.result && typeof refreshed.result === "object" ? refreshed.result : null;
  const resultText =
    result && typeof result.response === "string" && result.response.trim()
      ? result.response.trim()
      : result && typeof result.summary === "string" && result.summary.trim()
        ? result.summary.trim()
        : "";
  presentView(
    command,
    [
      "",
      `Work ${index >= 0 ? index + 1 : "item"}:`,
      `  Request: ${message}`,
      `  Status: ${workStateLabel(refreshed.state)}`,
      `  Progress: ${progress}`,
      ...(resultText ? ["  Result:", ...resultText.split("\n").map((line) => `    ${line}`)] : []),
      `  Created: ${formatWorkTime(refreshed.createdAt)}`,
      ...(refreshed.startedAt === undefined ? [] : [`  Started: ${formatWorkTime(refreshed.startedAt)}`]),
      `  Changed: ${formatWorkTime(refreshed.changedAt)}`,
      ...(formatWorkRef(refreshed.executor) ? [`  Execution: ${formatWorkRef(refreshed.executor)}`] : []),
      ...(formatWorkRef(refreshed.dependency) ? [`  Waiting on: ${formatWorkRef(refreshed.dependency)}`] : []),
      "",
    ].join("\n"),
    { requestIds: [refreshed.requestId] },
  );
}

function renderConversation(messages) {
  if (!Array.isArray(messages)) return;
  for (const message of messages) {
    const id = typeof message.id === "string" ? message.id : "";
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!id || !text || renderedConversationMessages.has(id)) continue;
    const channel = message.metadata && typeof message.metadata.channel === "string" ? message.metadata.channel : "";
    const kind = message.author && typeof message.author.kind === "string" ? message.author.kind : "agent";
    const baseSpeaker = kind === "human" ? "you" : kind === "agent" ? "may" : kind;
    const speaker = channel && channel !== source ? `${baseSpeaker}[${channel}]` : baseSpeaker;
    printConversationText(speaker, text);
    rememberRenderedConversationMessage(id);
  }
}

function runtimeFrame(type) {
  const requestId = `${source}:${adapterInstanceId}:${randomUUID()}`;
  return {
    type: "publish",
    event: {
      type,
      data: { requestId },
      idempotencyKey: requestId,
    },
  };
}

function subscribe() {
  return sendFrame({
    type: "subscribe",
    sessions: subscribedSessions(),
    conversations: [conversationId],
    task: watchedTask ? { appId: watchedTask.appId, taskId: watchedTask.taskId } : null,
  });
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
  printLine(`Connected to ${event.agent || daemonAgent} (${event.instance || instance})`);
}

function handleSessionStart(event) {
  const data = flatPayload(event);
  if (!debug) return;
  const parent = data.parentSessionId ? ` child of ${shortSessionId(data.parentSessionId)}` : "";
  printLine(
    `[${data.agent || daemonAgent}] started ${shortSessionId(data.sessionId)}${parent}: ${String(data.task || "").slice(0, 100)}`,
  );
}

function handleSessionEnd(event) {
  const data = flatPayload(event);
  const sessionId = typeof data.sessionId === "string" ? data.sessionId : "";
  const agent = String(data.agent || daemonAgent);
  const status = String(data.status || "done");
  if (!debug) return;
  const rawSummary = String(data.summary || data.error || "").trim();
  printLine(`[${agent}] ${shortSessionId(sessionId)} ${status}${rawSummary ? `: ${rawSummary.slice(0, 180)}` : ""}`);
}

function handleEvent(event) {
  if (!event || typeof event !== "object") return;
  if (event.type === "runtime.reload.finished") {
    const data = flatPayload(event);
    const requestId = typeof data.requestId === "string" ? data.requestId : "";
    const command = pendingRuntimeControls.get(requestId);
    if (command) {
      pendingRuntimeControls.delete(requestId);
      presentView(command, typeof data.summary === "string" ? data.summary : "[reload] Finished");
    }
    return;
  }
  if (event.type === "app.task.updated") {
    const data = flatPayload(event);
    if (watchedTask && data.appId === watchedTask.appId && data.taskId === watchedTask.taskId) {
      refreshWatchedTask();
    }
    return;
  }
  if (event.type === "conversation.updated") {
    const data = flatPayload(event);
    if (data.conversationId === conversationId) {
      conversationSyncDirty = true;
      requestConversation("sync");
    }
    return;
  }
  if (raw) {
    printLine(JSON.stringify(event));
    return;
  }

  if (event.type === "conversation.message.created") {
    const data = flatPayload(event);
    const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
    const author = data.author && typeof data.author === "object" ? data.author : {};
    if (metadata.channel === source && author.id !== source && typeof data.text === "string") {
      const speaker = author.kind === "agent" ? "may" : author.kind || "notice";
      printConversationText(speaker, data.text);
    }
    return;
  }

  const data = flatPayload(event);
  switch (event.type) {
    case "connected":
      handleConnected(event);
      return;
    case "ok":
      if (event.command === "publish" && Number.isSafeInteger(event.eventId) && event.eventId > 0) {
        // Non-human Conversation events are projected by durable event row ID.
        // Marking every local publish receipt is harmless for other event kinds.
        rememberRenderedConversationMessage(`event:${event.eventId}`);
      }
      if (event.command === "app.conversation.get") {
        const pending = pendingConversationReads.shift();
        if (pending?.kind === "startup") {
          renderConversation(event.conversation?.messages);
          lastWork = Array.isArray(event.conversation?.work) ? event.conversation.work : [];
          conversationReady = true;
          flushPendingInput();
        } else if (pending?.kind === "sync") {
          renderConversation(event.conversation?.messages);
        } else if (pending?.kind === "detail") {
          renderWorkDetail(event.conversation?.work, pending.requestId, pending.command);
        } else {
          renderWorkList(event.conversation?.work, pending);
        }
        if (conversationSyncDirty) requestConversation("sync");
      }
      if (event.command === "apps.list") {
        renderApps(event.apps, pendingAppReads.shift());
      }
      if (event.command === "tasks.list") {
        renderTasks(event.tasks, pendingTaskListReads.shift());
      }
      if (event.command === "task.get") {
        const pending = pendingTaskReads.shift();
        const task = event.task;
        if (pending?.kind === "watch-start") {
          renderTask(task, pending.command);
          if (task?.terminal) {
            setWatchedTask(null);
            printLine("[watch] Task is already terminal.");
          } else if (task) {
            setWatchedTask(task);
            printLine(`[watch] Watching ${task.ref}. Bare text is Task feedback through May.`);
          }
        } else if (pending?.kind === "watch-refresh") {
          watchedTaskReadInFlight = false;
          renderTask(task, pending.command, { transient: true });
          if (!task || task.terminal) {
            setWatchedTask(null);
            if (task?.terminal) printLine("[watch] Task finished; watch ended.");
          } else if (watchedTask) {
            watchedTask.ref = task.ref;
          }
          if (watchedTaskDirty) {
            watchedTaskDirty = false;
            refreshWatchedTask();
          }
        } else {
          renderTask(task, pending?.command || "/task");
        }
      }
      if (event.command === "task.cancel") {
        const task = event.task;
        if (task) renderTask(task, "/cancel");
        else printLine("[cancel] Cancellation was accepted.");
      }
      // Admission is transport bookkeeping. May's durable acknowledgement or
      // answer is the human-visible response.
      return;
    case "error":
      if (event.command === "app.conversation.get") {
        const pending = pendingConversationReads.shift();
        if (pending?.kind === "startup") {
          conversationReady = true;
          flushPendingInput();
        }
      }
      if (event.command === "apps.list") pendingAppReads.shift();
      if (event.command === "tasks.list") pendingTaskListReads.shift();
      if (event.command === "task.get") {
        const pending = pendingTaskReads.shift();
        if (pending?.kind === "watch-refresh") watchedTaskReadInFlight = false;
      }
      printLine(`[error] ${event.message || "unknown error"}`);
      return;
    case "session.start":
      handleSessionStart(event);
      return;
    case "text":
      if (!debug) return;
      try {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
      } catch {}
      writeStdout(String(event.text || ""));
      return;
    case "tool_call":
      if (debug) printLine(`[tool] ${event.tool || "unknown"} ${formatToolArgs(event.tool, event.args)}`.trim());
      return;
    case "tool_result":
      if (event.isError)
        printLine(`[tool error] ${event.tool || "unknown"}: ${String(event.preview || "").slice(0, 200)}`);
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
      if (debug) printLine(String(event.message || ""));
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
    sendFrame(
      {
        type: "subscribe",
        sessions: subscribedSessions(),
        conversations: [conversationId],
        task: watchedTask ? { appId: watchedTask.appId, taskId: watchedTask.taskId } : null,
      },
      { silent: true },
    );
    requestConversation();
    watchedTaskReadInFlight = false;
    refreshWatchedTask();
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
    conversationReady = false;
    socket = null;
    pendingConversationReads.length = 0;
    pendingAppReads.length = 0;
    pendingTaskListReads.length = 0;
    pendingTaskReads.length = 0;
    watchedTaskReadInFlight = false;
    if (closing) return;
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
  printLine(
    [
      "Commands:",
      "  /apps [app]",
      "  /tasks [app] [all], /tasks more",
      "  /task <ref>",
      "  /watch [ref], /unwatch",
      "  /cancel [ref]",
      "  /reload, /restart, /shell, /exit",
      "",
      "Bare text goes to May. While watching, it is feedback for that Task.",
    ].join("\n"),
  );
}

function handleCommand(input) {
  const [commandRaw, ...restParts] = input.slice(1).trim().split(/\s+/);
  const command = (commandRaw || "help").toLowerCase();
  const rest = restParts.join(" ").trim();

  switch (command) {
    case "help":
      printHelp();
      return;
    case "apps":
      if (restParts.length > 1) {
        printLine("Usage: /apps [app]");
        return;
      }
      requestApps(rest || null, input);
      return;
    case "tasks": {
      if (restParts.length === 1 && restParts[0].toLowerCase() === "more") {
        if (!nextTaskPage) {
          printLine("[tasks] No next page. Run /tasks first.");
          return;
        }
        requestTasks({ ...nextTaskPage, command: input });
        return;
      }
      const includeDone = restParts.some((part) => part.toLowerCase() === "all");
      const appIds = restParts.filter((part) => part.toLowerCase() !== "all");
      if (appIds.length > 1) {
        printLine("Usage: /tasks [app] [all], or /tasks more");
        return;
      }
      requestTasks({ appId: appIds[0], includeDone, command: input });
      return;
    }
    case "task":
      if (!rest || restParts.length !== 1) {
        printLine("Usage: /task <ref>");
        return;
      }
      requestTask({ ref: rest, command: input });
      return;
    // Temporary diagnostic alias for the old Host-request projection. It is
    // deliberately absent from help and must not be confused with Tasks.
    case "work":
      if (!rest) {
        requestWork({ command: "/work" });
        return;
      }
      if (rest.toLowerCase() === "all") {
        requestWork({ all: true, command: "/work all" });
        return;
      }
      if (!/^[1-9]\d*$/.test(rest)) {
        printLine("Usage: /work [all|positive number]");
        return;
      }
      {
        const selected = lastWork[Number(rest) - 1];
        if (!selected || typeof selected.requestId !== "string") {
          printLine(`[work] No item ${rest}. Use /work to refresh the list.`);
          return;
        }
        requestWork({ detailRequestId: selected.requestId, command: `/work ${rest}` });
      }
      return;
    case "watch": {
      if (!rest) {
        if (!watchedTask) {
          printLine("[watch] No Task is watched. Use /watch <ref>.");
          return;
        }
        requestTask({
          kind: "detail",
          appId: watchedTask.appId,
          taskId: watchedTask.taskId,
          command: "/watch",
        });
        return;
      }
      if (restParts.length !== 1) {
        printLine("Usage: /watch [ref]");
        return;
      }
      requestTask({ kind: "watch-start", ref: rest, command: input });
      return;
    }
    case "unwatch":
      if (rest) {
        printLine("Usage: /unwatch");
        return;
      }
      if (!watchedTask) {
        printLine("[watch] No Task is watched.");
        return;
      }
      watchedTask = null;
      watchedTaskDirty = false;
      subscribe();
      printLine("Stopped watching. The Task is unchanged.");
      return;
    case "cancel": {
      if (restParts.length > 1) {
        printLine("Usage: /cancel [ref]");
        return;
      }
      if (rest) {
        sendFrame({ type: "task.cancel", ref: rest, reason: "human requested cancellation" });
        return;
      }
      if (!watchedTask) {
        printLine("Usage: /cancel <ref>, or watch a Task first.");
        return;
      }
      sendFrame({
        type: "task.cancel",
        appId: watchedTask.appId,
        taskId: watchedTask.taskId,
        reason: "human requested cancellation",
      });
      return;
    }
    case "reload":
      {
        const frame = runtimeFrame("runtime.reload.requested");
        pendingRuntimeControls.set(frame.event.data.requestId, input);
        if (!sendFrame(frame)) pendingRuntimeControls.delete(frame.event.data.requestId);
      }
      return;
    case "restart":
      sendFrame(runtimeFrame("runtime.restart.requested"));
      return;
    case "raw":
      raw = !raw;
      subscribe();
      printLine(`[raw ${raw ? "on" : "off"}]`);
      return;
    case "debug":
      debug = !debug;
      subscribe();
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

  // Commands such as `/work 1` depend on the current rendered work list, and
  // ordinary turns should follow the Conversation history the human is about
  // to see. Preserve early keystrokes until the initial Conversation snapshot
  // arrives instead of executing them against an empty local view.
  if (!connected || !conversationReady) {
    pendingInputLines.push(input);
    printLine("[waiting for May; input queued]");
    return;
  }

  if (input.startsWith("/")) {
    handleCommand(input);
    return;
  }

  sendFrame(mayInputFrame(input));
  refreshPrompt();
}

function flushPendingInput() {
  if (!connected || !conversationReady || pendingInputLines.length === 0) return;
  const queued = pendingInputLines.splice(0);
  for (const input of queued) handleInput(input);
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
  if (closing) return;
  closing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) socket.end();
});

console.log("May daemon terminal");
console.log(`Socket: ${socketPath}`);
console.log("Type a message for May. Try /help for console commands.");
refreshPrompt();
connectSocket();
