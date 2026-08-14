import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppInput } from "@may-agent/sdk";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import { getDb } from "../lib/requests.js";
import type { ChatSession } from "./chat-session.js";
import { childEventTrace, EVENT_ROW_ID, type DeliveryResult, type EventBus, type EventTrace } from "./event-bus.js";
import { getTelegramConversationView, type TelegramConversationView } from "../lib/db/notifications.js";
import { isRecord, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";
import {
  admitMayBreakGlassResult,
  admitMayTurnDecision,
  MAY_TURN_INSTRUCTIONS,
  mayBreakGlassResultSchema,
  mayTurnDecisionSchema,
  type MayBreakGlassResult,
  type MayTurnDecision,
} from "./may-turn-contract.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  getChatSession: () => ChatSession | undefined;
  clearCancelLatch: () => void;
  projectRoot: string;
  persistDir?: string;
  /** Uses the live App registry and schema; false keeps the input on its compatibility route. */
  acceptsDirectAppInput?: (appId: string, input: AppInput) => boolean;
  reload: () => void | Promise<void>;
  restart: () => void;
  shutdown: () => void;
}

export interface CommandRouter {
  handleInput: (message: string, source?: string) => void;
  close: () => void;
}

function appInputDelivery(appId: string): DeliveryResult {
  return {
    accepted: true,
    by: `command-router:app:${appId}`,
    route: "direct",
    note: `human input transferred to the durable ${appId} App inbox`,
  };
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

  function eventRowId(event: unknown): number | null {
    if (!isRecord(event)) return null;
    const value = (event as Record<PropertyKey, unknown>)[EVENT_ROW_ID];
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  }

  function routeConversationApp(input: {
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
    return appInputDelivery(input.appId);
  }

  function messageAppInput(message: string, context: Record<string, unknown>): AppInput {
    return {
      kind: "message",
      data: {
        message,
        ...(Object.keys(context).length ? { context } : {}),
      },
    };
  }

  function projectAppId(projectPath: string): string {
    const normalized = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
    const tail = normalized.split("/").filter(Boolean).pop() ?? "";
    return tail.endsWith(".app") ? tail.slice(0, -".app".length) : tail;
  }

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
    try {
      const platform = JSON.parse(
        readFileSync(join(options.projectRoot, "projects/may-agent.app/project.json"), "utf-8"),
      ) as { owner?: unknown };
      if (typeof platform.owner === "string" && platform.owner.trim()) return platform.owner.trim();
    } catch {
      /* the platform convention still has one concrete fallback */
    }
    return "tech-lead";
  }

  function normalizedAppId(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const id = value
      .trim()
      .replace(/^projects\//, "")
      .replace(/\.app$/, "");
    if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
    return existsSync(join(options.projectRoot, "projects", `${id}.app`, "app.ts")) ? id : null;
  }

  function emitMayProjectIntent(input: {
    project: string;
    outcome: string;
    requiredProof: string;
    constraints?: string[];
    sourceEventId: number | null;
    sourceEventType: string;
    trace?: EventTrace;
  }): number | null {
    const requestedProject = normalizedAppId(input.project);
    const project = requestedProject ?? normalizedAppId("may-agent");
    if (!project) return null;
    const projectPath = `projects/${project}.app`;
    const comment = [
      requestedProject
        ? input.outcome
        : `Resolve an ownership gap for requested app ${input.project}: ${input.outcome}`,
      "",
      `Required proof: ${input.requiredProof}`,
      ...(input.constraints?.length ? ["Constraints:", ...input.constraints.map((item) => `- ${item}`)] : []),
    ].join("\n");
    const emitted = bus.emit({
      type: "project.comment.created",
      source: "agent:may",
      owner: normalizeEventOwner(projectOwner(projectPath)),
      target: { project },
      data: {
        project,
        projectId: project,
        projectPath,
        comment,
        author: "may",
        inputEventId: input.sourceEventId ?? undefined,
        inputEventType: input.sourceEventType,
        requestedProject: requestedProject ? undefined : input.project,
      },
      ...(input.trace ? { trace: input.trace } : {}),
    } as any);
    const id = Number(emitted[EVENT_ROW_ID]);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function emitMayTurnFailure(input: {
    sourceEventId: number | null;
    sessionId?: string;
    reason: string;
    trace?: EventTrace;
  }): void {
    bus.emit({
      type: "may.turn.failed",
      source: "handler:may-turn",
      owner: "agent:tech-lead",
      target: { project: "may-agent" },
      data: {
        sourceEventId: input.sourceEventId ?? undefined,
        sessionId: input.sessionId,
        reason: input.reason,
      },
      ...(input.trace ? { trace: input.trace } : {}),
    } as any);
    emitMayProjectIntent({
      project: "may-agent",
      outcome: `Repair or disposition failed May turn${input.sourceEventId ? ` ${input.sourceEventId}` : ""}: ${input.reason}`,
      requiredProof: "The original human message receives one correct disposition and linked response.",
      sourceEventId: input.sourceEventId,
      sourceEventType: "may.turn.failed",
      trace: input.trace,
    });
  }

  function requestBreakGlassReview(input: {
    originalMessage: string;
    result: MayBreakGlassResult;
    sourceEventId: number | null;
    conversationId?: string;
    channelMessageId?: number;
    channel?: string;
    trace?: EventTrace;
  }): void {
    const evidence = input.result.evidence.length
      ? input.result.evidence.map((item) => `- ${item}`).join("\n")
      : "- none";
    const blocker = input.result.disposition === "blocked" ? `\nBlocker: ${input.result.blocker}` : "";
    bus.emit({
      type: "chat.start.requested",
      source: input.channel ?? "human",
      owner: "agent:may",
      data: {
        agent: "may",
        structuredMayTurn: true,
        allowBreakGlass: false,
        humanInputEventId: input.sourceEventId ?? undefined,
        message: [
          "Review one completed break-glass attempt and close or replan the original human request.",
          "Do not start another break-glass attempt from this review.",
          "",
          "Original request",
          input.originalMessage,
          "",
          `Break-glass disposition: ${input.result.disposition}`,
          `Summary: ${input.result.summary}${blocker}`,
          "Evidence:",
          evidence,
        ].join("\n"),
        channel: input.channel ?? "human",
        conversationId: input.conversationId,
        channelMessageId: input.channelMessageId,
        forceNew: true,
      },
      ...(input.trace ? { trace: input.trace } : {}),
    } as any);
  }

  function completeBreakGlass(input: {
    sourceEventId: number | null;
    sessionId: string;
    originalMessage: string;
    conversationId?: string;
    channelMessageId?: number;
    channel?: string;
    trace?: EventTrace;
    result: Awaited<ReturnType<SubagentManager["waitFor"]>>;
  }): void {
    const admitted = admitMayBreakGlassResult(input.result.structuredResult);
    if (input.result.status !== "done" || !admitted.ok) {
      const reason = admitted.ok ? (input.result.error ?? "Break-glass attempt failed") : admitted.error;
      const blocked: MayBreakGlassResult = {
        disposition: "blocked",
        summary: "The break-glass attempt did not produce a valid verified result.",
        evidence: [],
        blocker: reason,
      };
      bus.emit({
        type: "may.break-glass.failed",
        source: "handler:may-turn",
        owner: "agent:may",
        data: { sourceEventId: input.sourceEventId ?? undefined, sessionId: input.sessionId, reason },
        ...(input.trace ? { trace: input.trace } : {}),
      } as any);
      requestBreakGlassReview({ ...input, result: blocked });
      return;
    }

    const result = admitted.value;
    bus.emit({
      type: "may.break-glass.completed",
      source: "handler:may-turn",
      owner: "agent:may",
      data: {
        sourceEventId: input.sourceEventId ?? undefined,
        sessionId: input.sessionId,
        ...result,
      },
      ...(input.trace ? { trace: input.trace } : {}),
    } as any);
    if (result.disposition === "hand-back") {
      const eventId = emitMayProjectIntent({
        project: result.project,
        outcome: result.outcome,
        requiredProof: result.requiredProof,
        sourceEventId: input.sourceEventId,
        sourceEventType: "may.break-glass.completed",
        trace: input.trace,
      });
      if (!eventId) {
        requestBreakGlassReview({
          ...input,
          result: {
            disposition: "blocked",
            summary: result.summary,
            evidence: result.evidence,
            blocker: `Could not hand work back to project ${result.project}`,
          },
        });
      }
      return;
    }
    requestBreakGlassReview({ ...input, result });
  }

  function startBreakGlass(input: {
    decision: Extract<MayTurnDecision, { disposition: "break-glass" }>;
    sourceEventId: number | null;
    sourceSessionId: string;
    originalMessage: string;
    conversationId?: string;
    channelMessageId?: number;
    channel?: string;
    trace?: EventTrace;
  }): void {
    const task = [
      "Execute one bounded May break-glass attempt.",
      "The normal ownership boundary is temporarily open only for the scope below.",
      "Use any necessary available tool, but do not bypass missing human authority, security, credential, approval, or irreversible-change requirements.",
      "Verify the outcome, then close it, hand durable work back to one app, or report the exact blocker.",
      "Do not create a May-owned standing schedule, polling loop, or task tree.",
      "Call finish() with the required structured result.",
      "",
      `Original human request: ${input.originalMessage}`,
      `Reason normal ownership is insufficient: ${input.decision.reason}`,
      `Temporary scope: ${input.decision.scope}`,
      `Required terminal proof: ${input.decision.terminalProof}`,
      `Stop or hand-back condition: ${input.decision.stopCondition}`,
    ].join("\n");
    const sessionId = manager.run("may", task, {
      kind: "job",
      source: "may-break-glass",
      requestId: `may-break-glass:${input.sourceEventId ?? input.sourceSessionId}`,
      conversationId: input.conversationId,
      channelMessageId: input.channelMessageId,
      trace: input.trace,
      requireFinish: true,
      outputSchema: mayBreakGlassResultSchema,
      toolPolicy: "full",
    });
    bus.emit({
      type: "may.break-glass.started",
      source: "handler:may-turn",
      owner: "agent:may",
      data: {
        sourceEventId: input.sourceEventId ?? undefined,
        sourceSessionId: input.sourceSessionId,
        sessionId,
        reason: input.decision.reason,
        scope: input.decision.scope,
        terminalProof: input.decision.terminalProof,
        stopCondition: input.decision.stopCondition,
      },
      ...(input.trace ? { trace: input.trace } : {}),
    } as any);
    void manager
      .waitFor(sessionId)
      .then((result) => completeBreakGlass({ ...input, sessionId, result }))
      .catch((error) =>
        completeBreakGlass({
          ...input,
          sessionId,
          result: {
            sessionId,
            status: "error",
            lastAssistantText: null,
            messages: [],
            duration: "0ms",
            outputDir: "",
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
  }

  function completeStructuredMayTurn(input: {
    sourceEventId: number | null;
    sessionId: string;
    originalMessage: string;
    conversationId?: string;
    channelMessageId?: number;
    channel?: string;
    allowBreakGlass: boolean;
    trace?: EventTrace;
    result: Awaited<ReturnType<SubagentManager["waitFor"]>>;
  }): void {
    const admitted = admitMayTurnDecision(input.result.structuredResult);
    if (input.result.status !== "done" || !admitted.ok) {
      emitMayTurnFailure({
        sourceEventId: input.sourceEventId,
        sessionId: input.sessionId,
        reason: admitted.ok ? (input.result.error ?? "May turn failed") : admitted.error,
        trace: input.trace,
      });
      return;
    }
    const decision = admitted.value;
    let projectIntentEventId: number | null = null;
    if (decision.disposition === "route") {
      projectIntentEventId = emitMayProjectIntent({
        project: decision.project,
        outcome: decision.outcome,
        requiredProof: decision.requiredProof,
        constraints: decision.constraints,
        sourceEventId: input.sourceEventId,
        sourceEventType: "human.input.received",
        trace: input.trace,
      });
      if (!projectIntentEventId) {
        emitMayTurnFailure({
          sourceEventId: input.sourceEventId,
          sessionId: input.sessionId,
          reason: `May selected route but no valid app route exists for ${decision.project}`,
          trace: input.trace,
        });
        return;
      }
    } else if (decision.disposition === "break-glass") {
      if (!input.allowBreakGlass) {
        emitMayTurnFailure({
          sourceEventId: input.sourceEventId,
          sessionId: input.sessionId,
          reason: "A break-glass review attempted to open another break-glass attempt",
          trace: input.trace,
        });
        return;
      }
      startBreakGlass({ ...input, sourceSessionId: input.sessionId, decision });
    }
    bus.emit({
      type: "may.turn.completed",
      source: "handler:may-turn",
      owner: "agent:may",
      data: {
        sourceEventId: input.sourceEventId ?? undefined,
        sessionId: input.sessionId,
        disposition: decision.disposition,
        ...(decision.disposition === "route"
          ? { acceptance: "pending", projectIntentEventId: projectIntentEventId ?? undefined }
          : {}),
      },
      ...(input.trace ? { trace: input.trace } : {}),
    } as any);
  }

  function startStructuredMayTurn(
    event: unknown,
    data: Record<string, unknown>,
    message: string,
    source: string,
  ): void {
    const sourceEventId = integerField(data, "humanInputEventId") ?? eventRowId(event);
    const allowBreakGlass = data.allowBreakGlass !== false;
    const task = [
      MAY_TURN_INSTRUCTIONS,
      ...(allowBreakGlass ? [] : ["This is a review turn. Do not choose break-glass again."]),
      "",
      "Human turn",
      message,
    ].join("\n");
    const conversationId = nonEmptyString(data.conversationId) ?? undefined;
    const channelMessageId = typeof data.channelMessageId === "number" ? data.channelMessageId : undefined;
    const trace = childEventTrace(event);
    const sessionId = manager.run("may", task, {
      kind: "job",
      source,
      requestId: `may-turn:${sourceEventId ?? Date.now()}`,
      conversationId,
      channelMessageId,
      trace,
      requireFinish: true,
      outputSchema: mayTurnDecisionSchema,
      toolPolicy: "deputy",
    });
    bus.emit({
      type: "may.turn.started",
      source: "handler:may-turn",
      owner: "agent:may",
      data: { sourceEventId: sourceEventId ?? undefined, sessionId },
      ...(trace ? { trace } : {}),
    } as any);
    void manager
      .waitFor(sessionId)
      .then((result) =>
        completeStructuredMayTurn({
          sourceEventId,
          sessionId,
          originalMessage: message,
          conversationId,
          channelMessageId,
          channel: nonEmptyString(data.channel) ?? source,
          allowBreakGlass,
          trace,
          result,
        }),
      )
      .catch((error) =>
        emitMayTurnFailure({
          sourceEventId,
          sessionId,
          reason: error instanceof Error ? error.message : String(error),
          trace,
        }),
      );
  }

  function recoverOpenBreakGlassAttempts(): void {
    if (!options.persistDir) return;
    const db = getDb(options.persistDir);
    const rows = db
      .prepare(
        `SELECT p.open_event_id, e.data
         FROM event_pair_runs p
         JOIN events e ON e.id = p.open_event_id
         WHERE p.pair_name = 'may.break-glass'
           AND p.status IN ('open', 'orphan')
         ORDER BY p.open_event_id`,
      )
      .all() as Array<{ open_event_id?: unknown; data?: unknown }>;
    for (const row of rows) {
      let started: Record<string, unknown> = {};
      try {
        const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        if (isRecord(parsed)) started = parsed;
      } catch {
        /* preserve recovery even when old evidence is incomplete */
      }
      const sessionId = nonEmptyString(started.sessionId);
      if (!sessionId) continue;
      const sourceEventId = integerField(started, "sourceEventId");
      let originalMessage = "The original human request could not be reconstructed after the runtime restarted.";
      let channel = "human";
      let conversationId: string | undefined;
      let channelMessageId: number | undefined;
      if (sourceEventId) {
        const sourceRow = db.prepare("SELECT source, data FROM events WHERE id = ?").get(sourceEventId) as
          { source?: unknown; data?: unknown } | undefined;
        try {
          const parsed = typeof sourceRow?.data === "string" ? JSON.parse(sourceRow.data) : sourceRow?.data;
          if (isRecord(parsed)) {
            originalMessage = nonEmptyString(parsed.text) ?? nonEmptyString(parsed.message) ?? originalMessage;
            const conversation = isRecord(parsed.conversation) ? parsed.conversation : {};
            conversationId = nonEmptyString(conversation.id) ?? nonEmptyString(parsed.conversationId) ?? undefined;
            channelMessageId =
              integerField(conversation, "channelMessageId") ?? integerField(parsed, "channelMessageId") ?? undefined;
            channel =
              nonEmptyString(conversation.channel) ??
              nonEmptyString(parsed.channel) ??
              nonEmptyString(sourceRow?.source) ??
              channel;
          }
        } catch {
          /* the failed event below still closes the privileged attempt */
        }
      }
      const reason = "runtime-restarted";
      bus.emit({
        type: "may.break-glass.failed",
        source: "handler:may-turn",
        owner: "agent:may",
        data: { sourceEventId: sourceEventId ?? undefined, sessionId, reason },
      } as any);
      requestBreakGlassReview({
        originalMessage,
        result: {
          disposition: "blocked",
          summary: "The runtime restarted before the break-glass attempt reached a verified result.",
          evidence: [],
          blocker: reason,
        },
        sourceEventId,
        conversationId,
        channelMessageId,
        channel,
      });
    }
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

  function handleHumanInput(event: unknown): DeliveryResult | void {
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
        const reply = telegramReplyContext(context);
        deliveredMessage = appendTelegramConversationView(
          deliveredMessage,
          getTelegramConversationView(options.persistDir, {
            conversationId,
            traceId: stringField(reply, "traceId") ?? undefined,
            taskId: stringField(reply, "taskId") ?? undefined,
            projectId: stringField(reply, "projectId") ?? undefined,
          }),
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
    if (targetSessionId && !mayBrokerReply && explicitSessionControl) {
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
      const appInput = messageAppInput(deliveredMessage, context);
      if (options.acceptsDirectAppInput?.("may", appInput)) {
        return routeConversationApp({
          appId: "may",
          appInput,
          event,
          data,
          source,
          conversation,
        });
      }
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
          structuredMayTurn: true,
          humanInputEventId: eventRowId(event) ?? undefined,
          ...(Object.keys(context).length ? { context } : {}),
        },
      } as any);
      return;
    }

    const targetProjectPath = nonEmptyString(target.projectPath);
    if (targetProjectPath) {
      const targetAppId = projectAppId(targetProjectPath);
      const appInput = messageAppInput(message, context);
      if (targetAppId && options.acceptsDirectAppInput?.(targetAppId, appInput)) {
        return routeConversationApp({
          appId: targetAppId,
          appInput,
          event,
          data,
          source,
          conversation,
        });
      }
      bus.emit({
        type: "project.comment.created",
        source,
        owner: eventOwner,
        data: { projectPath: targetProjectPath, comment: message, author: nonEmptyString(data.actor) ?? "human" },
      } as any);
      return;
    }

    const agent = nonEmptyString(target.agent) ?? ownerAgent(eventOwner) ?? "may";
    const mayAppInput = messageAppInput(deliveredMessage, context);
    if (agent === "may" && options.acceptsDirectAppInput?.("may", mayAppInput)) {
      return routeConversationApp({
        appId: "may",
        appInput: mayAppInput,
        event,
        data,
        source,
        conversation,
      });
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
        structuredMayTurn: agent === "may",
        humanInputEventId: eventRowId(event) ?? undefined,
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
    if (agent === "may" && data.structuredMayTurn !== true) {
      bus.emit({
        type: "human.input.received",
        source,
        owner: "agent:may",
        data: {
          actor: "human",
          text: message,
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
      return;
    }
    if (agent === "may") {
      startStructuredMayTurn(event, data, message, source);
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
    if (event.agent === "may") {
      bus.emit({
        type: "human.input.received",
        source: event.opts?.source || "socket",
        owner: "agent:may",
        data: {
          actor: "human",
          text: event.task,
          conversation: { channel: event.opts?.source || "socket" },
          target: { agent: "may" },
        },
      } as any);
      return;
    }
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
    const sessionId = manager.run(event.agent, event.task, {
      kind: (event.opts?.kind as "chat" | "job" | "call" | undefined) ?? "job",
      requestId: event.opts?.requestId,
    });
    log("info", `[fork] Started ${event.agent} session: ${sessionId}`);
  }

  const unsubscribe = bus.subscribe((event) => {
    switch (event.type) {
      case "input":
        if (typeof event.message !== "string") break;
        handleInput(event.message, event.source);
        break;
      case "human.input.received":
        return handleHumanInput(event);
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

  queueMicrotask(() => {
    recoverOpenBreakGlassAttempts();
  });

  return { handleInput, close: unsubscribe };
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
      const detail = [event.type, event.status, event.summary].filter(Boolean).join(" — ");
      lines.push(`Evidence #${event.eventId}: ${detail}`);
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
  lines.push("");
  lines.push(
    "Use the focused trace/task before prose similarity. Treat unrelated nearby messages as context, not as the target request. If several consequential requests still fit, state the likely interpretation and ask one focused question.",
  );
  return lines.join("\n");
}
