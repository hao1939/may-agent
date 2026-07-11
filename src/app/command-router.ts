import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { ChatSession } from "./chat-session.js";
import type { EventBus } from "./event-bus.js";
import { isRecord, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  getChatSession: () => ChatSession | undefined;
  clearCancelLatch: () => void;
  projectRoot: string;
  reload: () => void | Promise<void>;
  restart: () => void;
  shutdown: () => void;
}

export interface CommandRouter {
  handleInput: (message: string, source?: string) => void;
  close: () => void;
}

function eventData(event: unknown): Record<string, unknown> {
  if (!isRecord(event)) return {};
  return isRecord(event.data) ? event.data : event;
}

function eventSource(event: unknown, fallback = "human"): string {
  if (!isRecord(event)) return fallback;
  return typeof event.source === "string" && event.source.trim() ? event.source.trim() : fallback;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ownerAgent(owner: unknown): string | null {
  if (typeof owner !== "string" || !owner.trim()) return null;
  const trimmed = owner.trim();
  return trimmed.startsWith("agent:") ? trimmed.slice("agent:".length) : trimmed;
}

function objectField(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const next = value[key];
  return isRecord(next) ? next : null;
}

function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  return nonEmptyString(value[key]);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function telegramReplyContext(context: Record<string, unknown>): Record<string, unknown> | null {
  return objectField(context, "telegramReply");
}

function isEscalationReplyContext(context: Record<string, unknown>): boolean {
  const reply = telegramReplyContext(context);
  if (!reply) return false;
  const issue = objectField(reply, "originalIssue");
  if (stringField(issue, "eventType") === "escalation.created") return true;
  const closures = stringList(reply.expectedClosure);
  return closures.includes("escalation.resolved") || closures.includes("escalation.dismissed");
}

function buildDeliveredHumanMessage(message: string, context: Record<string, unknown>): string {
  const reply = telegramReplyContext(context);
  if (!reply) return message;

  const issue = objectField(reply, "originalIssue");
  const notification = objectField(reply, "notification");
  const lines = [
    "May reply-handling work item",
    "",
    "Human reply",
    message,
    "",
    "Attached context",
  ];

  const conversationId = stringField(reply, "conversationId");
  const eventType = stringField(issue, "eventType") ?? stringField(reply, "eventType");
  const escalationId = stringField(issue, "escalationId") ?? stringField(reply, "escalationId");
  const project =
    stringField(issue, "projectPath") ??
    stringField(reply, "projectId") ??
    stringField(issue, "targetProject");
  const sourceSessionId = stringField(issue, "sourceSessionId") ?? stringField(reply, "sessionId");
  const reason =
    stringField(issue, "reason") ??
    stringField(notification, "reason") ??
    stringField(notification, "summary");
  const requestedAction =
    stringField(issue, "requestedAction") ??
    stringField(notification, "requestedAction") ??
    stringField(notification, "requestedHumanAction");
  const visibleNotification = stringField(notification, "text");
  const expectedClosure = stringList(reply.expectedClosure);

  if (conversationId) lines.push(`Conversation: ${conversationId}`);
  if (eventType) lines.push(`Original issue: ${eventType}`);
  if (escalationId) lines.push(`Escalation: ${escalationId}`);
  if (project) lines.push(`Project: ${project}`);
  if (sourceSessionId) lines.push(`Source session: ${sourceSessionId}`);
  if (reason) lines.push(`Reason: ${reason}`);
  if (requestedAction) lines.push(`Original ask: ${requestedAction}`);
  if (visibleNotification) lines.push(`Visible notification: ${visibleNotification.slice(0, 800)}`);
  if (expectedClosure.length) lines.push(`Expected closure: ${expectedClosure.join(", ")}`);

  lines.push("");
  lines.push(
    "Handle this reply as May. Use the human reply as the decision or missing input, keep it attached to the original issue, and emit one structured result event when possible.",
  );
  lines.push(
    "If the reply is insufficient, create one exact follow-up ask or wait with a recheck/fallback instead of leaving this as a loose chat.",
  );
  return lines.join("\n");
}

/**
 * Routes human/control input from console, socket, Telegram, and the event bus.
 *
 * Chat sessions own free-form input. Non-chat daemon modes only accept built-in
 * control commands so task/cron processes do not accidentally become routers.
 */
export function attachCommandRouter(options: CommandRouterOptions): CommandRouter {
  const { bus, manager } = options;

  function normalizeProjectPath(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    let path = value
      .trim()
      .replace(/^\/app\//, "")
      .replace(new RegExp(`^${escapeRegExp(options.projectRoot)}/`), "")
      .replace(/^\.?\//, "")
      .replace(/\/project\.md$/, "")
      .replace(/[),.;:]+$/, "")
      .replace(/\/$/, "");
    path = path.replace(/^agents\/shared\/projects\//, "projects/").replace(/^shared\/projects\//, "projects/");
    if (/^projects\/[^/\s]+$/.test(path)) return path;
    if (!path.startsWith("agents/")) path = `agents/${path}`;
    if (!/^agents\/[^/]+\/workspace\/projects\/[^/\s]+$/.test(path)) return null;
    return path;
  }

  function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function projectOwner(projectPath: string): string {
    const projectFile = join(options.projectRoot, projectPath, "project.md");
    try {
      const content = readFileSync(projectFile, "utf-8");
      const match = content.match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m);
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* best-effort owner lookup */
    }
    return "may";
  }

  function appendProjectDiscussionEntry(
    projectPath: unknown,
    comment: unknown,
    source?: string,
    author?: string,
  ): boolean {
    const normalized = normalizeProjectPath(projectPath);
    const trimmed = typeof comment === "string" ? comment.trim() : "";
    if (!normalized || !trimmed) {
      bus.emit({
        type: "info",
        message: `[project.comment] Invalid project comment event from ${source ?? "unknown"}`,
      });
      return false;
    }

    const projectDir = join(options.projectRoot, normalized);
    const projectFile = join(projectDir, "project.md");
    if (!existsSync(projectFile)) {
      bus.emit({ type: "info", message: `[project.comment] Project target not found: ${normalized}` });
      return false;
    }

    const date = new Date().toISOString().slice(0, 10);
    const discussionFile = join(projectDir, "discussion.md");
    const entry = `\n### ${author?.trim() || "hao"} - ${date}\n${trimmed}\n`;
    if (existsSync(discussionFile)) appendFileSync(discussionFile, entry, "utf-8");
    // Seed with `---read @iter0---` so a freshly created discussion.md does
    // not look fully unread to the project workflow.
    else writeFileSync(discussionFile, `# Discussion\n\n---read @iter0---\n${entry}`, "utf-8");

    // Flip status to `active` so downstream watchers see the project as
    // pushable immediately, not on the next handler tick.
    let resumed = false;
    let content = readFileSync(projectFile, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const statusLine = fmMatch[1].match(/^status:\s*(.+)$/m);
      const current = statusLine ? statusLine[1].trim().toLowerCase() : "";
      if (["blocked", "waiting", "paused", "pending-review"].includes(current)) {
        const newFrontmatter = fmMatch[1].replace(/^status:\s*.+$/m, "status: active");
        content = content.replace(fmMatch[0], `---\n${newFrontmatter}\n---`);
        writeFileSync(projectFile, content, "utf-8");
        resumed = true;
      }
    }

    bus.emit({
      type: "project.nudge",
      source: source ?? "command-router",
      owner: normalizeEventOwner(projectOwner(normalized)),
      data: {
        projectPath: normalized,
        comment: true,
        commentText: trimmed,
      },
    } as any);
    bus.emit({
      type: "info",
      message: `[project.comment] Appended comment and nudged ${normalized}${resumed ? " (status → active)" : ""}`,
    });
    return true;
  }

  function handleInput(message: string, source?: string): void {
    const text = message.trim();
    if (!text) return;
    const channel = source ?? "human";
    bus.emit({
      type: "human.input.received",
      source: channel,
      owner: "agent:may",
      data: {
        actor: "human",
        text,
        conversation: { channel },
      },
    } as any);
  }

  function handleHumanInput(event: unknown): void {
    options.clearCancelLatch();
    const data = eventData(event);
    const message = nonEmptyString(data.text) ?? nonEmptyString(data.message);
    if (!message) return;
    const conversation = isRecord(data.conversation) ? data.conversation : {};
    const target = isRecord(data.target) ? data.target : {};
    const context = isRecord(data.context) ? data.context : {};
    const source = eventSource(event, nonEmptyString(conversation.channel) ?? "human");
    const deliveredMessage = buildDeliveredHumanMessage(message, context);
    const escalationReply = isEscalationReplyContext(context);
    const eventOwner =
      typeof event === "object" && event && "owner" in event ? String((event as any).owner) : "agent:may";

    const targetSessionId = nonEmptyString(target.sessionId);
    if (targetSessionId && !escalationReply) {
      bus.emit({
        type: "session.steer.requested",
        source,
        owner: eventOwner,
        data: {
          sessionId: targetSessionId,
          message: deliveredMessage,
          ...(Object.keys(context).length ? { context } : {}),
        },
      } as any);
      return;
    }

    if (escalationReply) {
      bus.emit({
        type: "chat.start.requested",
        source,
        owner: "agent:may",
        data: {
          agent: "may",
          message: deliveredMessage,
          channel: nonEmptyString(conversation.channel) ?? source,
          channelThreadId: nonEmptyString(conversation.channelThreadId) ?? undefined,
          channelMessageId: typeof conversation.channelMessageId === "number" ? conversation.channelMessageId : undefined,
          requestId: nonEmptyString(data.inputId) ?? undefined,
          ...(Object.keys(context).length ? { context } : {}),
        },
      } as any);
      return;
    }

    const targetProjectPath = nonEmptyString(target.projectPath);
    if (targetProjectPath) {
      bus.emit({
        type: "project.comment.created",
        source,
        owner: eventOwner,
        data: { projectPath: targetProjectPath, comment: message, author: nonEmptyString(data.actor) ?? "human" },
      } as any);
      return;
    }

    const lower = message.trim().toLowerCase();
    if (lower === "status") {
      const sessions = manager.status();
      if (sessions.length === 0) {
        bus.emit({ type: "info", message: "[status] No active sessions" });
      } else {
        const lines = sessions.map(
          (s) => `  ${s.agent} (${s.sessionId}): ${s.status} - "${s.task.slice(0, 80)}" [${s.runtime}]`,
        );
        bus.emit({ type: "info", message: `[status] ${sessions.length} active session(s):\n${lines.join("\n")}` });
      }
      return;
    }
    if (lower === "cancel" || lower === "cancel all") {
      bus.emit({
        type: "session.cancel_all.requested",
        source,
        owner: "agent:may",
        urgency: "high",
        data: { reason: "human requested cancel all" },
      } as any);
      return;
    }
    if (lower === "reload") {
      bus.emit({
        type: "runtime.reload.requested",
        source,
        owner: "agent:may",
        data: { reason: "human requested reload" },
      } as any);
      return;
    }
    if (lower === "restart") {
      bus.emit({
        type: "runtime.restart.requested",
        source,
        owner: "agent:may",
        urgency: "high",
        data: { reason: "human requested restart" },
      } as any);
      return;
    }
    if (lower === "close") {
      bus.emit({
        type: "runtime.shutdown.requested",
        source,
        owner: "agent:may",
        urgency: "high",
        data: { reason: "human requested close" },
      } as any);
      return;
    }

    const agent = nonEmptyString(target.agent) ?? ownerAgent(eventOwner) ?? "may";
    bus.emit({
      type: "chat.start.requested",
      source,
      owner: normalizeEventOwner(agent),
      data: {
        agent,
        message: deliveredMessage,
        channel: nonEmptyString(conversation.channel) ?? source,
        channelThreadId: nonEmptyString(conversation.channelThreadId) ?? undefined,
        channelMessageId: typeof conversation.channelMessageId === "number" ? conversation.channelMessageId : undefined,
        requestId: nonEmptyString(data.inputId) ?? undefined,
        forceNew: context.forceNew === true,
        ...(Object.keys(context).length ? { context } : {}),
      },
    } as any);
  }

  function handleSteer(sessionId: unknown, message: unknown, source?: string): void {
    const targetSid = nonEmptyString(sessionId);
    const steerText = nonEmptyString(message);
    if (!targetSid || !steerText) return;
    try {
      const sessions = manager.status();
      const target = sessions.find((s) => s.sessionId === targetSid);
      if (target) {
        // Idle or running — send() handles both: it enqueues the user
        // turn for the next agent loop iteration (idle: wakes up;
        // running: queued for mid-flight delivery).
        manager.send(targetSid, steerText);
      } else {
        try {
          manager.resumeSession(targetSid, steerText, {
            source: source ?? "human",
            suppressBenignRaceEvent: true,
          });
          log("info", `[steer] Resumed cold session ${targetSid}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log("warn", `[steer] Could not resume ${targetSid}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("error", `[steer] ${msg}`);
    }
  }

  function cancelAllRunningSessions(): void {
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    bus.emit({ type: "info", message: "[cmd] Cancelled all running sessions" });
  }

  function handleChatStart(event: unknown): void {
    const data = eventData(event);
    const message = nonEmptyString(data.message);
    if (!message) return;
    const agent = nonEmptyString(data.agent) ?? "may";
    const source = eventSource(event, nonEmptyString(data.channel) ?? "human");
    const forceNew = data.forceNew === true;
    const chatSession = options.getChatSession();
    if (chatSession && agent === "may" && !forceNew) {
      chatSession.handleInput(message, source);
      return;
    }

    bus.emit({
      type: "message.created",
      source,
      owner: normalizeEventOwner(agent),
      urgency: "immediate",
      data: {
        from: source,
        to: agent,
        content: message,
        intent: "chat.start",
        priority: "P0",
      },
    } as any);
    const sessionId = manager.run(agent, message, {
      kind: "chat",
      autoClose: "never",
      source,
      requestId: nonEmptyString(data.requestId) ?? undefined,
    });
    log("info", `[chat.start] Started ${agent} chat session: ${sessionId}`);
  }

  function handleFork(event: any): void {
    if (!("agent" in event) || !("task" in event)) return;
    bus.emit({
      type: "message.created",
      source: event.opts?.source || "socket",
      owner: normalizeEventOwner(event.agent),
      urgency: "immediate",
      data: {
        from: event.opts?.source || "socket",
        to: event.agent,
        content: event.task,
        intent: "fork",
        priority: "P0",
      },
    } as any);
    const chatSession = options.getChatSession();
    if (chatSession && event.agent === "may") {
      chatSession.handleInput(event.task, "socket");
    } else {
      const sessionId = manager.run(event.agent, event.task, {
        kind: (event.opts?.kind as "chat" | "job" | "call" | undefined) ?? "job",
        requestId: event.opts?.requestId,
      });
      log("info", `[fork] Started ${event.agent} session: ${sessionId}`);
    }
  }

  const unsubscribe = bus.subscribe((event) => {
    switch (event.type) {
      case "input":
        if (typeof event.message !== "string") break;
        handleInput(event.message, event.source);
        break;
      case "human.input.received":
        handleHumanInput(event);
        break;
      case "steer": {
        handleSteer(event.sessionId, event.message, event.source);
        break;
      }
      case "session.steer.requested": {
        const data = eventData(event);
        handleSteer(data.sessionId, data.message, eventSource(event));
        break;
      }
      case "chat.start.requested":
        handleChatStart(event);
        break;
      case "cancel":
        if (event.sessionId) manager.cancel(event.sessionId);
        break;
      case "session.cancel.requested": {
        const data = eventData(event);
        const sessionId = nonEmptyString(data.sessionId);
        if (sessionId) manager.cancel(sessionId);
        break;
      }
      case "cancel_all":
      case "session.cancel_all.requested":
        cancelAllRunningSessions();
        break;
      case "project.comment.created":
        {
          const data = eventData(event);
          appendProjectDiscussionEntry(
            data.projectPath,
            data.comment,
            typeof event.source === "string" ? event.source : undefined,
            typeof data.author === "string" ? data.author : undefined,
          );
        }
        break;
      case "fork":
        handleFork(event);
        break;
      case "reload":
      case "runtime.reload.requested":
        void options.reload();
        break;
      case "restart":
      case "runtime.restart.requested":
        options.restart();
        break;
      case "shutdown":
      case "runtime.shutdown.requested":
        options.shutdown();
        break;
    }
  });

  return { handleInput, close: unsubscribe };
}
