#!/usr/bin/env node
const { userInfo } = require("node:os");
const { randomUUID } = require("node:crypto");
const readline = require("node:readline");
const { spawn } = require("node:child_process");

const instance = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "background";
const daemonAgent = process.env.AGENT?.trim() || process.env.DAEMON_AGENT?.trim() || "host";
const configuredEndpoint = process.env.MAY_ENDPOINT?.trim() || process.env.DAEMON_HTTP_URL?.trim();
const configuredPort = process.env.DAEMON_HTTP_PORT?.trim() || process.env.WEB_PORT?.trim();
if (!configuredEndpoint && !configuredPort && instance !== "background") {
  throw new Error(`Console instance ${instance} requires MAY_ENDPOINT, DAEMON_HTTP_URL, or DAEMON_HTTP_PORT`);
}
const daemonEndpoint = (configuredEndpoint || `http://127.0.0.1:${configuredPort || "8081"}`).replace(/\/$/, "");
const wakeEndpoint = daemonEndpoint.replace(/^http/, "ws") + "/ws";
const source = "may-console";
const conversationAppId = process.env.CONVERSATION_APP?.trim();
if (!conversationAppId) throw new Error("Console requires CONVERSATION_APP");
const conversationId = process.env.CONVERSATION_ID?.trim() || `${conversationAppId}:primary`;
const adapterInstanceId = randomUUID();

let socket = null;
let connected = false;
let subscriptionReady = false;
let conversationLoaded = false;
let closing = false;
let reconnectTimer = null;
let reconnectDelayMs = 250;
let raw = false;
let debug = false;
let selectedApp = conversationAppId;
let activeTurn = null;
let completionVisible = false;
let watchedTask = null;
let watchedTaskReadInFlight = false;
let watchedTaskDirty = false;
let watchedTaskSelectionVersion = 0;
let desiredAutoFollow = null;
let lastDisconnectedMessage = "";
const displayedTaskReplies = new Map();
let appSelectionVersion = 0;
let todoCount = 0;
const todoReadDirtyApps = new Set();
const pendingInputFrames = [];
const maxPendingInputFrames = 100;

const renderedConversationMessages = new Set();
const conversationResultsByTask = new Map();
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
const pendingConversationReads = [];
let conversationSyncDirty = false;
const pendingAppReads = [];
const pendingTaskListReads = [];
const pendingTaskReads = [];
let nextTaskPage = null;
let nextTodoPage = null;
const pendingRuntimeControls = new Map();
const knownAppIds = new Set();
const knownTaskRefs = new Set();
const shownTaskRevisions = new Map();
let shownTodoActions = new Map();
const pendingCommandLines = [];

function rememberCompletion(set, value, limit) {
  if (set.has(value)) set.delete(value);
  set.add(value);
  while (set.size > limit) set.delete(set.values().next().value);
}

const ordinaryCommands = [
  "/apps",
  "/tasks",
  "/todo",
  "/task",
  "/reply",
  "/watch",
  "/unwatch",
  "/cancel",
  "/help",
  "/reload",
  "/restart",
  "/shell",
  "/exit",
];
const taskPageSize = 10;
const todoPageSize = 50;
let lastKeypressWasTab = false;

