import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppInput } from "@may-agent/sdk";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import { getTelegramConversationView, type TelegramConversationView } from "../lib/db/notifications.js";
import { isRecord, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";
import { childEventTrace, EVENT_ROW_ID, type DeliveryResult, type EventBus } from "./event-bus.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  clearCancelLatch: () => void;
  projectRoot: string;
  persistDir?: string;
  /** Uses the live App registry and schema. */
  acceptsAppInput?: (appId: string, input: AppInput) => boolean;
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
  const value = nonEmptyString(owner);
  return value?.startsWith("agent:") ? value.slice("agent:".length) : value;
}

function objectField(value: unknown, key: string): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function stringField(value: unknown, key: string): string | null {
  return isRecord(value) ? nonEmptyString(value[key]) : null;
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

function approvalReplyContext(context: Record<string, unknown>): Record<string, unknown> | null {
  const reply = telegramReplyContext(context);
  if (!reply) return null;
  const issue = objectField(reply, "originalIssue");
  if (stringField(issue, "eventType") === "project.approval.requested") return reply;
  return stringList(reply.expectedClosure).includes("project.approval.submitted") ? reply : null;
}

function isBrokerReply(context: Record<string, unknown>): boolean {
  const reply = telegramReplyContext(context);
  if (!reply) return false;
  const issue = objectField(reply, "originalIssue");
  return (
    stringField(issue, "eventType") === "escalation.created" ||
    stringList(reply.expectedClosure).some((type) =>
      ["escalation.resolved", "escalation.dismissed", "project.approval.submitted"].includes(type),
    )
  );
}

type ApprovalDecision = "approve" | "adjust" | "hold" | "decline" | "reroute";

function parseExplicitApprovalDecision(message: string): ApprovalDecision | null {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized || /[?？]/.test(normalized)) return null;
  const exact: Record<string, ApprovalDecision> = {
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
  const direct = exact[normalized.replace(/[.!]+$/, "")];
  if (direct) return direct;
  if (/^adjust(?:\s*:\s*|\s+)\S.+$/.test(normalized)) return "adjust";
  if (/^(?:reroute|re-route)(?:\s*:\s*|\s+(?:to\s+)?)\S.+$/.test(normalized)) return "reroute";
  return null;
}

function deliveredHumanMessage(message: string, context: Record<string, unknown>): string {
  const reply = telegramReplyContext(context);
  if (!reply) return message;
  const issue = objectField(reply, "originalIssue");
  const notification = objectField(reply, "notification");
  const lines = ["May reply-handling work item", "", "Human reply", message, "", "Attached context"];
  const fields: Array<[string, string | null]> = [
    ["Conversation", stringField(reply, "conversationId")],
    ["Request trace", stringField(reply, "traceId")],
    ["Owner task", stringField(reply, "taskId")],
    ["Original issue", stringField(issue, "eventType") ?? stringField(reply, "eventType")],
    ["Escalation", stringField(issue, "escalationId") ?? stringField(reply, "escalationId")],
    [
      "Project",
      stringField(issue, "projectPath") ?? stringField(reply, "projectId") ?? stringField(issue, "targetProject"),
    ],
    ["Source session", stringField(issue, "sourceSessionId") ?? stringField(reply, "sessionId")],
    [
      "Reason",
      stringField(issue, "reason") ?? stringField(notification, "reason") ?? stringField(notification, "summary"),
    ],
    [
      "Original ask",
      stringField(issue, "requestedAction") ??
        stringField(notification, "requestedAction") ??
        stringField(notification, "requestedHumanAction"),
    ],
  ];
  for (const [label, value] of fields) if (value) lines.push(`${label}: ${value}`);
  const visible = stringField(notification, "text");
  if (visible) lines.push(`Visible notification: ${visible.slice(0, 800)}`);
  const closures = stringList(reply.expectedClosure);
  if (closures.length) lines.push(`Expected closure: ${closures.join(", ")}`);
  lines.push(
    "",
    "Understand the human's intention before applying consequential state. Questions and uncertain replies are not approvals.",
    "Use the attached durable identity, answer supported questions, and ask one focused clarification when intent remains uncertain.",
  );
  return lines.join("\n");
}

function appendTelegramConversationView(message: string, view: TelegramConversationView): string {
  if (!view.focus && view.recentMessages.length === 0) return message;
  const lines = [message];
  if (view.focus) {
    lines.push("", "Focused request (system-provided durable view)");
    if (view.focus.traceId) lines.push(`Trace: ${view.focus.traceId}`);
    if (view.focus.taskId) lines.push(`Owner task: ${view.focus.taskId}`);
    if (view.focus.projectId) lines.push(`Project: ${view.focus.projectId}`);
    if (view.focus.owner) lines.push(`Current owner: ${view.focus.owner}`);
    if (view.focus.status) lines.push(`Current state: ${view.focus.status}`);
    for (const event of view.focus.events.slice(-6)) {
      lines.push(
        `Evidence #${event.eventId}: ${[event.type, event.status, event.summary].filter(Boolean).join(" — ")}`,
      );
    }
  }
  if (view.recentMessages.length) lines.push("", "Recent Telegram context (oldest to newest; system-provided)");
  for (const item of view.recentMessages) {
    const speaker = item.direction === "inbound" ? "Hao" : item.agent || "May";
    const links = [item.traceId ? `trace=${item.traceId}` : "", item.taskId ? `task=${item.taskId}` : ""]
      .filter(Boolean)
      .join(" ");
    lines.push(`${speaker}${links ? ` [${links}]` : ""}: ${item.text.slice(0, 400)}`);
  }
  return lines.join("\n");
}

/** Normalize external input, apply deterministic controls, and admit semantic work to an App. */
export function attachCommandRouter(options: CommandRouterOptions): CommandRouter {
  const { bus, manager } = options;
  const acceptsAppInput = options.acceptsAppInput ?? (() => false);

  const accepted = (control: string, note = "input handled by an explicit runtime route"): DeliveryResult => ({
    accepted: true,
    by: `command-router:${control}`,
    route: "direct",
    note,
  });

  const eventRowId = (event: unknown): number | null => {
    if (!isRecord(event)) return null;
    const value = (event as Record<PropertyKey, unknown>)[EVENT_ROW_ID];
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  };

  function messageInput(message: string, context: Record<string, unknown>): AppInput {
    return { kind: "message", data: { message, ...(Object.keys(context).length ? { context } : {}) } };
  }

  function routeApp(input: {
    appId: string;
    appInput: AppInput;
    event: unknown;
    data: Record<string, unknown>;
    source: string;
    conversation: Record<string, unknown>;
  }): DeliveryResult {
    const sourceEventId = eventRowId(input.event);
    const channel = nonEmptyString(input.conversation.channel) ?? input.source;
    const channelMessageId = integerField(input.conversation, "channelMessageId") ?? undefined;
    const sequence = sourceEventId ?? channelMessageId ?? Date.now();
    const conversationId =
      nonEmptyString(input.conversation.id) ?? `${channel}:${nonEmptyString(input.data.actor) ?? "human"}`;
    bus.emit({
      type: "app.input.requested",
      source: input.source,
      owner: `app:${input.appId}`,
      data: {
        appId: input.appId,
        source: { kind: "human", id: sourceEventId ? `event:${sourceEventId}` : `channel:${channel}:${sequence}` },
        input: input.appInput,
        conversationId,
        conversationSequence: sequence,
        channel,
        channelThreadId: nonEmptyString(input.conversation.channelThreadId) ?? undefined,
        channelMessageId,
        idempotencyKey:
          nonEmptyString(input.data.inputId) ??
          (sourceEventId ? `human-input:${sourceEventId}` : `human-input:${channel}:${sequence}`),
      },
    } as any);
    return accepted(`app:${input.appId}`, `human input transferred to the durable ${input.appId} App inbox`);
  }

  function normalizeProjectPath(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    let path = value
      .trim()
      .replace(/^\/app\//, "")
      .replace(new RegExp(`^${options.projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`), "")
      .replace(/^\.?\//, "")
      .replace(/\/project\.md$/, "")
      .replace(/[),.;:]+$/, "")
      .replace(/\/$/, "")
      .replace(/^agents\/shared\/projects\//, "projects/")
      .replace(/^shared\/projects\//, "projects/");
    if (/^projects\/[^/\s]+$/.test(path)) return path;
    if (!path.startsWith("agents/")) path = `agents/${path}`;
    return /^agents\/[^/]+\/workspace\/projects\/[^/\s]+$/.test(path) ? path : null;
  }

  function projectOwner(projectPath: string, fallback = "tech-lead"): string {
    try {
      const parsed = JSON.parse(readFileSync(join(options.projectRoot, projectPath, "project.json"), "utf8")) as {
        owner?: unknown;
      };
      if (nonEmptyString(parsed.owner)) return nonEmptyString(parsed.owner)!;
    } catch {}
    try {
      const content = readFileSync(join(options.projectRoot, projectPath, "project.md"), "utf8");
      const match = content.match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m);
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
    return fallback;
  }

  function appendProjectDiscussion(projectPath: unknown, comment: unknown, source?: string, author?: string): void {
    const normalized = normalizeProjectPath(projectPath);
    const text = nonEmptyString(comment);
    if (!normalized || !text) return;
    const appPath = normalized.endsWith(".app") ? normalized : `${normalized}.app`;
    if (existsSync(join(options.projectRoot, appPath, "app.ts"))) return;
    const projectFile = join(options.projectRoot, normalized, "project.md");
    if (!existsSync(projectFile)) return;
    const discussionFile = join(options.projectRoot, normalized, "discussion.md");
    const entry = `\n### ${author?.trim() || "hao"} - ${new Date().toISOString().slice(0, 10)}\n${text}\n`;
    if (existsSync(discussionFile)) appendFileSync(discussionFile, entry, "utf8");
    else writeFileSync(discussionFile, `# Discussion\n\n---read @iter0---\n${entry}`, "utf8");
    let content = readFileSync(projectFile, "utf8");
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatter && /^status:\s*(blocked|waiting|paused|pending-review)\s*$/im.test(frontmatter[1])) {
      content = content.replace(
        frontmatter[0],
        `---\n${frontmatter[1].replace(/^status:\s*.+$/im, "status: active")}\n---`,
      );
      writeFileSync(projectFile, content, "utf8");
    }
    bus.emit({
      type: "project.nudge",
      source: source ?? "command-router",
      owner: normalizeEventOwner(projectOwner(normalized)),
      data: { projectPath: normalized, comment: true, commentText: text },
    } as any);
  }

  function submitApproval(
    event: unknown,
    data: Record<string, unknown>,
    message: string,
    context: Record<string, unknown>,
    source: string,
  ): DeliveryResult | null {
    const reply = approvalReplyContext(context);
    const decision = reply ? parseExplicitApprovalDecision(message) : null;
    if (!reply || !decision) return null;
    const issue = objectField(reply, "originalIssue");
    const expected = objectField(issue, "expectedResponse");
    const target = objectField(expected, "target");
    const projectPath =
      normalizeProjectPath(objectField(data, "target")?.projectPath) ??
      normalizeProjectPath(stringField(issue, "projectPath")) ??
      normalizeProjectPath(stringField(reply, "projectId")) ??
      normalizeProjectPath(stringField(issue, "targetProject"));
    bus.emit({
      type: "project.approval.submitted",
      source,
      owner: normalizeEventOwner(
        projectPath
          ? projectOwner(projectPath, ownerAgent(isRecord(event) ? event.owner : null) ?? "may")
          : (stringField(reply, "agent") ?? ownerAgent(isRecord(event) ? event.owner : null) ?? "may"),
      ),
      ...(target ? { target } : {}),
      data: {
        approvalKind:
          stringField(issue, "approvalKind") ?? stringField(reply, "approvalKind") ?? "approval-packet-dispatch",
        approvalId: stringField(issue, "approvalId") ?? stringField(expected, "approvalId") ?? undefined,
        waitId: stringField(issue, "waitId") ?? stringField(expected, "waitId") ?? undefined,
        pathId: stringField(issue, "pathId") ?? stringField(expected, "pathId") ?? undefined,
        packetPath: stringField(issue, "packetPath") ?? undefined,
        taskId: stringField(issue, "taskId") ?? stringField(expected, "taskId") ?? undefined,
        taskGeneration: integerField(issue, "taskGeneration") ?? integerField(expected, "taskGeneration") ?? undefined,
        artifactFingerprint:
          stringField(issue, "artifactFingerprint") ?? stringField(expected, "artifactFingerprint") ?? undefined,
        projectPath: projectPath ?? undefined,
        projectId: projectPath ?? undefined,
        targetProject: stringField(issue, "targetProject") ?? undefined,
        decision,
        message,
        conversationId: stringField(reply, "conversationId") ?? undefined,
      },
      trace: childEventTrace(event),
    } as any);
    return accepted("approval");
  }

  function handleHumanInput(event: unknown): DeliveryResult | void {
    options.clearCancelLatch();
    const data = eventData(event);
    const message = nonEmptyString(data.text) ?? nonEmptyString(data.message);
    if (!message) return;
    const conversation = isRecord(data.conversation) ? data.conversation : {};
    const target = isRecord(data.target) ? data.target : {};
    const context = isRecord(data.context) ? data.context : {};
    const source = eventSource(event, nonEmptyString(conversation.channel) ?? "human");
    const eventOwner = isRecord(event) ? event.owner : "agent:may";
    let delivered = deliveredHumanMessage(message, context);
    if (source === "telegram" && options.persistDir && nonEmptyString(conversation.id)) {
      const reply = telegramReplyContext(context);
      delivered = appendTelegramConversationView(
        delivered,
        getTelegramConversationView(options.persistDir, {
          conversationId: nonEmptyString(conversation.id)!,
          traceId: stringField(reply, "traceId") ?? undefined,
          taskId: stringField(reply, "taskId") ?? undefined,
          projectId: stringField(reply, "projectId") ?? undefined,
        }),
      );
    }

    const approval = submitApproval(event, data, message, context, source);
    if (approval) return approval;

    const sessionId = nonEmptyString(target.sessionId);
    const lower = message.toLowerCase();
    if (lower === "cancel") {
      if (sessionId) {
        bus.emit({ type: "session.cancel.requested", source, owner: String(eventOwner), data: { sessionId } } as any);
      } else {
        bus.emit({
          type: "human.input.rejected",
          source: "command-router",
          owner: String(eventOwner),
          data: { reason: "cancel requires an explicit session target", input: message },
        } as any);
      }
      return accepted(sessionId ? "session-cancel" : "session-cancel-rejected");
    }
    if (lower === "cancel all") {
      bus.emit({ type: "session.cancel_all.requested", source, owner: "agent:may", data: {} } as any);
      return accepted("session-cancel-all");
    }
    if (["reload", "restart", "close"].includes(lower)) {
      const type =
        lower === "reload"
          ? "runtime.reload.requested"
          : lower === "restart"
            ? "runtime.restart.requested"
            : "runtime.shutdown.requested";
      bus.emit({ type, source, owner: "agent:may", data: { reason: `human requested ${lower}` } } as any);
      return accepted(`runtime-${lower}`);
    }
    const brokerReply = isBrokerReply(context);
    if (sessionId && context.explicitSessionControl === true && !brokerReply) {
      bus.emit({
        type: "session.steer.requested",
        source,
        owner: String(eventOwner),
        data: { sessionId, message: delivered, context },
      } as any);
      return accepted("session-steer");
    }

    const projectPath = nonEmptyString(target.projectPath);
    if (projectPath && !brokerReply) {
      const tail = projectPath.replace(/\\/g, "/").replace(/\/$/, "").split("/").pop() ?? "";
      const appId = tail.replace(/\.app$/, "");
      const appInput = messageInput(message, context);
      if (appId && acceptsAppInput(appId, appInput)) {
        return routeApp({ appId, appInput, event, data, source, conversation });
      }
      bus.emit({
        type: "project.comment.created",
        source,
        owner: String(eventOwner),
        data: { projectPath, comment: message, author: nonEmptyString(data.actor) ?? "human" },
      } as any);
      return accepted("project-comment");
    }

    const agent = brokerReply ? "may" : (nonEmptyString(target.agent) ?? ownerAgent(eventOwner) ?? "may");
    if (agent === "may") {
      const appInput = messageInput(delivered, context);
      if (acceptsAppInput("may", appInput)) {
        return routeApp({ appId: "may", appInput, event, data, source, conversation });
      }
      bus.emit({
        type: "human.input.rejected",
        source: "command-router",
        owner: "app:may",
        data: { reason: "May App is not registered", input: message },
      } as any);
      return accepted("app:may-unavailable");
    }

    bus.emit({
      type: "chat.start.requested",
      source,
      owner: normalizeEventOwner(agent),
      data: {
        agent,
        message: delivered,
        channel: nonEmptyString(conversation.channel) ?? source,
        conversationId: nonEmptyString(conversation.id) ?? undefined,
        requestId: nonEmptyString(data.inputId) ?? undefined,
      },
    } as any);
    return accepted(`agent:${agent}`);
  }

  function handleSteer(sessionId: unknown, message: unknown, source?: string, event?: unknown): void {
    const id = nonEmptyString(sessionId);
    const text = nonEmptyString(message);
    if (!id || !text) return;
    try {
      if (manager.status().some((session) => session.sessionId === id)) {
        manager.send(id, text, { trace: childEventTrace(event) });
      } else {
        manager.resumeSession(id, text, {
          source: source ?? "human",
          suppressBenignRaceEvent: true,
          trace: childEventTrace(event),
        });
      }
    } catch (error) {
      log("warn", `[steer] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleChatStart(event: unknown): DeliveryResult | void {
    const data = eventData(event);
    const message = nonEmptyString(data.message);
    if (!message) return;
    const agent = nonEmptyString(data.agent) ?? "may";
    const source = eventSource(event, nonEmptyString(data.channel) ?? "human");
    if (agent === "may") {
      bus.emit({
        type: "human.input.received",
        source,
        owner: "agent:may",
        data: {
          actor: "human",
          text: message,
          inputId: nonEmptyString(data.requestId) ?? undefined,
          conversation: {
            id: nonEmptyString(data.conversationId) ?? undefined,
            channel: nonEmptyString(data.channel) ?? source,
            channelThreadId: nonEmptyString(data.channelThreadId) ?? undefined,
            channelMessageId: integerField(data, "channelMessageId") ?? undefined,
          },
          target: { agent: "may" },
          ...(isRecord(data.context) ? { context: data.context } : {}),
        },
      } as any);
      return accepted("may-input-normalized");
    }
    bus.emit({
      type: "message.created",
      source,
      owner: normalizeEventOwner(agent),
      data: { from: source, to: agent, content: message, intent: "chat.start", priority: "P0" },
    } as any);
    const sessionId = manager.run(agent, message, {
      kind: "chat",
      autoClose: "never",
      source,
      requestId: nonEmptyString(data.requestId) ?? undefined,
      conversationId: nonEmptyString(data.conversationId) ?? undefined,
      channelMessageId: integerField(data, "channelMessageId") ?? undefined,
      trace: childEventTrace(event),
    });
    log("info", `[chat.start] Started ${agent} chat session: ${sessionId}`);
    return accepted(`agent:${agent}`);
  }

  function handleFork(event: any): DeliveryResult | void {
    if (typeof event.agent !== "string" || typeof event.task !== "string") return;
    if (event.agent === "may") {
      handleInput(event.task, event.opts?.source ?? "socket");
      return accepted("may-input-normalized");
    }
    bus.emit({
      type: "message.created",
      source: event.opts?.source ?? "socket",
      owner: normalizeEventOwner(event.agent),
      data: {
        from: event.opts?.source ?? "socket",
        to: event.agent,
        content: event.task,
        intent: "fork",
        priority: "P0",
      },
    } as any);
    manager.run(event.agent, event.task, {
      kind: event.opts?.kind ?? "job",
      requestId: event.opts?.requestId,
    });
    return accepted(`agent:${event.agent}`);
  }

  function handleInput(message: string, source?: string): void {
    const text = message.trim();
    if (!text) return;
    const channel = source ?? "human";
    bus.emit({
      type: "human.input.received",
      source: channel,
      owner: "agent:may",
      data: { actor: "human", text, conversation: { channel }, target: { agent: "may" } },
    } as any);
  }

  const unsubscribe = bus.subscribe((event) => {
    switch (event.type) {
      case "input":
        if (typeof event.message === "string") handleInput(event.message, event.source);
        return accepted("human-input-normalized");
      case "human.input.received":
        return handleHumanInput(event);
      case "steer":
        handleSteer(event.sessionId, event.message, event.source, event);
        return accepted("session-steer");
      case "session.steer.requested": {
        const data = eventData(event);
        handleSteer(data.sessionId, data.message, eventSource(event), event);
        return accepted("session-steer");
      }
      case "chat.start.requested":
        return handleChatStart(event);
      case "cancel":
        if (event.sessionId) manager.cancel(event.sessionId);
        return accepted("session-cancel");
      case "session.cancel.requested": {
        const id = nonEmptyString(eventData(event).sessionId);
        if (id) manager.cancel(id);
        return accepted("session-cancel");
      }
      case "cancel_all":
      case "session.cancel_all.requested":
        for (const session of manager.status()) if (session.status === "running") manager.cancel(session.sessionId);
        return accepted("session-cancel-all");
      case "project.comment.created": {
        const data = eventData(event);
        appendProjectDiscussion(
          data.projectPath,
          data.comment,
          eventSource(event),
          nonEmptyString(data.author) ?? undefined,
        );
        break;
      }
      case "fork":
        return handleFork(event);
      case "reload":
      case "runtime.reload.requested":
        void options.reload();
        return accepted("runtime-reload");
      case "restart":
      case "runtime.restart.requested":
        options.restart();
        return accepted("runtime-restart");
      case "shutdown":
      case "runtime.shutdown.requested":
        options.shutdown();
        return accepted("runtime-shutdown");
    }
  });

  return { handleInput, close: unsubscribe };
}
