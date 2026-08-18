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
let watchMode = "may"; // may | all | current
let watchedSessionId = null;
let pendingStatusView = null;
let lastDisconnectedMessage = "";
let conversationReady = false;
const pendingInputLines = [];

const knownSessions = new Map();
const sessionsWithText = new Set();
const renderedConversationMessages = new Set();
const renderedDeliveryOperations = new Set();
let lastConversationSequence = Date.now();
let lastWork = [];
const pendingConversationReads = [];
let conversationSyncDirty = false;

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
  if (!connected) return "you[disconnected]> ";
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
  if (watchMode === "all" || debug || raw) return ["*"];
  // Normal conversation only needs responses addressed to this delivery
  // channel. Session streams remain available through /watch.
  return [];
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
  const sequence = Math.max(Date.now(), lastConversationSequence + 1);
  lastConversationSequence = sequence;
  const messageId = `${source}:${adapterInstanceId}:${sequence}`;
  // Readline already rendered this human turn in the current terminal. Keep
  // its durable identity so a Conversation wake does not echo it back here,
  // while turns from another Console process remain visible.
  renderedConversationMessages.add(messageId);
  return {
    type: "publish",
    event: {
      type: "conversation.message.created",
      target: { appId: "may" },
      data: {
        conversationId,
        author: { kind: "human", id: messageId },
        text: message,
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
    metadata: { command },
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
    lines.push(`  ${index + 1}. ${message} — ${state}`);
    if (typeof item.progress === "string" && item.progress.trim()) {
      lines.push(`     ${item.progress.trim()}`);
    }
  });
  lines.push("");
  presentView(command, lines.join("\n"), { transient: pending?.transient === true });
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
      `  Updated: ${formatWorkTime(refreshed.updatedAt)}`,
      "",
    ].join("\n"),
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
    renderedConversationMessages.add(id);
  }
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
  return sendFrame({
    type: "subscribe",
    sessions: watchSessions(),
    conversations: [conversationId],
    deliveryChannel: source,
  });
}

function requestStatus(command = "/status") {
  pendingStatusView = command;
  if (!sendFrame({ type: "status" })) pendingStatusView = null;
}

function resolveSessionId(input) {
  const needle = String(input || "").trim();
  if (!needle) return { ok: false, message: "missing session id" };
  if (knownSessions.has(needle)) return { ok: true, sessionId: needle };
  const matches = [...knownSessions.keys()].filter((id) => id.startsWith(needle) || id.endsWith(needle));
  if (matches.length === 1) return { ok: true, sessionId: matches[0] };
  if (matches.length > 1)
    return { ok: false, message: `ambiguous session id '${needle}': ${matches.map(shortSessionId).join(", ")}` };
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
      const task = String(item.task || "")
        .replace(/\s+/g, " ")
        .slice(0, 100);
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
  printLine(
    `[${data.agent || daemonAgent}] started ${shortSessionId(data.sessionId)}${parent}: ${String(data.task || "").slice(0, 100)}`,
  );
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
  if (
    (debug || watchMode !== "may") &&
    isMayTurn &&
    status === "done" &&
    rawSummary &&
    !sessionsWithText.has(sessionId)
  ) {
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

  // A delivery channel is already an exact routing decision. Session stream
  // filters must not hide a response and then leave its durable work unresolved.
  if (event.type === "app.response.delivery.requested") {
    const data = flatPayload(event);
    if (data.channel !== source || typeof data.text !== "string") return;
    if (typeof data.operationId === "string") {
      renderedDeliveryOperations.add(data.operationId);
      renderedConversationMessages.add(`delivery:${data.operationId}`);
    }
    const identity = [data.operationId, data.appInboxItemId, data.appInboxRequestId, data.sessionId];
    printResponseText(data.text, () => {
      if (!identity.every((value) => typeof value === "string" && value.length > 0)) return;
      sendFrame({
        type: "channel.delivery.completed",
        source,
        owner: "app:may",
        target: { human: true },
        data: {
          channel: source,
          sessionId: data.sessionId,
          resultEventType: event.type,
          operationId: data.operationId,
          appInboxItemId: data.appInboxItemId,
          appInboxRequestId: data.appInboxRequestId,
          idempotencyKey: `${source}-delivery:${data.operationId}`,
        },
      });
    });
    return;
  }

  if (!shouldShowSessionEvent(event)) return;
  const data = flatPayload(event);
  switch (event.type) {
    case "connected":
      handleConnected(event);
      return;
    case "ok":
      if (event.command === "publish" && Number.isSafeInteger(event.eventId) && event.eventId > 0) {
        // Non-human Conversation events are projected by durable event row ID.
        // Marking every local publish receipt is harmless for other event kinds.
        renderedConversationMessages.add(`event:${event.eventId}`);
      }
      if (event.command === "app.conversation.get") {
        const pending = pendingConversationReads.shift();
        if (pending?.kind === "startup") {
          renderConversation(event.conversation?.messages);
          renderWorkList(event.conversation?.work, { all: false, command: "/work", transient: true });
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
      printLine(`[error] ${event.message || "unknown error"}`);
      return;
    case "status":
      {
        const rendered = renderStatus(event.activeAgents);
        if (pendingStatusView) presentView(pendingStatusView, rendered);
        else if (debug || watchMode === "all") printLine(rendered);
        pendingStatusView = null;
      }
      return;
    case "session.start":
      handleSessionStart(event);
      return;
    case "text":
      if (!debug && watchMode === "may") return;
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
    sendFrame(
      {
        type: "subscribe",
        sessions: watchSessions(),
        conversations: [conversationId],
        deliveryChannel: source,
      },
      { silent: true },
    );
    sendFrame({ type: "status" }, { silent: true });
    requestConversation();
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
      "  /work [all|number]",
      "  /status, /sessions",
      "  /watch may|all|<sessionId>",
      "  /steer <sessionId> <message>",
      "  /cancel <sessionId>|all",
      "  /debug, /raw",
      "  /reload, /restart, /shell, /exit",
      "",
      "Bare text always starts a bounded turn with May.",
    ].join("\n"),
  );
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
      requestStatus(`/${command}`);
      return;
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
      printLine(
        "[/use] Input always goes to May. Use /watch <sessionId> to inspect or /steer <sessionId> <message> to steer.",
      );
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
      subscribe(watchMode);
      printLine(`[raw ${raw ? "on" : "off"}]`);
      return;
    case "debug":
      debug = !debug;
      subscribe(watchMode);
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

  // A session-only watch would hide the bounded May turn that this input
  // starts. Return to the May view before sending so the reply stays visible.
  if (watchMode === "current") {
    watchedSessionId = null;
    subscribe("may");
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