function completionResult(choices, completeOn) {
  let prefix = choices[0] || "";
  for (const choice of choices) {
    while (!choice.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  // Readline first extends/replaces a prefix. It only prints choices on a
  // repeated Tab that leaves the input unchanged.
  completionVisible = choices.length > 0 && lastKeypressWasTab && prefix === completeOn;
  return [choices, completeOn];
}

function completeInput(line) {
  const input = String(line || "");
  const parts = input.split(/\s+/);
  if (parts.length === 1) {
    const matches = ordinaryCommands.filter((command) => command.startsWith(parts[0]));
    return completionResult(matches.length ? matches : ordinaryCommands, parts[0]);
  }
  const command = parts[0];
  const current = parts.at(-1) || "";
  const choices =
    command === "/apps"
      ? [...knownAppIds]
      : command === "/tasks"
        ? ["all", "history", "more"]
        : command === "/todo"
          ? ["all", "more"]
          : command === "/task" || command === "/watch" || command === "/cancel"
            ? [...knownTaskRefs]
            : [];
  const matches = choices.filter((choice) => choice.startsWith(current));
  return completionResult(matches.length ? matches : choices, current);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  historySize: 1000,
  escapeCodeTimeout: 50,
  completer: completeInput,
});

function shortSessionId(sessionId) {
  const text = String(sessionId || "");
  if (text.length <= 12) return text;
  return text.slice(0, 10);
}

function promptText() {
  if (!connected) return "you[disconnected]> ";
  if (watchedTask) return `you[${watchedTask.appId}:${watchedTask.ref}]> `;
  return `you[${selectedApp}${todoCount > 0 ? ` · ${todoCount} todo` : ""}]> `;
}

function refreshPrompt() {
  if (closing) return;
  rl.setPrompt(promptText());
  rl.prompt(true);
}

function selectAppContext(appId) {
  const next = typeof appId === "string" ? appId.trim() : "";
  if (!next || next === selectedApp) return false;
  selectedApp = next;
  todoCount = 0;
  shownTodoActions = new Map();
  nextTodoPage = null;
  if (connected) {
    subscribe();
    requestTodoRefresh();
  }
  refreshPrompt();
  return true;
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

function printNotice(text) {
  printLine(`${String(text || "").trimEnd()}\n`);
}

function outputWidth() {
  const columns = Number(process.stdout.columns);
  return Number.isSafeInteger(columns) ? Math.max(60, Math.min(columns, 140)) : 100;
}

function wrapPrefixedLine(text, firstPrefix, continuationPrefix = firstPrefix) {
  const raw = String(text || "").trimEnd();
  if (!raw.trim()) return [""];
  if (/^(?: {4}|\t|\s*```)/.test(raw)) return [`${firstPrefix}${raw}`];
  const relativeIndent = raw.match(/^\s*/)?.[0] || "";
  const value = raw.slice(relativeIndent.length);
  const firstLinePrefix = `${firstPrefix}${relativeIndent}`;
  let nextLinePrefix = `${continuationPrefix}${relativeIndent}`;
  const listMarker = value.match(/^(?:[-*+] |\d+[.)] )/);
  if (listMarker) nextLinePrefix += " ".repeat(listMarker[0].length);
  const words = value.split(/\s+/);
  const lines = [];
  let prefix = firstLinePrefix;
  let current = prefix;
  for (const word of words) {
    const separator = current === prefix ? "" : " ";
    if (current.length > prefix.length && current.length + separator.length + word.length > outputWidth()) {
      lines.push(current);
      prefix = nextLinePrefix;
      current = `${prefix}${word}`;
    } else {
      current += `${separator}${word}`;
    }
  }
  lines.push(current);
  return lines;
}

function indentedLines(text, spaces) {
  const indentation = " ".repeat(spaces);
  return String(text || "")
    .split("\n")
    .map((line) => (line ? `${indentation}${line}` : ""));
}

function indentText(text, spaces) {
  const indentation = " ".repeat(spaces);
  return String(text || "")
    .split("\n")
    .flatMap((line) => wrapPrefixedLine(line, indentation))
    .join("\n");
}

function labeledText(label, text) {
  const indentation = " ".repeat(label.length);
  return String(text || "")
    .split("\n")
    .flatMap((line, index) => wrapPrefixedLine(line, index === 0 ? label : indentation, indentation))
    .join("\n");
}

function renderedLines(lines) {
  return lines
    .flatMap((line) => {
      const value = String(line || "");
      if (!value) return [""];
      const indentation = value.match(/^\s*/)?.[0] || "";
      const content = value.slice(indentation.length);
      const continuation = content.startsWith("- ") ? `${indentation}  ` : indentation;
      return wrapPrefixedLine(content, indentation, continuation);
    })
    .join("\n");
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
  writeStdout(`\n${labeledText(`${speaker}> `, value)}\n\n`, onRendered);
  refreshPrompt();
}

function printActivityText(label, text = "") {
  try {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  } catch {
    // Non-TTY output is fine in tests and logs.
  }
  const value = String(text || "").trimEnd();
  if (!value) {
    refreshPrompt();
    return;
  }
  writeStdout(`\n[${label}]\n${indentText(value, 2)}\n\n`);
  refreshPrompt();
}

function printResponseText(text = "", onRendered) {
  printConversationText(daemonAgent, text, onRendered);
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

function removePending(queue, pending) {
  const index = queue.indexOf(pending);
  if (index >= 0) queue.splice(index, 1);
}

async function httpJson(pathname, options = {}) {
  const response = await fetch(`${daemonEndpoint}${pathname}`, {
    ...options,
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function sendFrame(frame, opts = {}) {
  if (frame?.type === "subscribe") {
    if (!connected || !socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(frame));
    return true;
  }
  if (frame?.type === "publish" && frame.event) {
    void httpJson("/api/events", { method: "POST", body: JSON.stringify(frame.event) })
      .then((result) => handleEvent({ type: "ok", command: "publish", ...result, __receiptKind: opts.receiptKind }))
      .catch((error) => handleEvent({ type: "error", command: "publish", message: error.message, __receiptKind: opts.receiptKind }));
    return true;
  }
  if (frame?.type === "task.cancel") {
    const query = frame.ref
      ? `ref=${encodeURIComponent(frame.ref)}`
      : `appId=${encodeURIComponent(frame.appId)}&taskId=${encodeURIComponent(frame.taskId)}`;
    void httpJson(`/api/task?${query}`)
      .then(async (task) => {
        const result = await httpJson("/api/events", { method: "POST", body: JSON.stringify({
          type: "app.task.cancel.requested",
          target: { appId: task.appId, taskId: task.taskId },
          data: { expectedGeneration: task.generation, expectedResourceVersion: task.resourceVersion, reason: frame.reason },
          idempotencyKey: `app-task-cancel:${task.appId}:${task.taskId}:${task.generation}:${task.resourceVersion}`,
        }) });
        if (result.delivery !== "accepted") throw new Error("Cancellation was not accepted");
        const updatedTask = await httpJson(`/api/task?appId=${encodeURIComponent(task.appId)}&taskId=${encodeURIComponent(task.taskId)}`);
        handleEvent({ ...result, type: "ok", command: "task.cancel", task: updatedTask });
      })
      .catch((error) => handleEvent({ type: "error", command: "task.cancel", message: error.message }));
    return true;
  }
  return false;
}

function conversationInputFrame(message, reply) {
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
      target: { appId: conversationAppId },
      ...(reply
        ? {
            operatorId: userInfo().username,
            authorizationReference: messageId,
            authorizationEvidence: { channel: source, replyTo: reply.messageId, decisionText: message },
          }
        : {}),
      data: {
        conversationId,
        author: { kind: "human", id: messageId },
        text: message,
        ...(reply
          ? {
              replyTo: reply.messageId,
              ...(reply.proposal ? { approvalReply: { target: reply.target, proposal: reply.proposal } } : {}),
            }
          : {}),
        context: {
          focusedApp: selectedApp,
          ...(reply
            ? { focusedTask: reply.target }
            : watchedTask
              ? { focusedTask: { appId: watchedTask.appId, taskId: watchedTask.taskId } }
              : {}),
        },
        metadata: {
          channel: source,
          channelThreadId: "local-terminal",
        },
      },
      idempotencyKey: messageId,
    },
  };
}

function requestConversation(kind = "startup", options = {}) {
  if (
    kind === "sync" &&
    pendingConversationReads.some((pending) => pending.kind === "startup" || pending.kind === "sync")
  ) {
    conversationSyncDirty = true;
    return true;
  }
  if (kind === "sync") conversationSyncDirty = false;
  pendingConversationReads.push({ kind, ...options });
  const sent = sendConversationRead(pendingConversationReads.at(-1));
  if (!readWillComplete(sent)) pendingConversationReads.pop();
  return sent || !closing;
}

function readFailedTransiently(error) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error && typeof error === "object" ? error.status : undefined;
  const transient = !connected || !subscriptionReady || (Number.isInteger(status) && status >= 500) || /fetch failed|daemon unavailable|HTTP 5\d\d/i.test(message);
  if (transient && (!connected || !subscriptionReady)) scheduleReconnect();
  return transient;
}

function sendCanonicalRead(pending, read, apply, reportError) {
  if (pending.__readInFlight) {
    pending.__readDirty = true;
    return true;
  }
  pending.__readInFlight = true;
  void read()
    .then((value) => {
      pending.__readInFlight = false;
      if (pending.__readDirty) {
        pending.__readDirty = false;
        sendCanonicalRead(pending, read, apply, reportError);
        return;
      }
      apply(value);
    })
    .catch((error) => {
      pending.__readInFlight = false;
      if (readFailedTransiently(error)) {
        if (!pending.__readRetryTimer && !closing) {
          pending.__readRetryTimer = setTimeout(() => {
            pending.__readRetryTimer = null;
            if (!closing) sendCanonicalRead(pending, read, apply, reportError);
          }, 250);
        }
        return;
      }
      reportError(error);
    });
  return true;
}

function sendConversationRead(pending = {}) {
  return sendCanonicalRead(
    pending,
    () => httpJson(`/api/conversation?appId=${encodeURIComponent(conversationAppId)}&conversationId=${encodeURIComponent(conversationId)}&limit=30`),
    (conversation) => handleEvent({ type: "ok", command: "app.conversation.get", conversation, __pending: pending }),
    (error) => handleEvent({ type: "error", command: "app.conversation.get", message: error.message, __pending: pending }),
  );
}

function readWillComplete(sent) {
  if (sent) return true;
  if (closing) return false;
  scheduleReconnect();
  return true;
}

function requestApps(appId = null, command = "/apps", select = false, selection = {}) {
  const pending = { appId, command, select, ...selection };
  pendingAppReads.push(pending);
  const sent = sendAppRead(pending);
  if (!readWillComplete(sent)) pendingAppReads.pop();
  return sent || !closing;
}

function sendAppRead(pending) {
  const query = pending.appId ? `?appId=${encodeURIComponent(pending.appId)}` : "";
  return sendCanonicalRead(
    pending,
    () => httpJson(`/api/apps${query}`),
    (apps) => handleEvent({ type: "ok", command: "apps.list", apps, __pending: pending }),
    (error) => handleEvent({ type: "error", command: "apps.list", message: error.message, __pending: pending }),
  );
}

function requestTasks(options = {}) {
  const pending = {
    kind: options.kind || "tasks",
    appId: options.appId || null,
    includeDone: options.includeDone === true,
    humanActionOnly: options.humanActionOnly === true,
    command: options.command || "/tasks",
    cursor: options.cursor || null,
    limit: options.limit || taskPageSize,
  };
  pendingTaskListReads.push(pending);
  const sent = sendTaskListRead(pending);
  if (!readWillComplete(sent)) pendingTaskListReads.pop();
  return sent || !closing;
}

function sendTaskListRead(pending) {
  const query = new URLSearchParams();
  if (pending.appId) query.set("appId", pending.appId); else query.set("allApps", "true");
  if (pending.includeDone) query.set("includeDone", "true");
  if (pending.humanActionOnly) query.set("humanActionOnly", "true");
  if (pending.cursor) query.set("cursor", pending.cursor);
  query.set("limit", String(pending.limit));
  return sendCanonicalRead(
    pending,
    () => httpJson(`/api/tasks?${query}`),
    (tasks) => handleEvent({ type: "ok", command: "tasks.list", tasks, __pending: pending }),
    (error) => handleEvent({ type: "error", command: "tasks.list", message: error.message, __pending: pending }),
  );
}

function requestTodoRefresh() {
  if (!connected) return false;
  const appId = selectedApp;
  if (pendingTaskListReads.some((pending) => pending.kind === "todo-refresh" && pending.appId === appId)) {
    todoReadDirtyApps.add(appId);
    return true;
  }
  return requestTasks({
    kind: "todo-refresh",
    appId,
    humanActionOnly: true,
    limit: todoPageSize,
    command: "automatic todo refresh",
  });
}

function requestTask(input) {
  const pending = {
    kind: input.kind || "detail",
    ...(input.kind === "watch-refresh"
      ? { watchSelectionVersion: watchedTaskSelectionVersion }
      : input.kind === "watch-start" && Number.isSafeInteger(input.watchSelectionVersion)
        ? { watchSelectionVersion: input.watchSelectionVersion }
        : {}),
    command: input.command || `/task ${input.ref || ""}`.trim(),
    ...(input.appId ? { appId: input.appId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.ref ? { ref: input.ref } : {}),
    ...(input.assignedFrom ? { assignedFrom: input.assignedFrom } : {}),
  };
  pendingTaskReads.push(pending);
  if (pending.kind === "watch-refresh") watchedTaskReadInFlight = true;
  const sent = sendTaskRead(pending);
  if (!readWillComplete(sent)) {
    pendingTaskReads.pop();
    if (pending.kind === "watch-refresh") watchedTaskReadInFlight = false;
  }
  return sent || !closing;
}

function sendTaskRead(pending) {
  const query = new URLSearchParams();
  if (pending.ref) query.set("ref", pending.ref);
  else { query.set("appId", pending.appId); query.set("taskId", pending.taskId); }
  return sendCanonicalRead(
    pending,
    () => httpJson(`/api/task?${query}`),
    (task) => handleEvent({ type: "ok", command: "task.get", task, __pending: pending }),
    (error) => handleEvent({ type: "error", command: "task.get", message: error.message, __pending: pending }),
  );
}

function appendConversationMessage({ author, text, transient = false, metadata = {}, idempotencyKey }) {
  const sequence = Math.max(Date.now(), lastConversationSequence + 1);
  lastConversationSequence = sequence;
  sendFrame(
    {
      type: "publish",
      event: {
        type: "conversation.message.created",
        target: { appId: conversationAppId },
        data: {
          conversationId,
          author,
          ...(idempotencyKey ? { messageId: idempotencyKey } : {}),
          text,
          ...(transient ? { transient: true } : {}),
          metadata: { channel: source, ...metadata },
        },
        idempotencyKey:
          typeof idempotencyKey === "string" && idempotencyKey
            ? idempotencyKey
            : `${source}:${adapterInstanceId}:conversation:${sequence}`,
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
      ...(typeof options.topicId === "string" && options.topicId ? { topicId: options.topicId } : {}),
      ...(Array.isArray(options.taskRefs) && options.taskRefs.length > 0 ? { taskRefs: options.taskRefs } : {}),
    },
    ...(typeof options.idempotencyKey === "string" && options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : {}),
  });
}

function taskIdentity(task) {
  return task && typeof task.appId === "string" && typeof task.taskId === "string"
    ? { appId: task.appId, taskId: task.taskId }
    : null;
}

function representedTaskIdentities(task) {
  return [
    taskIdentity(task),
    taskIdentity(task?.requestedBy),
    ...(Array.isArray(task?.waitingOn) ? task.waitingOn.filter((wait) => wait?.kind === "task").map(taskIdentity) : []),
  ].filter(Boolean);
}

function taskResult(task) {
  if (typeof task?.response === "string" && task.response.trim()) return task.response.trim();
  if (typeof task?.summary === "string" && task.summary.trim()) return task.summary.trim();
  return "";
}

function taskProgress(task) {
  const progress = task?.progress;
  if (!progress || typeof progress !== "object") return "";
  if (typeof progress.message === "string" && progress.message.trim()) return progress.message.trim();
  return "";
}

function renderApps(apps, pending) {
  if (!Array.isArray(apps)) return;
  if (pending?.select && pending.selectionVersion !== appSelectionVersion) return;
  const selected = pending?.select && apps.length === 1 && typeof apps[0]?.id === "string" && apps[0].id.trim();
  if (selected) {
    const nextApp = apps[0].id.trim();
    selectAppContext(nextApp);
  } else if (pending?.select) {
    selectAppContext(pending.previousAppId);
  }
  const lines = [
    "",
    pending?.select
      ? selected
        ? `Selected App: ${selectedApp}`
        : `App ${pending.appId} was not found; restored ${selectedApp}.`
      : "Apps:",
    "",
  ];
  if (apps.length === 0) lines.push("  Nothing found.");
  for (const app of apps) {
    if (typeof app.id === "string" && app.id.trim()) rememberCompletion(knownAppIds, app.id.trim(), 256);
    const active = Number(app.activeTasks || 0);
    const details = [
      `${Number(app.openTasks ?? active)} open`,
      `${active} active`,
      ...(Number(app.idleTasks || 0) ? [`${app.idleTasks} idle`] : []),
      ...(Number(app.queuedTasks || 0) ? [`${app.queuedTasks} queued`] : []),
      ...(Number(app.runningTasks || 0) ? [`${app.runningTasks} running`] : []),
      ...(Number(app.waitingTasks || 0) ? [`${app.waitingTasks} waiting`] : []),
      ...(Number(app.attentionTasks || 0) ? [`${app.attentionTasks} attention`] : []),
    ];
    const marker = app.id === selectedApp ? "*" : " ";
    lines.push(` ${marker} ${app.id} — ${details.join(" · ")}`);
    if (pending?.select && typeof app.description === "string" && app.description.trim()) {
      lines.push(`    ${app.description.trim()}`);
    }
    lines.push("");
  }
  if (pending?.stoppedWatch) {
    lines.push(`  Stopped following ${pending.stoppedWatch}; the Task continues unchanged.`);
  }
  if (lines.at(-1) !== "") lines.push("");
  presentView(pending?.command || "/apps", renderedLines(lines));
}

function renderTasks(page, pending) {
  const tasks = Array.isArray(page?.items) ? page.items : [];
  const scope = pending?.appId ? ` for ${pending.appId}` : " across all Apps";
  const title = pending?.includeDone ? `Tasks${scope} (open and history):` : `Open Tasks${scope}:`;
  const lines = ["", title, ""];
  if (tasks.length === 0) lines.push("  Nothing found.");
  for (const task of tasks) {
    if (typeof task.ref === "string" && task.ref.trim()) rememberCompletion(knownTaskRefs, task.ref.trim(), 512);
    if (typeof task.appId === "string" && task.appId.trim()) rememberCompletion(knownAppIds, task.appId.trim(), 256);
    const result = taskResult(task);
    lines.push(
      `  ${String(task.ref || "????????")} · ${String(task.appId || "?")} · ${taskStatusLabel(task)} · ${updatedAgeText(task.updatedAt)}`,
    );
    lines.push(...indentedLines(task.outcome || task.taskId || "Task", 4));
    lines.push(`    You: ${task.humanAction ? humanActionText(task) : "Nothing needed right now."}`);
    if (task.terminal && result) {
      lines.push("    Result:", ...indentedLines(result, 6));
    }
    lines.push("");
  }
  nextTaskPage = page?.nextCursor
    ? {
        appId: pending?.appId || null,
        includeDone: pending?.includeDone === true,
        cursor: page.nextCursor,
      }
    : null;
  if (nextTaskPage) lines.push("  More Tasks are available; run /tasks more for the next page.", "");
  if (lines.at(-1) !== "") lines.push("");
  presentView(pending?.command || "/tasks", renderedLines(lines), {
    taskRefs: tasks.map(taskIdentity).filter(Boolean),
  });
}

function taskStatusLabel(task) {
  switch (task?.status) {
    case "pending":
      return "queued";
    case "running":
      return "working";
    case "waiting":
      return "waiting";
    case "attention":
      return task?.humanAction ? "needs you" : "needs review";
    case "idle":
      return "idle";
    case "done":
      return "done";
    case "cancelled":
      return "cancelled";
    default:
      return String(task?.status || "unknown");
  }
}

function currentTaskText(task) {
  const observed = task.terminal ? taskResult(task) : taskProgress(task) || taskResult(task);
  if (observed) return observed;
  switch (task?.status) {
    case "pending":
      return "No attempt has started yet.";
    case "running":
      return "Work is active; no detailed progress has been reported yet.";
    case "waiting":
      return "No new progress has been reported while the Task waits.";
    case "attention":
      return "No recovery update has been reported yet.";
    case "idle":
      return "No work is runnable. The owner must retain a specific next responsibility or close this assignment.";
    case "done":
      return "No result summary was recorded.";
    case "cancelled":
    case "closed":
      return "The Task will not continue.";
    default:
      return "No current update has been reported.";
  }
}

function humanActionText(task) {
  const value = task?.humanAction?.requestedAction;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof task?.summary === "string" && task.summary.trim()
      ? task.summary.trim()
      : String(task?.outcome || "Human input is required.");
}

function humanActionLine(task) {
  const action = humanActionText(task);
  const owner = task?.humanAction?.task;
  return owner?.ref && owner?.appId ? `On Task ${owner.ref} · ${owner.appId}: ${action}` : action;
}

function elapsedText(value) {
  const elapsedMs = Math.max(0, Date.now() - Number(value || Date.now()));
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function updatedAgeText(value) {
  const age = elapsedText(value);
  return age === "just now" ? age : `${age} ago`;
}

function todoActionSignature(task) {
  return humanActionText(task);
}

function renderTodos(page, pending) {
  const tasks = Array.isArray(page?.items) ? page.items : [];
  const total = Number.isSafeInteger(page?.total) ? page.total : tasks.length;
  const scope = pending?.appId ? ` for ${pending.appId}` : " across all Apps";
  const lines = ["", `Actions needed${scope}:`, ""];
  if (tasks.length === 0) lines.push("  Nothing needs your action.");
  for (const task of tasks) {
    if (typeof task.ref === "string" && task.ref.trim()) rememberCompletion(knownTaskRefs, task.ref.trim(), 512);
    const since = Number(task?.humanAction?.since);
    lines.push(
      `  ${String(task.ref || "????????")} · ${String(task.appId || "?")}${Number.isFinite(since) ? ` · ${elapsedText(since)}` : ""}`,
    );
    lines.push(...indentedLines(humanActionText(task), 4), "");
  }
  nextTodoPage = page?.nextCursor ? { appId: pending?.appId || null, cursor: page.nextCursor } : null;
  if (total > tasks.length) {
    lines.push(`  ${total - tasks.length} more action(s) are not shown.${nextTodoPage ? " Run /todo more." : ""}`);
  }
  if (lines.at(-1) !== "") lines.push("");
  presentView(pending?.command || "/todo", renderedLines(lines), {
    taskRefs: tasks.map(taskIdentity).filter(Boolean),
  });
}

function applyTodoRefresh(page) {
  const tasks = Array.isArray(page?.items) ? page.items : [];
  const next = new Map(tasks.map((task) => [taskPresentationKey(task), todoActionSignature(task)]));
  const changed = tasks.filter((task) => shownTodoActions.get(taskPresentationKey(task)) !== todoActionSignature(task));
  todoCount = Number.isSafeInteger(page?.total) ? page.total : tasks.length;

  const unwatched = changed.filter(
    (task) => !watchedTask || task.appId !== watchedTask.appId || task.taskId !== watchedTask.taskId,
  );
  if (unwatched.length > 0) {
    const first = unwatched[0];
    const text =
      todoCount === 1 && unwatched.length === 1
        ? `[todo] ${first.ref} · ${first.appId} needs you: ${humanActionText(first)}\nUse /task ${first.ref} to read and reply.`
        : `[todo] ${todoCount} Tasks need you in ${selectedApp}. Run /todo.`;
    presentView("/todo notification", text, {
      transient: true,
      taskRefs: tasks.map(taskIdentity).filter(Boolean),
      idempotencyKey: `todo-notification:${source}:${selectedApp}:${first.appId}:${first.taskId}:${first.resourceVersion}`,
    });
  }
  shownTodoActions = next;
  refreshPrompt();
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
    `Task ${task.ref} · ${task.appId}`,
    "",
    "  Goal",
    ...indentedLines(task.outcome || "Task", 4),
    "",
    "  State",
  ];
  lines.push(`    ${taskStatusLabel(task)}. ${task.statusDetail || ""}`.trimEnd());
  const currentHeading =
    !task.terminal && Number.isSafeInteger(task.progress?.updatedAt)
      ? `  Current · ${formatWorkTime(task.progress.updatedAt)}`
      : "  Current";
  lines.push("", currentHeading, ...indentedLines(currentTaskText(task), 4));
  for (const wait of Array.isArray(task.waitingOn) ? task.waitingOn : []) {
    if (wait?.kind === "task") {
      lines.push(`    Waiting on ${wait.ref} · ${wait.appId} · ${taskStatusLabel(wait)} — ${wait.outcome}`);
    } else if (wait?.kind === "app") {
      lines.push(`    Waiting on App ${wait.appId} · ${taskStatusLabel(wait)}`);
    } else if (wait?.kind === "condition") {
      lines.push(`    Waiting for ${wait.type} — ${wait.subject}`);
    }
  }
  lines.push("", "  Expected result");
  const acceptance = Array.isArray(task.acceptance)
    ? task.acceptance.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (acceptance.length > 0) lines.push(...acceptance.map((item) => `    - ${item.trim()}`));
  else lines.push("    No separate completion criteria were recorded.");
  lines.push(
    "",
    "  You",
    ...indentedLines(
      task.humanAction ? humanActionLine(task) : "Nothing needed right now.",
      4,
    ),
  );
  if (task.requestedBy) {
    lines.push(
      "",
      "  Related",
      `    Requested by ${task.requestedBy.ref} · ${task.requestedBy.appId} — ${task.requestedBy.outcome}`,
    );
  }
  lines.push("", "  Updated", `    ${formatWorkTime(task.updatedAt)}`, "", "  Details", `    ID: ${task.taskId}`);
  if (task.execution?.sessionId) lines.push(`    Session: ${task.execution.sessionId}`);
  lines.push("");
  const text = renderedLines(lines);
  if (options.transient) printLine(text);
  else {
    const messageId = `${source}:task:${randomUUID()}`;
    presentView(command, text, { taskRefs: representedTaskIdentities(task), idempotencyKey: messageId });
    displayedTaskReplies.set(task.ref, {
      messageId,
      target: { appId: task.appId, taskId: task.taskId },
      proposal: task.approvalProposal,
    });
    while (displayedTaskReplies.size > 100) displayedTaskReplies.delete(displayedTaskReplies.keys().next().value);
    printNotice(`[reply] /reply ${task.ref} <text>`);
  }
}

function renderTaskSummary(task) {
  const current = currentTaskText(task);
  const lines = ["", ...String(current).split("\n"), ""];
  lines.push(`  Task ${task.ref} · ${task.appId} · ${taskStatusLabel(task)} · ${updatedAgeText(task.updatedAt)}`);
  for (const wait of Array.isArray(task.waitingOn) ? task.waitingOn : []) {
    if (wait?.kind === "task") {
      lines.push(...indentedLines(`Related: ${wait.ref} · ${wait.appId} · ${taskStatusLabel(wait)} — ${wait.outcome}`, 2));
    } else if (wait?.kind === "app") {
      lines.push(`  Related: App ${wait.appId} · ${taskStatusLabel(wait)}`);
    } else if (wait?.kind === "condition") {
      lines.push(...indentedLines(`Waiting for: ${wait.type} — ${wait.subject}`, 2));
    }
  }
  lines.push(...indentedLines(`You: ${task.humanAction ? humanActionText(task) : "Nothing needed right now."}`, 2), "");
  printLine(renderedLines(lines));
}

function taskPresentationKey(task) {
  return taskIdentity(task) ? `${task.appId}\0${task.taskId}` : "";
}

function rememberConversationResultTask(task, messageId) {
  const key = taskPresentationKey(task);
  if (!key) return;
  if (conversationResultsByTask.has(key)) conversationResultsByTask.delete(key);
  conversationResultsByTask.set(key, messageId);
  while (conversationResultsByTask.size > 128) {
    conversationResultsByTask.delete(conversationResultsByTask.keys().next().value);
  }
}

function taskPresentationRevision(task) {
  return JSON.stringify({
    status: task?.status,
    statusDetail: task?.statusDetail,
    outcome: task?.outcome,
    acceptance: task?.acceptance,
    updatedAt: task?.updatedAt,
    summary: task?.summary,
    response: task?.response,
    evidence: task?.evidence,
    progress: task?.progress,
    waitingOn: task?.waitingOn,
    requestedBy: task?.requestedBy,
    execution: task?.execution,
    humanAction: task?.humanAction,
    terminal: task?.terminal,
  });
}

function rememberTaskRevision(key, revision) {
  if (shownTaskRevisions.has(key)) shownTaskRevisions.delete(key);
  shownTaskRevisions.set(key, revision);
  while (shownTaskRevisions.size > 128) shownTaskRevisions.delete(shownTaskRevisions.keys().next().value);
}

function renderWatchSnapshot(task, options = {}) {
  const key = taskPresentationKey(task);
  if (!key) return { rendered: false, seenBefore: false };
  const revision = taskPresentationRevision(task);
  const previous = shownTaskRevisions.get(key);
  if (previous === revision) return { rendered: false, seenBefore: true };
  if (options.catchUp && previous) printNotice(`[catch-up] ${task.ref} changed while it was not followed.`);
  renderTaskSummary(task);
  rememberTaskRevision(key, revision);
  return { rendered: true, seenBefore: previous !== undefined };
}

function setWatchedTask(task) {
  watchedTaskSelectionVersion += 1;
  watchedTask = task && !task.terminal ? { appId: task.appId, taskId: task.taskId, ref: task.ref } : null;
  if (watchedTask) conversationResultsByTask.delete(taskPresentationKey(watchedTask));
  const appChanged = watchedTask ? selectAppContext(watchedTask.appId) : false;
  watchedTaskDirty = false;
  if (!appChanged) subscribe();
  refreshPrompt();
}

function autoFollowKey(task) {
  return task && typeof task.appId === "string" && typeof task.taskId === "string"
    ? `${task.appId}\0${task.taskId}`
    : "";
}

function requestDesiredAutoFollow() {
  if (!connected || !desiredAutoFollow) return;
  const key = autoFollowKey(desiredAutoFollow);
  if (!key) return;
  if (watchedTask && autoFollowKey(watchedTask) === key) {
    desiredAutoFollow = null;
    return;
  }
  if (
    pendingTaskReads.some(
      (pending) => pending.kind === "auto-follow" && `${pending.appId || ""}\0${pending.taskId || ""}` === key,
    )
  ) {
    return;
  }
  requestTask({
    kind: "auto-follow",
    appId: desiredAutoFollow.appId,
    taskId: desiredAutoFollow.taskId,
    assignedFrom: desiredAutoFollow.assignedFrom,
    command: "automatic Task follow",
  });
}

function autoFollowTask(task) {
  const appId = typeof task?.appId === "string" ? task.appId.trim() : "";
  const taskId = typeof task?.taskId === "string" ? task.taskId.trim() : "";
  if (!appId || !taskId) return;
  desiredAutoFollow = { appId, taskId, ...(task?.assignedFrom ? { assignedFrom: task.assignedFrom } : {}) };
  requestDesiredAutoFollow();
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

function renderConversation(messages, options = {}) {
  if (!Array.isArray(messages)) return;
  let latestFollowTask = null;
  for (const message of messages) {
    const id = typeof message.id === "string" ? message.id : "";
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!id || !text || renderedConversationMessages.has(id)) continue;
    const channel = message.metadata && typeof message.metadata.channel === "string" ? message.metadata.channel : "";
    const kind = message.author && typeof message.author.kind === "string" ? message.author.kind : "agent";
    // Command results remain useful Conversation context for a later human
    // reference, but they are interface views rather than conversation turns.
    // The command already rendered where it was invoked; replaying it on
    // startup produces a misleading duplicate `command>` message.
    if (kind === "command") {
      rememberRenderedConversationMessage(id);
      continue;
    }
    const baseSpeaker = kind === "human" ? "you" : kind === "agent" ? daemonAgent : kind;
    const speaker = channel && channel !== source ? `${baseSpeaker}[${channel}]` : baseSpeaker;
    const metadataTaskRefs = Array.isArray(message.metadata?.taskRefs) ? message.metadata.taskRefs : [];
    const taskRefs = metadataTaskRefs.flatMap((task) =>
      task && typeof task.ref === "string" && task.ref.trim()
        ? [`Task ${task.ref.trim()} (${task.appId || "unknown App"})`]
        : [],
    );
    const taskActivity = kind === "tool" && message.metadata?.command === "task-admitted";
    const renderedText =
      taskRefs.length > 0 ? `${text}${taskActivity ? "\n" : "\n\n"}${taskRefs.join("\n")}` : text;
    if (taskActivity) printActivityText("task", renderedText);
    else printConversationText(speaker, renderedText);
    rememberRenderedConversationMessage(id);
    if (kind === "agent" && id.startsWith("result:")) {
      for (const task of metadataTaskRefs) rememberConversationResultTask(task, id);
    }
    const followTask = message.metadata?.followTask;
    if (
      (kind === "agent" || taskActivity) &&
      followTask &&
      typeof followTask.appId === "string" &&
      followTask.appId.trim() &&
      typeof followTask.taskId === "string" &&
      followTask.taskId.trim()
    ) {
      const assignedFrom = metadataTaskRefs.find(
        (task) =>
          task &&
          typeof task.appId === "string" &&
          typeof task.taskId === "string" &&
          (task.appId !== followTask.appId || task.taskId !== followTask.taskId),
      );
      latestFollowTask = {
        appId: followTask.appId.trim(),
        taskId: followTask.taskId.trim(),
        ...(assignedFrom ? { assignedFrom } : {}),
      };
    }
  }
  // Catch-up history restores context for the human, but it must not change
  // the current App or start watching old work. Only a live Conversation wake
  // may turn a newly observed assignment into an automatic follow.
  if (latestFollowTask && options.autoFollow === true) autoFollowTask(latestFollowTask);
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
  subscriptionReady = false;
  return sendFrame({
    type: "subscribe",
    sessions: subscribedSessions(),
    conversations: [conversationId],
    taskApps: [selectedApp],
    task: watchedTask ? { appId: watchedTask.appId, taskId: watchedTask.taskId } : null,
  });
}

function rereadCanonicalState() {
  if (pendingConversationReads.length > 0) {
    for (const pending of pendingConversationReads) sendConversationRead(pending);
  } else {
    requestConversation(conversationLoaded ? "sync" : "startup");
  }
  for (const pending of pendingAppReads) sendAppRead(pending);
  for (const pending of pendingTaskListReads) sendTaskListRead(pending);
  for (const pending of pendingTaskReads) sendTaskRead(pending);
  if (!pendingTaskListReads.some((pending) => pending.kind === "todo-refresh")) requestTodoRefresh();
  if (watchedTask && !pendingTaskReads.some((pending) => pending.kind === "watch-refresh")) {
    watchedTaskReadInFlight = false;
    refreshWatchedTask();
  }
  requestDesiredAutoFollow();
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
    if (data.appId === selectedApp) requestTodoRefresh();
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
  if (event.type === "subscribed") {
    subscriptionReady = true;
    rereadCanonicalState();
    flushPendingCommands();
    flushPendingInput();
    refreshPrompt();
    return;
  }
  if (event.type === "overflow") {
    // WebSocket events are only lossy wake hints. Recover from the owning HTTP
    // projections; never replay user input or control work because a stream fell behind.
    if (subscriptionReady) rereadCanonicalState();
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
    // Durable messages are rendered only from the Conversation projection.
    // Rendering the raw event as well would show the same message twice when
    // conversation.updated causes the normal read. Transient messages are not
    // part of that projection, so they intentionally use the direct path.
    if (
      data.transient === true &&
      metadata.channel === source &&
      author.id !== source &&
      typeof data.text === "string"
    ) {
      const speaker = author.kind === "agent" ? daemonAgent : author.kind || "notice";
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
      const receiptKind = event.__receiptKind || null;
      if (receiptKind === "human-turn" && event.approval) {
        printNotice("reason" in event.approval ? event.approval.reason
          : `${event.approval.decision} recorded for the exact proposal.`);
      }
      if (event.command === "publish" && Number.isSafeInteger(event.eventId) && event.eventId > 0) {
        // Non-human Conversation events are projected by durable event row ID.
        // Marking every local publish receipt is harmless for other event kinds.
        rememberRenderedConversationMessage(`event:${event.eventId}`);
      }
      if (receiptKind === "human-turn") {
        printNotice(`[${daemonAgent}] Working on your request… Esc stops this turn.`);
      }
      if (receiptKind === "stop-turn") {
        printNotice(event.delivery === "accepted" ? `[${daemonAgent}] Stop request accepted. Background Tasks continue.` : `[${daemonAgent}] Stop was not accepted; refresh and try again.`);
        requestConversation("sync");
      }
      if (event.command === "app.conversation.get") {
        const pending = event.__pending || pendingConversationReads[0];
        removePending(pendingConversationReads, pending);
        conversationLoaded = true;
        if (pending?.kind === "startup" || pending?.kind === "sync") {
          const next = event.conversation?.activeTurn ?? null;
          if (next && (!activeTurn || activeTurn.id !== next.id || activeTurn.revision !== next.revision)) {
            printNotice(`[${daemonAgent}] Esc: stop this turn. Background Tasks continue.`);
          }
          activeTurn = next;
        }
        if (pending?.kind === "startup") {
          renderConversation(event.conversation?.messages);
        } else if (pending?.kind === "sync") {
          renderConversation(event.conversation?.messages, { autoFollow: true });
        }
        if (conversationSyncDirty) requestConversation("sync");
      }
      if (event.command === "apps.list") {
        const pending = event.__pending || pendingAppReads[0];
        removePending(pendingAppReads, pending);
        renderApps(event.apps, pending);
      }
      if (event.command === "tasks.list") {
        const pending = event.__pending || pendingTaskListReads[0];
        removePending(pendingTaskListReads, pending);
        if (pending?.kind === "todo-refresh") {
          if (pending.appId === selectedApp) applyTodoRefresh(event.tasks);
          const dirty = todoReadDirtyApps.delete(pending.appId);
          if (dirty && pending.appId === selectedApp) requestTodoRefresh();
        } else if (pending?.kind === "todo-command") {
          renderTodos(event.tasks, pending);
        } else {
          renderTasks(event.tasks, pending);
        }
      }
      if (event.command === "task.get") {
        const pending = event.__pending || pendingTaskReads[0];
        removePending(pendingTaskReads, pending);
        const task = event.task;
        if (pending?.kind === "watch-start") {
          if (pending.watchSelectionVersion !== watchedTaskSelectionVersion) {
            // A newer human watch, unwatch, or App selection superseded this read.
          } else if (task?.terminal) {
            renderWatchSnapshot(task, { catchUp: true });
            setWatchedTask(null);
            printNotice("[watch] Task is already terminal.");
          } else if (task) {
            const snapshot = renderWatchSnapshot(task, { catchUp: true });
            setWatchedTask(task);
            printNotice(
              snapshot.rendered || !snapshot.seenBefore
                ? `[watch] Following ${task.ref} · ${task.appId}.`
                : `[watch] Following ${task.ref} · ${task.appId}; no new progress.`,
            );
          }
        } else if (pending?.kind === "auto-follow") {
          const pendingKey = `${pending.appId || ""}\0${pending.taskId || ""}`;
          if (!desiredAutoFollow || autoFollowKey(desiredAutoFollow) !== pendingKey) {
            // The human changed context or a newer assignment superseded this read.
          } else if (!task) {
            desiredAutoFollow = null;
          } else if (task.terminal) {
            desiredAutoFollow = null;
          } else {
            const previous = watchedTask;
            desiredAutoFollow = null;
            renderWatchSnapshot(task, { catchUp: Boolean(shownTaskRevisions.has(taskPresentationKey(task))) });
            setWatchedTask(task);
            const origin = pending.assignedFrom?.ref
              ? ` (from ${pending.assignedFrom.ref} · ${pending.assignedFrom.appId})`
              : "";
            const prior = previous && autoFollowKey(previous) !== autoFollowKey(task) ? ` Previous: ${previous.ref}.` : "";
            printNotice(`[watch] Following ${task.ref} · ${task.appId}${origin}.${prior}`);
          }
          requestDesiredAutoFollow();
        } else if (pending?.kind === "watch-refresh") {
          watchedTaskReadInFlight = false;
          const pendingWatchKey = `${pending.appId || ""}\0${pending.taskId || ""}`;
          const currentWatchKey = autoFollowKey(watchedTask);
          const currentSelection =
            pending.watchSelectionVersion === watchedTaskSelectionVersion && pendingWatchKey === currentWatchKey;
          if (currentSelection) {
            const taskKey = taskPresentationKey(task);
            const conversationAlreadyPresentedResult = Boolean(task?.terminal && conversationResultsByTask.has(taskKey));
            if (task && !conversationAlreadyPresentedResult) renderWatchSnapshot(task);
            else if (task && conversationAlreadyPresentedResult) {
              rememberTaskRevision(taskKey, taskPresentationRevision(task));
              conversationResultsByTask.delete(taskKey);
            }
            if (!task || task.terminal) {
              setWatchedTask(null);
              if (task?.terminal) printNotice(`[watch] ${task.ref} finished; watch ended.`);
            } else if (watchedTask) {
              watchedTask.ref = task.ref;
            }
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
      if (event.command === "publish" && event.__receiptKind === "stop-turn") {
        printNotice(`[${daemonAgent}] Stop was not confirmed: ${event.message || "unknown error"}`);
        requestConversation("sync");
        return;
      }
      if (event.command === "app.conversation.get") {
        removePending(pendingConversationReads, event.__pending || pendingConversationReads[0]);
        if (conversationSyncDirty) requestConversation("sync");
      }
      if (event.command === "apps.list") {
        const pending = event.__pending || pendingAppReads[0];
        removePending(pendingAppReads, pending);
        if (pending?.select && pending.selectionVersion === appSelectionVersion) {
          selectAppContext(pending.previousAppId);
        }
      }
      if (event.command === "tasks.list") {
        const pending = event.__pending || pendingTaskListReads[0];
        removePending(pendingTaskListReads, pending);
        if (pending?.kind === "todo-refresh") {
          const dirty = todoReadDirtyApps.delete(pending.appId);
          if (dirty && pending.appId === selectedApp) requestTodoRefresh();
        }
      }
      if (event.command === "task.get") {
        const pending = event.__pending || pendingTaskReads[0];
        removePending(pendingTaskReads, pending);
        if (pending?.kind === "watch-refresh") watchedTaskReadInFlight = false;
        if (pending?.kind === "auto-follow" && desiredAutoFollow) {
          const pendingKey = `${pending.appId || ""}\0${pending.taskId || ""}`;
          if (autoFollowKey(desiredAutoFollow) === pendingKey) desiredAutoFollow = null;
        }
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
        printLine(`${data.from || daemonAgent}: ${data.content || data.message || ""}`);
      }
      return;
    }
    case "info":
      if (debug) printLine(String(event.message || ""));
      return;
  }
}

function connectSocket() {
  if (closing || (socket && socket.readyState < WebSocket.CLOSING)) return;
  socket = new WebSocket(wakeEndpoint);
  socket.onopen = () => {
    connected = true;
    subscriptionReady = false;
    reconnectDelayMs = 250;
    lastDisconnectedMessage = "";
    // The server installs filters before acknowledging this frame. Canonical
    // rereads happen only after that acknowledgement, closing the subscribe/read gap.
    subscribe();
    refreshPrompt();
  };
  socket.onmessage = (message) => {
    try { handleEvent(JSON.parse(String(message.data))); }
    catch { printLine(String(message.data)); }
  };
  socket.onerror = () => {
    connected = false;
    if (lastDisconnectedMessage !== "daemon unavailable") {
      lastDisconnectedMessage = "daemon unavailable";
      printLine(`[websocket] waiting for daemon at ${wakeEndpoint}`);
    }
  };
  socket.onclose = () => {
    connected = false;
    socket = null;
    if (closing) return;
    refreshPrompt();
    scheduleReconnect();
  };
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
      "Conversation and Tasks:",
      "  Esc                        Stop this turn; background Tasks continue",
      "  /apps [app]                 List or select an App",
      "  /tasks [all] [history], /tasks more",
      "  /todo [all], /todo more     Show Tasks that need your action",
      "  /task <ref>",
      "  /reply <ref> <text>     Reply to a Task you opened with /task",
      "  /watch [ref], /unwatch",
      "  /cancel [ref]",
      "",
      "Console:",
      "  /exit (/quit)              Close Console",
      "  /shell                     Leave Console for a shell",
      "",
      "Host administration (all Apps):",
      "  /reload                    Reload definitions",
      "  /restart                   Restart the Host",
      "",
      `Bare text goes to ${daemonAgent} in the selected App context. While watching, that Task is additional context.`,
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
      if (rest) {
        const previousAppId = selectedApp;
        let stoppedWatch = null;
        if (rest !== selectedApp) {
          desiredAutoFollow = null;
          watchedTaskSelectionVersion += 1;
          if (watchedTask) {
            stoppedWatch = watchedTask.ref;
            setWatchedTask(null);
          }
          selectAppContext(rest);
        }
        nextTaskPage = null;
        const selectionVersion = ++appSelectionVersion;
        printNotice(`[apps] Selecting ${rest}…`);
        requestApps(rest, input, true, { previousAppId, selectionVersion, stoppedWatch });
      } else {
        requestApps(null, input, false);
      }
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
      const tokens = restParts.map((part) => part.toLowerCase());
      if (tokens.some((part) => part !== "all" && part !== "history") || new Set(tokens).size !== tokens.length) {
        printLine("Usage: /tasks [all] [history], or /tasks more");
        return;
      }
      const allApps = tokens.includes("all");
      const includeDone = tokens.includes("history");
      requestTasks({ appId: allApps ? null : selectedApp, includeDone, command: input });
      return;
    }
    case "todo": {
      const tokens = restParts.map((part) => part.toLowerCase());
      const more = tokens.length === 1 && tokens[0] === "more";
      if (tokens.length > 1 || (tokens.length === 1 && tokens[0] !== "all" && !more)) {
        printLine("Usage: /todo [all], or /todo more");
        return;
      }
      if (more && !nextTodoPage) {
        printLine("[todo] No next page. Run /todo first.");
        return;
      }
      if (!more) nextTodoPage = null;
      requestTasks({
        kind: "todo-command",
        appId: more ? nextTodoPage.appId : tokens.includes("all") ? null : selectedApp,
        humanActionOnly: true,
        limit: todoPageSize,
        ...(more ? { cursor: nextTodoPage.cursor } : {}),
        command: input,
      });
      return;
    }
    case "task":
      if (!rest || restParts.length !== 1) {
        printLine("Usage: /task <ref>");
        return;
      }
      requestTask({ ref: rest, command: input });
      return;
    case "reply": {
      const [ref, ...words] = restParts;
      const reply = displayedTaskReplies.get(ref);
      if (!ref || !words.length) {
        printLine("Usage: /reply <task-ref> <text>");
        return;
      }
      if (!reply) {
        printLine(`Read /task ${ref} first, then reply to that displayed proposal.`);
        return;
      }
      submitHumanInput(conversationInputFrame(input.replace(/^\/reply\s+\S+\s+/i, ""), reply));
      return;
    }
    case "watch": {
      if (!rest) {
        if (!watchedTask) {
          printNotice("[watch] No Task is watched. Use /watch <ref>.");
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
      desiredAutoFollow = null;
      watchedTaskSelectionVersion += 1;
      requestTask({
        kind: "watch-start",
        watchSelectionVersion: watchedTaskSelectionVersion,
        ref: rest,
        command: input,
      });
      return;
    }
    case "unwatch":
      if (rest) {
        printLine("Usage: /unwatch");
        return;
      }
      const pendingWatchStart = pendingTaskReads.some((pending) => pending.kind === "watch-start");
      if (!watchedTask && !desiredAutoFollow && !pendingWatchStart) {
        printNotice("[watch] No Task is watched.");
        return;
      }
      desiredAutoFollow = null;
      watchedTaskSelectionVersion += 1;
      if (watchedTask) setWatchedTask(null);
      printNotice("[watch] Watch ended. The Task continues.");
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
      if (socket) socket.close();
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

function commandNeedsConnection(input) {
  const command = input.slice(1).trim().split(/\s+/, 1)[0]?.toLowerCase();
  return command === "cancel" || command === "reload" || command === "restart";
}

function flushPendingCommands() {
  while (pendingCommandLines.length > 0) {
    const input = pendingCommandLines[0];
    if (commandNeedsConnection(input) && !connected) return;
    pendingCommandLines.shift();
    handleCommand(input);
  }
}

function handleInput(line) {
  const input = line.trim();
  if (!input) {
    refreshPrompt();
    return;
  }

  // Commands are structured control reads/actions and do not depend on the
  // Conversation transcript. Reconnect-safe reads register immediately;
  // direct controls wait only for a live socket. App selection is local
  // presentation state, so following commands can use it without waiting for
  // the asynchronous App read that validates and describes it.
  if (input.startsWith("/")) {
    if (commandNeedsConnection(input) && !connected) {
      pendingCommandLines.push(input);
      printLine("[waiting for daemon; command queued]");
      return;
    }
    handleCommand(input);
    return;
  }

  // Conversation history is presentation context, not an admission gate.
  // The daemon owns authoritative context and orders message handling within
  // the Conversation after this Event has been durably accepted.
  submitHumanInput(conversationInputFrame(input));
}

function submitHumanInput(frame) {
  if (!connected) {
    if (pendingInputFrames.length >= maxPendingInputFrames) {
      printLine(`[offline] Message not saved; this Console already holds ${maxPendingInputFrames} unsent messages.`);
      return;
    }
    pendingInputFrames.push(frame);
    printLine("[offline] Message saved in this Console; it will send after reconnect.");
    return;
  }

  if (!sendFrame(frame, { receiptKind: "human-turn" })) {
    pendingInputFrames.push(frame);
    printLine("[offline] Message saved in this Console; it will send after reconnect.");
  }
  refreshPrompt();
}

function flushPendingInput() {
  if (!connected || pendingInputFrames.length === 0) return;
  while (connected && pendingInputFrames.length > 0) {
    const frame = pendingInputFrames[0];
    if (!sendFrame(frame, { receiptKind: "human-turn" })) return;
    pendingInputFrames.shift();
  }
}

function closeAndExit(code) {
  closing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) socket.close();
  rl.close();
  process.exit(code);
}

// Readline owns editing and completion. Only a standalone Esc requests Stop;
// arrow keys and other escape sequences keep their normal editing behavior.
if (process.stdin.isTTY) {
  process.stdin.on("keypress", (_text, key) => {
    lastKeypressWasTab = key?.name === "tab";
    if (key?.name === "escape" && key.sequence === "\x1b") {
      if (completionVisible) {
        completionVisible = false;
        refreshPrompt();
        return;
      }
      if (!connected) {
        printNotice(`[${daemonAgent}] Disconnected; Stop was not confirmed.`);
        return;
      }
      const turn = activeTurn;
      if (!turn) return;
      sendFrame({ type: "publish", event: {
        type: "conversation.turn.stop.requested", target: { appId: conversationAppId },
        data: { conversationId, turnId: turn.id, expectedRevision: turn.revision },
        idempotencyKey: `conversation-stop:${conversationAppId}:${conversationId}:${turn.id}:${turn.revision}`,
      } }, { receiptKind: "stop-turn" });
    } else if (key?.name !== "tab") completionVisible = false;
  });
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
  if (socket) socket.close();
});

console.log("May daemon terminal");
console.log(`Endpoint: ${daemonEndpoint}`);
console.log(`Type a message for ${daemonAgent}. Try /help for console commands.`);
refreshPrompt();
connectSocket();
