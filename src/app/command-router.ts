import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { ChatSession } from "./chat-session.js";
import { childEventTrace, type EventBus } from "./event-bus.js";
import { getRecentTelegramConversationMessages } from "../lib/db/notifications.js";
import { isRecord, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  getChatSession: () => ChatSession | undefined;
  clearCancelLatch: () => void;
  projectRoot: string;
  persistDir?: string;
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

function integerField(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const next = value[key];
  return typeof next === "number" && Number.isInteger(next) ? next : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean) : [];
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

function approvalReplyContext(context: Record<string, unknown>): Record<string, unknown> | null {
  const reply = telegramReplyContext(context);
  if (!reply) return null;
  const issue = objectField(reply, "originalIssue");
  const closures = stringList(reply.expectedClosure);
  if (stringField(issue, "eventType") === "project.approval.requested") return reply;
  return closures.includes("project.approval.submitted") ? reply : null;
}

type ApprovalDecision = "approve" | "adjust" | "hold" | "decline" | "reroute";

function parseExplicitApprovalDecision(message: string): ApprovalDecision | null {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized || /[?？]/.test(normalized)) return null;

  const direct: Record<string, ApprovalDecision> = {
    approve: "approve",
    approved: "approve",
    yes: "approve",
    ok: "approve",
    okay: "approve",
    "go ahead": "approve",
    proceed: "approve",
    reject: "decline",
    rejected: "decline",
    decline: "decline",
    declined: "decline",
    deny: "decline",
    denied: "decline",
    no: "decline",
    hold: "hold",
    pause: "hold",
    wait: "hold",
  };
  const exact = direct[normalized.replace(/[.!]+$/, "")];
  if (exact) return exact;

  if (/^adjust(?:\s*:\s*|\s+)\S.+$/.test(normalized)) return "adjust";
  if (/^(?:reroute|re-route)(?:\s*:\s*|\s+(?:to\s+)?)\S.+$/.test(normalized)) return "reroute";
  return null;
}

