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
let selectedApp = "may";
let selectedTopic = null;
let watchedTask = null;
let watchedTaskReadInFlight = false;
let watchedTaskDirty = false;
let desiredAutoFollow = null;
let lastDisconnectedMessage = "";
let conversationReady = false;
let lastRenderedMayMessageId = null;
let appSelectionInFlight = false;
let todoCount = 0;
let todoReadInFlight = false;
let todoReadDirty = false;
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
const pendingConversationReads = [];
let conversationSyncDirty = false;
const pendingAppReads = [];
const pendingTaskListReads = [];
const pendingTaskReads = [];
let nextTaskPage = null;
let nextTodoPage = null;
let nextTopicPage = null;
const pendingRuntimeControls = new Map();
const knownAppIds = new Set();
const knownTaskRefs = new Set();
const knownTopicRefs = new Set();
const shownTaskRevisions = new Map();
let shownTodoActions = new Map();

function rememberCompletion(set, value, limit) {
  if (set.has(value)) set.delete(value);
  set.add(value);
  while (set.size > limit) set.delete(set.values().next().value);
}

const ordinaryCommands = [
  "/apps",
  "/topics",
  "/topic",
  "/tasks",
  "/todo",
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
const taskPageSize = 10;
const todoPageSize = 50;

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
      : command === "/topics"
        ? ["more"]
      : command === "/topic"
        ? ["clear", ...knownTopicRefs]
      : command === "/tasks"
        ? ["all", "history"]
        : command === "/todo"
          ? ["all", "more"]
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
  const topic = selectedTopic ? ` · ${topicRef(selectedTopic)}` : "";
  if (watchedTask) return `you[${watchedTask.appId}:${watchedTask.ref}${topic}]> `;
  return `you[${selectedApp}${topic}${todoCount > 0 ? ` · ${todoCount} todo` : ""}]> `;
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
        ...(lastRenderedMayMessageId ? { replyTo: lastRenderedMayMessageId } : {}),
        context: {
          focusedApp: selectedApp,
          ...(watchedTask ? { focusedTask: { appId: watchedTask.appId, taskId: watchedTask.taskId } } : {}),
        },
        metadata: {
          channel: source,
          channelThreadId: "local-terminal",
          ...(selectedTopic ? { topicId: selectedTopic.id } : {}),
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

function sendConversationRead(pending = {}) {
  return sendFrame(
    {
      type: "app.conversation.get",
      appId: "may",
      conversationId,
      limit: 30,
      topicLimit: 12,
      ...(pending.kind === "topic" && pending.ref ? { topicId: pending.ref } : {}),
      ...(pending.kind === "topic" && pending.current && selectedTopic ? { topicId: selectedTopic.id } : {}),
      ...(pending.kind === "topics" && pending.cursor ? { topicCursor: pending.cursor } : {}),
    },
    { silent: true },
  );
}

function readWillComplete(sent) {
  if (sent) return true;
  if (closing) return false;
  scheduleReconnect();
  return true;
}

function requestApps(appId = null, command = "/apps", select = false) {
  const pending = { appId, command, select };
  pendingAppReads.push(pending);
  const sent = sendAppRead(pending);
  if (!readWillComplete(sent)) pendingAppReads.pop();
  return sent || !closing;
}

function sendAppRead(pending) {
  return sendFrame({ type: "apps.list", ...(pending.appId ? { appId: pending.appId } : {}) }, { silent: true });
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
  return sendFrame(
    {
      type: "tasks.list",
      ...(pending.appId ? { appId: pending.appId } : {}),
      ...(pending.includeDone ? { includeDone: true } : {}),
      ...(pending.humanActionOnly ? { humanActionOnly: true } : {}),
      ...(pending.cursor ? { cursor: pending.cursor } : {}),
      limit: pending.limit,
    },
    { silent: true },
  );
}

function requestTodoRefresh() {
  if (!connected) return false;
  if (todoReadInFlight) {
    todoReadDirty = true;
    return true;
  }
  todoReadInFlight = true;
  const sent = requestTasks({
    kind: "todo-refresh",
    appId: selectedApp,
    humanActionOnly: true,
    limit: todoPageSize,
    command: "automatic todo refresh",
  });
  if (!sent) todoReadInFlight = false;
  return sent;
}

function requestTask(input) {
  const pending = {
    kind: input.kind || "detail",
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
  return sendFrame(
    {
      type: "task.get",
      ...(pending.ref ? { ref: pending.ref } : {}),
      ...(pending.appId ? { appId: pending.appId } : {}),
      ...(pending.taskId ? { taskId: pending.taskId } : {}),
    },
    { silent: true },
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
        target: { appId: "may" },
        data: {
          conversationId,
          author,
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

function topicRef(topic) {
  const id = typeof topic?.id === "string" ? topic.id.trim() : "";
  const value = id.startsWith("topic_") ? id.slice("topic_".length) : id;
  return value.slice(0, 8) || "????????";
}

function topicTaskIdentities(topic) {
  return Array.isArray(topic?.taskRefs)
    ? topic.taskRefs.flatMap((task) =>
        task && typeof task.appId === "string" && typeof task.taskId === "string"
          ? [{ appId: task.appId, taskId: task.taskId }]
          : [],
      )
    : [];
}

function resolveTopic(topics, ref) {
  const normalized = String(ref || "").trim().toLowerCase();
  if (!normalized) return null;
  const matches = topics.filter((topic) => {
    const id = typeof topic?.id === "string" ? topic.id.toLowerCase() : "";
    return id === normalized || id === `topic_${normalized}` || topicRef(topic).toLowerCase() === normalized;
  });
  return matches.length === 1 ? matches[0] : null;
}

function topicMessageLine(message) {
  const kind = message?.author?.kind;
  const speaker = kind === "human" ? "you" : kind === "agent" ? "may" : kind || "event";
  const text = typeof message?.text === "string" ? message.text.trim().replace(/\s+/g, " ") : "";
  return text ? `  ${speaker}: ${text.length > 180 ? `${text.slice(0, 177)}...` : text}` : "";
}

function renderTopics(conversation, pending) {
  const topics = Array.isArray(conversation?.topics) ? conversation.topics : [];
  const lines = ["", pending?.cursor ? "Older Topics:" : "Recent Topics:"];
  if (topics.length === 0) lines.push("  Nothing found.");
  for (const topic of topics) {
    const ref = topicRef(topic);
    rememberCompletion(knownTopicRefs, ref, 128);
    const marker = selectedTopic?.id === topic.id ? "*" : " ";
    const tasks = Array.isArray(topic.taskRefs) ? topic.taskRefs : [];
    lines.push(` ${marker} ${ref}  ${String(topic.title || "Topic")}${tasks.length ? ` · ${tasks.length} Task${tasks.length === 1 ? "" : "s"}` : ""}`);
  }
  nextTopicPage = conversation?.nextTopicCursor
    ? { kind: "topics", cursor: conversation.nextTopicCursor, command: "/topics more" }
    : null;
  if (nextTopicPage) lines.push("  More Topics are available; run /topics more.");
  lines.push("", "Use /topic <ref> to continue one Topic. Task progress remains under /task and /watch.", "");
  presentView(pending?.command || "/topics", lines.join("\n"));
}

function renderTopic(conversation, pending) {
  const topics = Array.isArray(conversation?.topics) ? conversation.topics : [];
  const topic = pending?.current
    ? topics.find((candidate) => candidate.id === selectedTopic?.id)
    : resolveTopic(topics, pending?.ref);
  if (!topic) {
    presentView(
      pending?.command || "/topic",
      selectedTopic && pending?.current
        ? `Current Topic ${topicRef(selectedTopic)} is no longer available.`
        : `Topic ${pending?.ref || ""} was not found. Run /topics to list Topics.`,
    );
    return;
  }
  let stoppedWatch = null;
  if (pending?.select) {
    const linked = topicTaskIdentities(topic);
    if (
      watchedTask &&
      !linked.some((task) => task.appId === watchedTask.appId && task.taskId === watchedTask.taskId)
    ) {
      stoppedWatch = watchedTask.ref;
      setWatchedTask(null);
    }
    selectedTopic = topic;
    refreshPrompt();
  }
  rememberCompletion(knownTopicRefs, topicRef(topic), 128);
  const taskLines = (Array.isArray(topic.taskRefs) ? topic.taskRefs : []).map(
    (task) => `  ${task.ref || "????????"} · ${task.appId}`,
  );
  const recent = (Array.isArray(conversation?.messages) ? conversation.messages : [])
    .filter((message) => message?.metadata?.topicId === topic.id)
    .slice(-8)
    .map(topicMessageLine)
    .filter(Boolean);
  const lines = [
    "",
    `${pending?.select ? "Following" : "Topic"} ${topicRef(topic)}: ${topic.title}`,
    ...(taskLines.length ? ["Tasks:", ...taskLines] : ["Tasks: none"]),
    ...(recent.length ? ["Recent conversation:", ...recent] : []),
    ...(stoppedWatch ? [`Stopped watching Task ${stoppedWatch}; the Task continues unchanged.`] : []),
    "",
  ];
  presentView(pending?.command || "/topic", lines.join("\n"), {
    topicId: topic.id,
    taskRefs: topicTaskIdentities(topic),
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
  let stoppedWatch = null;
  if (pending?.select && apps.length === 1 && typeof apps[0]?.id === "string" && apps[0].id.trim()) {
    const nextApp = apps[0].id.trim();
    if (nextApp !== selectedApp) {
      desiredAutoFollow = null;
      if (watchedTask) {
        stoppedWatch = watchedTask.ref;
        setWatchedTask(null);
      }
    }
    selectAppContext(nextApp);
    nextTaskPage = null;
  }
  const lines = ["", pending?.select && apps.length === 1 ? `Selected App: ${selectedApp}` : "Apps:"];
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
    const marker = app.id === selectedApp ? "*" : " ";
    lines.push(` ${marker} ${app.id} — ${details.join(" · ")}`);
    if (pending?.select && typeof app.description === "string" && app.description.trim()) {
      lines.push(`    ${app.description.trim()}`);
    }
  }
  if (stoppedWatch) lines.push(`  Stopped following ${stoppedWatch}; the Task continues unchanged.`);
  lines.push("");
  presentView(pending?.command || "/apps", lines.join("\n"));
}

function renderTasks(page, pending) {
  const tasks = Array.isArray(page?.items) ? page.items : [];
  const scope = pending?.appId ? ` for ${pending.appId}` : " across all Apps";
  const title = pending?.includeDone ? `Tasks${scope} (active and recent):` : `Active Tasks${scope}:`;
  const lines = ["", title];
  if (tasks.length === 0) lines.push("  Nothing found.");
  for (const task of tasks) {
    if (typeof task.ref === "string" && task.ref.trim()) rememberCompletion(knownTaskRefs, task.ref.trim(), 512);
    if (typeof task.appId === "string" && task.appId.trim()) rememberCompletion(knownAppIds, task.appId.trim(), 256);
    const result = taskResult(task);
    lines.push(
      `  ${String(task.ref || "????????").padEnd(16)} ${String(task.appId || "?").padEnd(20)} ${taskStatusLabel(task).padEnd(12)} · ${updatedAgeText(task.updatedAt)}  ${String(task.outcome || task.taskId || "Task")} · ${task.humanAction ? "needs you" : "no action from you"}`,
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
    case "done":
      return "No result summary was recorded.";
    case "cancelled":
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
  const lines = ["", `Actions needed${scope}:`];
  if (tasks.length === 0) lines.push("  Nothing needs your action.");
  for (const task of tasks) {
    if (typeof task.ref === "string" && task.ref.trim()) rememberCompletion(knownTaskRefs, task.ref.trim(), 512);
    const since = Number(task?.humanAction?.since);
    lines.push(
      `  ${String(task.ref || "????????").padEnd(16)} ${String(task.appId || "?").padEnd(20)} ${humanActionText(task)}${Number.isFinite(since) ? ` · ${elapsedText(since)}` : ""}`,
    );
  }
  nextTodoPage = page?.nextCursor ? { appId: pending?.appId || null, cursor: page.nextCursor } : null;
  if (total > tasks.length) {
    lines.push(`  ${total - tasks.length} more action(s) are not shown.${nextTodoPage ? " Run /todo more." : ""}`);
  }
  lines.push("");
  presentView(pending?.command || "/todo", lines.join("\n"), {
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
        ? `[todo] ${first.ref} · ${first.appId} needs you: ${humanActionText(first)}\nUse /watch ${first.ref} to respond.`
        : `[todo] ${todoCount} Tasks need you in ${selectedApp}. Run /todo.`;
    presentView("/todo notification", text, {
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
  const lines = ["", `Task ${task.ref} · ${task.appId}`, "", "Goal", `  ${task.outcome}`, "", "State"];
  lines.push(`  ${taskStatusLabel(task)}. ${task.statusDetail || ""}`.trimEnd());
  const currentHeading =
    !task.terminal && Number.isSafeInteger(task.progress?.updatedAt)
      ? `Current · ${formatWorkTime(task.progress.updatedAt)}`
      : "Current";
  lines.push(
    "",
    currentHeading,
    ...currentTaskText(task)
      .split("\n")
      .map((line) => `  ${line}`),
  );
  for (const wait of Array.isArray(task.waitingOn) ? task.waitingOn : []) {
    if (wait?.kind === "task") {
      lines.push(`  Waiting on ${wait.ref} · ${wait.appId} · ${taskStatusLabel(wait)} — ${wait.outcome}`);
    } else if (wait?.kind === "app") {
      lines.push(`  Waiting on App ${wait.appId} · ${taskStatusLabel(wait)}`);
    } else if (wait?.kind === "condition") {
      lines.push(`  Waiting for ${wait.type} — ${wait.subject}`);
    }
  }
  lines.push("", "Expected result");
  const acceptance = Array.isArray(task.acceptance)
    ? task.acceptance.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (acceptance.length > 0) lines.push(...acceptance.map((item) => `  - ${item.trim()}`));
  else lines.push("  No separate completion criteria were recorded.");
  lines.push("", "You", `  ${task.humanAction ? humanActionText(task) : "Nothing needed right now."}`);
  if (task.requestedBy) {
    lines.push(
      "",
      "Related",
      `  Requested by ${task.requestedBy.ref} · ${task.requestedBy.appId} — ${task.requestedBy.outcome}`,
    );
  }
  lines.push("", "Updated", `  ${formatWorkTime(task.updatedAt)}`, "", "Details", `  ID: ${task.taskId}`);
  if (task.execution?.sessionId) lines.push(`  Session: ${task.execution.sessionId}`);
  lines.push("");
  if (options.transient) printLine(lines.join("\n"));
  else presentView(command, lines.join("\n"), { taskRefs: representedTaskIdentities(task) });
}

function taskPresentationKey(task) {
  return taskIdentity(task) ? `${task.appId}\0${task.taskId}` : "";
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
  if (options.catchUp && previous) printLine(`[catch-up] ${task.ref} changed while it was not followed.`);
  renderTask(task, `/watch ${task.ref}`, { transient: true });
  rememberTaskRevision(key, revision);
  return { rendered: true, seenBefore: previous !== undefined };
}

function setWatchedTask(task) {
  watchedTask = task && !task.terminal ? { appId: task.appId, taskId: task.taskId, ref: task.ref } : null;
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

function renderConversation(messages) {
  if (!Array.isArray(messages)) return;
  let latestFollowTask = null;
  for (const message of messages) {
    const id = typeof message.id === "string" ? message.id : "";
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!id || !text || renderedConversationMessages.has(id)) continue;
    const channel = message.metadata && typeof message.metadata.channel === "string" ? message.metadata.channel : "";
    const kind = message.author && typeof message.author.kind === "string" ? message.author.kind : "agent";
    const baseSpeaker = kind === "human" ? "you" : kind === "agent" ? "may" : kind;
    const speaker = channel && channel !== source ? `${baseSpeaker}[${channel}]` : baseSpeaker;
    const metadataTaskRefs = Array.isArray(message.metadata?.taskRefs) ? message.metadata.taskRefs : [];
    const taskRefs = metadataTaskRefs.flatMap((task) =>
      task && typeof task.ref === "string" && task.ref.trim()
        ? [`Task ${task.ref.trim()} (${task.appId || "unknown App"})`]
        : [],
    );
    printConversationText(speaker, taskRefs.length > 0 ? `${text}\n\n${taskRefs.join("\n")}` : text);
    rememberRenderedConversationMessage(id);
    if (kind === "agent") lastRenderedMayMessageId = id;
    const followTask = message.metadata?.followTask;
    if (
      kind === "agent" &&
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
  if (latestFollowTask) autoFollowTask(latestFollowTask);
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
    taskApps: [selectedApp],
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
          conversationReady = true;
          flushPendingInput();
        } else if (pending?.kind === "sync") {
          renderConversation(event.conversation?.messages);
        } else if (pending?.kind === "topics") {
          renderTopics(event.conversation, pending);
        } else if (pending?.kind === "topic") {
          renderTopic(event.conversation, pending);
        }
        if (conversationSyncDirty) requestConversation("sync");
      }
      if (event.command === "apps.list") {
        const pending = pendingAppReads.shift();
        renderApps(event.apps, pending);
        if (pending?.select) {
          appSelectionInFlight = false;
          flushPendingInput();
        }
      }
      if (event.command === "tasks.list") {
        const pending = pendingTaskListReads.shift();
        if (pending?.kind === "todo-refresh") {
          todoReadInFlight = false;
          applyTodoRefresh(event.tasks);
          if (todoReadDirty) {
            todoReadDirty = false;
            requestTodoRefresh();
          }
        } else if (pending?.kind === "todo-command") {
          renderTodos(event.tasks, pending);
        } else {
          renderTasks(event.tasks, pending);
        }
      }
      if (event.command === "task.get") {
        const pending = pendingTaskReads.shift();
        const task = event.task;
        if (pending?.kind === "watch-start") {
          if (task?.terminal) {
            renderWatchSnapshot(task, { catchUp: true });
            setWatchedTask(null);
            printLine("[watch] Task is already terminal.");
          } else if (task) {
            const snapshot = renderWatchSnapshot(task, { catchUp: true });
            setWatchedTask(task);
            printLine(
              snapshot.rendered || !snapshot.seenBefore
                ? `[watch] Watching ${task.ref}. May receives bare text with this Task in context.`
                : `[watch] Watching ${task.ref}; there is no new progress since it was last shown.`,
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
            printLine(
              `${
                pending.assignedFrom?.ref
                  ? `[watch] Following assigned Task ${task.ref} (${task.appId}) for Task ${pending.assignedFrom.ref} (${pending.assignedFrom.appId}).`
                  : `[watch] Following assigned Task ${task.ref}.`
              }${
                previous && autoFollowKey(previous) !== autoFollowKey(task)
                  ? ` Stopped following ${previous.ref}.`
                  : " May receives bare text with this Task in context."
              }`,
            );
          }
          requestDesiredAutoFollow();
        } else if (pending?.kind === "watch-refresh") {
          watchedTaskReadInFlight = false;
          if (task) renderWatchSnapshot(task);
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
      if (event.command === "apps.list") {
        const pending = pendingAppReads.shift();
        if (pending?.select) {
          appSelectionInFlight = false;
          flushPendingInput();
        }
      }
      if (event.command === "tasks.list") {
        const pending = pendingTaskListReads.shift();
        if (pending?.kind === "todo-refresh") {
          todoReadInFlight = false;
          if (todoReadDirty) {
            todoReadDirty = false;
            requestTodoRefresh();
          }
        }
      }
      if (event.command === "task.get") {
        const pending = pendingTaskReads.shift();
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
        taskApps: [selectedApp],
        task: watchedTask ? { appId: watchedTask.appId, taskId: watchedTask.taskId } : null,
      },
      { silent: true },
    );
    if (pendingConversationReads.length > 0) {
      for (const pending of pendingConversationReads) sendConversationRead(pending);
    } else {
      requestConversation();
    }
    for (const pending of pendingAppReads) sendAppRead(pending);
    for (const pending of pendingTaskListReads) sendTaskListRead(pending);
    for (const pending of pendingTaskReads) sendTaskRead(pending);
    if (!pendingTaskListReads.some((pending) => pending.kind === "todo-refresh")) requestTodoRefresh();
    if (!pendingTaskReads.some((pending) => pending.kind === "watch-refresh")) {
      watchedTaskReadInFlight = false;
      refreshWatchedTask();
    }
    if (!pendingTaskReads.some((pending) => pending.kind === "auto-follow")) requestDesiredAutoFollow();
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
    // Reads are idempotent. Preserve and replay them after reconnect so a
    // daemon restart cannot silently swallow /tasks, /task, /apps, or sync.
    if (pendingConversationReads.length > 0) {
      pendingConversationReads.splice(0, pendingConversationReads.length, { kind: "startup" });
      conversationSyncDirty = false;
    }
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
      "  /apps [app]                 List or select an App",
      "  /topics, /topics more       List Topics",
      "  /topic [ref|clear]          Show, follow, or leave a Topic",
      "  /tasks [all] [history], /tasks more",
      "  /todo [all], /todo more     Show Tasks that need your action",
      "  /task <ref>",
      "  /watch [ref], /unwatch",
      "  /cancel [ref]",
      "  /reload, /restart, /shell, /exit",
      "",
      "Bare text goes to May in the selected App context. While watching, that Task is additional context.",
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
      if (rest) appSelectionInFlight = true;
      if (!requestApps(rest || null, input, Boolean(rest))) appSelectionInFlight = false;
      return;
    case "topics":
      if (restParts.length > 1 || (restParts.length === 1 && restParts[0].toLowerCase() !== "more")) {
        printLine("Usage: /topics, or /topics more");
        return;
      }
      if (restParts[0]?.toLowerCase() === "more") {
        if (!nextTopicPage) {
          printLine("[topics] No next page. Run /topics first.");
          return;
        }
        requestConversation("topics", nextTopicPage);
        return;
      }
      nextTopicPage = null;
      requestConversation("topics", { command: input });
      return;
    case "topic":
      if (restParts.length > 1) {
        printLine("Usage: /topic [ref|clear]");
        return;
      }
      if (rest.toLowerCase() === "clear") {
        if (!selectedTopic) {
          printLine("No Topic is currently followed.");
          return;
        }
        const prior = topicRef(selectedTopic);
        selectedTopic = null;
        refreshPrompt();
        presentView(input, `Stopped following Topic ${prior}. Its Tasks continue unchanged.`);
        return;
      }
      if (!rest && !selectedTopic) {
        printLine("No Topic is currently followed. Run /topics to choose one.");
        return;
      }
      requestConversation("topic", {
        command: input,
        ...(rest ? { ref: rest, select: true } : { current: true }),
      });
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
      desiredAutoFollow = null;
      requestTask({ kind: "watch-start", ref: rest, command: input });
      return;
    }
    case "unwatch":
      if (rest) {
        printLine("Usage: /unwatch");
        return;
      }
      if (!watchedTask && !desiredAutoFollow) {
        printLine("[watch] No Task is watched.");
        return;
      }
      desiredAutoFollow = null;
      if (watchedTask) setWatchedTask(null);
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

  // Ordinary turns should follow the Conversation history the human is about
  // to see. Preserve early keystrokes until the initial Conversation snapshot
  // arrives instead of executing them against an empty local view.
  if (!connected || !conversationReady) {
    pendingInputLines.push(input);
    printLine("[waiting for May; input queued]");
    return;
  }

  // A selected App changes the meaning of the next bare turn and /tasks.
  // Keep terminal input ordered across that one asynchronous lookup while
  // leaving the daemon's event handlers independent and non-blocking.
  if (appSelectionInFlight) {
    pendingInputLines.push(input);
    refreshPrompt();
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