function buildDeliveredHumanMessage(message: string, context: Record<string, unknown>): string {
  const reply = telegramReplyContext(context);
  if (!reply) return message;

  const issue = objectField(reply, "originalIssue");
  const notification = objectField(reply, "notification");
  const lines = ["May reply-handling work item", "", "Human reply", message, "", "Attached context"];

  const conversationId = stringField(reply, "conversationId");
  const traceId = stringField(reply, "traceId");
  const taskId = stringField(reply, "taskId");
  const eventType = stringField(issue, "eventType") ?? stringField(reply, "eventType");
  const escalationId = stringField(issue, "escalationId") ?? stringField(reply, "escalationId");
  const project =
    stringField(issue, "projectPath") ?? stringField(reply, "projectId") ?? stringField(issue, "targetProject");
  const sourceSessionId = stringField(issue, "sourceSessionId") ?? stringField(reply, "sessionId");
  const reason =
    stringField(issue, "reason") ?? stringField(notification, "reason") ?? stringField(notification, "summary");
  const requestedAction =
    stringField(issue, "requestedAction") ??
    stringField(notification, "requestedAction") ??
    stringField(notification, "requestedHumanAction");
  const visibleNotification = stringField(notification, "text");
  const expectedClosure = stringList(reply.expectedClosure);

  if (conversationId) lines.push(`Conversation: ${conversationId}`);
  if (traceId) lines.push(`Request trace: ${traceId}`);
  if (taskId) lines.push(`Owner task: ${taskId}`);
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
    "First understand the human's intention. A question, request for explanation or advice, correction, or uncertain response is not an approval decision.",
  );
  lines.push(
    "Answer what the attached context already supports. If the intended next action is still uncertain, state your likely interpretation and ask one focused question. Keep consequential state pending until the intention is clear.",
  );
  lines.push(
    "When the intention is clear, continue the tracked work and emit one structured result event when possible. Keep it attached to the original issue instead of leaving this as loose chat.",
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
    const projectJson = join(options.projectRoot, projectPath, "project.json");
    try {
      const parsed = JSON.parse(readFileSync(projectJson, "utf-8")) as { owner?: unknown };
      if (typeof parsed.owner === "string" && parsed.owner.trim()) return parsed.owner.trim();
    } catch {
      /* best-effort owner lookup */
    }

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

    const appPath = normalized.endsWith(".app") ? normalized : `${normalized}.app`;
    if (existsSync(join(options.projectRoot, appPath, "app.ts"))) {
      bus.emit({
        type: "info",
        message: `[project.comment] Routed ${normalized} comment to its project app`,
      });
      return true;
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
    let deliveredMessage = buildDeliveredHumanMessage(message, context);
    if (source === "telegram" && options.persistDir) {
      const conversationId = nonEmptyString(conversation.id);
      if (conversationId) {
        deliveredMessage = appendRecentTelegramContext(
          deliveredMessage,
          getRecentTelegramConversationMessages(options.persistDir, conversationId),
        );
      }
    }
    const escalationReply = isEscalationReplyContext(context);
    const approvalReply = approvalReplyContext(context);
    const explicitApprovalDecision = approvalReply ? parseExplicitApprovalDecision(message) : null;
    const eventOwner =
      typeof event === "object" && event && "owner" in event ? String((event as any).owner) : "agent:may";

    if (approvalReply && explicitApprovalDecision) {
      const issue = objectField(approvalReply, "originalIssue");
      const expectedResponse = objectField(issue, "expectedResponse");
      const normalizedProjectPath =
        normalizeProjectPath(target.projectPath) ??
        normalizeProjectPath(stringField(issue, "projectPath")) ??
        normalizeProjectPath(stringField(approvalReply, "projectId")) ??
        normalizeProjectPath(stringField(issue, "targetProject"));
      const responseTarget = objectField(expectedResponse, "target");
      const approvalOwner = normalizedProjectPath
        ? projectOwner(normalizedProjectPath)
        : (stringField(approvalReply, "agent") ?? ownerAgent(eventOwner) ?? "may");
      bus.emit({
        type: "project.approval.submitted",
        source,
        owner: normalizeEventOwner(approvalOwner),
        ...(responseTarget ? { target: responseTarget } : {}),
        data: {
          approvalKind:
            stringField(issue, "approvalKind") ??
            stringField(approvalReply, "approvalKind") ??
            "approval-packet-dispatch",
          approvalId: stringField(issue, "approvalId") ?? stringField(expectedResponse, "approvalId") ?? undefined,
          waitId: stringField(issue, "waitId") ?? stringField(expectedResponse, "waitId") ?? undefined,
          pathId: stringField(issue, "pathId") ?? stringField(expectedResponse, "pathId") ?? undefined,
          packetPath: stringField(issue, "packetPath") ?? undefined,
          taskId: stringField(issue, "taskId") ?? stringField(expectedResponse, "taskId") ?? undefined,
          taskGeneration:
            integerField(issue, "taskGeneration") ?? integerField(expectedResponse, "taskGeneration") ?? undefined,
          artifactFingerprint:
            stringField(issue, "artifactFingerprint") ??
            stringField(expectedResponse, "artifactFingerprint") ??
            undefined,
          projectPath: normalizedProjectPath ?? undefined,
          projectId: normalizedProjectPath ?? undefined,
          targetProject: stringField(issue, "targetProject") ?? undefined,
          decision: explicitApprovalDecision,
          message,
          conversationId: stringField(approvalReply, "conversationId") ?? undefined,
        },
      } as any);
      return;
    }

    const mayBrokerReply = escalationReply || Boolean(approvalReply);
    const targetSessionId = nonEmptyString(target.sessionId);
    const lower = message.trim().toLowerCase();
    if (lower === "cancel") {
      if (targetSessionId) {
        bus.emit({
          type: "session.cancel.requested",
          source,
          owner: eventOwner,
          urgency: "high",
          data: { sessionId: targetSessionId, reason: "human requested cancel" },
        } as any);
      } else {
        bus.emit({
          type: "human.input.rejected",
          source: "command-router",
          owner: eventOwner,
          data: { reason: "cancel requires an explicit session target", input: message },
        } as any);
      }
      return;
    }
    if (lower === "cancel all") {
      bus.emit({
        type: "session.cancel_all.requested",
        source,
        owner: "agent:may",
        urgency: "high",
        data: { reason: "human requested cancel all" },
      } as any);
      return;
    }
    if (lower === "reload" || lower === "restart" || lower === "close") {
      const type =
        lower === "reload"
          ? "runtime.reload.requested"
          : lower === "restart"
            ? "runtime.restart.requested"
            : "runtime.shutdown.requested";
      bus.emit({
        type,
        source,
        owner: "agent:may",
        ...(lower === "reload" ? {} : { urgency: "high" }),
        data: { reason: `human requested ${lower}` },
      } as any);
      return;
    }

    const explicitSessionControl = context.explicitSessionControl === true;
    if (targetSessionId && !mayBrokerReply && (source !== "telegram" || explicitSessionControl)) {
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

    if (mayBrokerReply) {
      bus.emit({
        type: "chat.start.requested",
        source,
        owner: "agent:may",
        data: {
          agent: "may",
          message: deliveredMessage,
          channel: nonEmptyString(conversation.channel) ?? source,
          channelThreadId: nonEmptyString(conversation.channelThreadId) ?? undefined,
          channelMessageId:
            typeof conversation.channelMessageId === "number" ? conversation.channelMessageId : undefined,
          requestId: nonEmptyString(data.inputId) ?? undefined,
          conversationId: nonEmptyString(conversation.id) ?? undefined,
          forceNew: source === "telegram",
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

    const agent = nonEmptyString(target.agent) ?? ownerAgent(eventOwner) ?? "may";
    const boundChatSessionId = agent === "may" ? options.getChatSession()?.getSessionId?.() : null;
    if (boundChatSessionId && context.forceNew !== true && source !== "telegram") {
      bus.emit({
        type: "session.steer.requested",
        source,
        owner: normalizeEventOwner(agent),
        data: {
          sessionId: boundChatSessionId,
          message: deliveredMessage,
          ...(Object.keys(context).length ? { context } : {}),
        },
      } as any);
      return;
    }
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
        conversationId: nonEmptyString(conversation.id) ?? undefined,
        requestId: nonEmptyString(data.inputId) ?? undefined,
        forceNew: context.forceNew === true || source === "telegram",
        ...(Object.keys(context).length ? { context } : {}),
      },
    } as any);
  }

  function handleSteer(sessionId: unknown, message: unknown, source?: string, event?: unknown): void {
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
        manager.send(targetSid, steerText, { trace: childEventTrace(event) });
      } else {
        try {
          manager.resumeSession(targetSid, steerText, {
            source: source ?? "human",
            suppressBenignRaceEvent: true,
            trace: childEventTrace(event),
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
      chatSession.handleInput(message, source, childEventTrace(event));
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
      conversationId: nonEmptyString(data.conversationId) ?? undefined,
      channelMessageId: typeof data.channelMessageId === "number" ? data.channelMessageId : undefined,
      trace: childEventTrace(event),
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
        handleSteer(event.sessionId, event.message, event.source, event);
        break;
      }
      case "session.steer.requested": {
        const data = eventData(event);
        handleSteer(data.sessionId, data.message, eventSource(event), event);
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

function appendRecentTelegramContext(
  message: string,
  recent: ReturnType<typeof getRecentTelegramConversationMessages>,
): string {
  if (recent.length === 0) return message;
  const lines = [message, "", "Recent Telegram context (oldest to newest; system-provided)"];
  for (const item of recent) {
    const speaker = item.direction === "inbound" ? "Hao" : item.agent || "May";
    const links = [item.traceId ? `trace=${item.traceId}` : "", item.taskId ? `task=${item.taskId}` : ""]
      .filter(Boolean)
      .join(" ");
    lines.push(`${speaker}${links ? ` [${links}]` : ""}: ${item.text.slice(0, 400)}`);
  }
  lines.push("");
  lines.push(
    "Use reply and trace links before prose similarity. Treat unrelated nearby messages as context, not as the target request.",
  );
  return lines.join("\n");
}
