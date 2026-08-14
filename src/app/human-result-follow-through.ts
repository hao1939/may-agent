import { EVENT_ROW_ID, eventData, type AgentEvent, type EventBus, type EventTrace } from "./event-bus.js";
import { getDb } from "../lib/db/connection.js";
import {
  getLatestInboundNotificationMessage,
  getTelegramConversationView,
  type TelegramConversationView,
} from "../lib/db/notifications.js";
import type { RunOptions } from "../lib/manager.js";
import { hasAppInboxWait } from "./app-inbox-store.js";

type ReviewManager = {
  activeSessions: { has: (sessionId: string) => boolean };
  run: (agent: string, task: string, opts?: RunOptions) => string;
};

export type HumanResultFollowThroughOptions = {
  bus: EventBus;
  manager: ReviewManager;
  persistDir: string;
  interfaceAgent?: string;
  admitAppReview?: (input: HumanResultAppReview) => boolean;
};

export type HumanResultAppReview = {
  appId: string;
  source: { kind: "human"; id: string };
  input: {
    kind: "message";
    data: {
      message: string;
      context: {
        compatibility: "legacy-human-result";
        eventType: string;
        requestId: string;
        traceId: string;
        taskId?: string;
        projectId?: string;
      };
    };
  };
  conversationId: string;
  conversationSequence: number;
  channel: "telegram";
  channelThreadId?: string;
  channelMessageId: number;
  idempotencyKey: string;
  trace: EventTrace;
};

const CLI_TERMINAL_EVENTS = new Set(["cli.task.completed", "cli.task.failed", "cli.task.orphaned"]);
const PROJECT_TERMINAL_DISPOSITIONS = new Set(["converged", "attention"]);
const PROJECT_DIRECT_DISPOSITIONS = new Set(["answered", "rejected", "no-op"]);
const CONDITION_REVIEW_REASON = "condition-review-checkpoint-missed";

/**
 * Drain pre-App human-result links through the conversation App. The old
 * direct session launch remains only for startup and modes without an App
 * host; once historical links drain, this entire adapter can be removed.
 */
export function attachHumanResultFollowThrough(opts: HumanResultFollowThroughOptions): () => void {
  const interfaceAgent = opts.interfaceAgent?.trim() || "may";
  const interfaceOwner = `agent:${interfaceAgent}`;
  const conversationAppId = "may";
  const startedRequestIds = new Set<string>();

  return opts.bus.subscribe((event) => {
    const eventType = String((event as unknown as { type?: unknown }).type ?? "");
    if (eventType === "project.owner.reviewed") {
      const data = eventData(event);
      const taskRefs = Array.isArray(data.taskRefs) ? data.taskRefs : [];
      const disposition = nonEmptyString(data.disposition);
      if (taskRefs.length > 0 || !disposition || !PROJECT_DIRECT_DISPOSITIONS.has(disposition)) return;

      const eventId = positiveInteger((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
      const trace = event.trace ?? readPersistedTrace(opts.persistDir, eventId);
      if (!trace?.traceId) return;
      const inbound = getLatestInboundNotificationMessage(opts.persistDir, trace.traceId);
      if (!inbound) return;
      const inboundData = parseRecord(inbound.data);
      const conversationId = nonEmptyString(inboundData?.conversationId);
      const humanText = nonEmptyString(inboundData?.text);
      if (!conversationId || !humanText) return;
      const projectId = nonEmptyString(data.projectId) ?? nonEmptyString(data.project);
      const openEventId = positiveInteger(data.openEventId) ?? eventId;
      const requestId = `human-result-review:project:${projectId ?? "unknown"}:owner:${openEventId ?? "current"}`;
      if (startedRequestIds.has(requestId) || hasReviewWork(opts.persistDir, conversationAppId, requestId)) {
        return {
          accepted: true as const,
          by: "human-result-follow-through",
          route: "direct" as const,
          note: "existing May direct owner-result review reused",
        };
      }
      const conversationView = getTelegramConversationView(opts.persistDir, {
        conversationId,
        traceId: trace.traceId,
        projectId,
      });
      const prompt = buildDirectProjectReviewPrompt({
        data,
        humanText,
        conversationId,
        replyToMessageId: inbound.telegram_msg_id,
        conversationView,
      });
      const reviewTrace = {
        traceId: trace.traceId,
        ...(eventId ? { parentEventId: eventId } : {}),
      };
      const admittedToApp = dispatchReview({
        opts,
        appId: conversationAppId,
        interfaceAgent,
        eventType,
        eventId,
        requestId,
        prompt,
        trace: reviewTrace,
        inbound,
        inboundData: inboundData ?? {},
        conversationId,
        projectId,
      });
      startedRequestIds.add(requestId);
      return {
        accepted: true as const,
        by: "human-result-follow-through",
        route: "direct" as const,
        note: admittedToApp
          ? "legacy direct owner result admitted to durable May App review"
          : "fresh May review started for direct app-owner result",
      };
    }

    if (eventType === "project.task.reconciled") {
      const data = eventData(event);
      const disposition = nonEmptyString(data.disposition);
      const taskId = nonEmptyString(data.taskId);
      const projectId = nonEmptyString(data.projectId) ?? nonEmptyString(data.project);
      const checkpointReview = disposition === "waiting" && data.reason === CONDITION_REVIEW_REASON;
      if (!taskId || !disposition || (!PROJECT_TERMINAL_DISPOSITIONS.has(disposition) && !checkpointReview)) return;
      // The App inbox is the authoritative continuation when it holds an
      // explicit task link. Trace reconstruction is only a compatibility path
      // for older project requests that have no durable App parent.
      if (hasAppInboxWait(getDb(opts.persistDir), { kind: "task", id: taskId })) return;

      const humanTraceId = findHumanTraceForProjectTask(opts.persistDir, taskId, projectId);
      if (!humanTraceId) return;
      const inbound = getLatestInboundNotificationMessage(opts.persistDir, humanTraceId);
      if (!inbound) return;
      const inboundData = parseRecord(inbound.data);
      const conversationId = nonEmptyString(inboundData?.conversationId);
      const humanText = nonEmptyString(inboundData?.text);
      if (!conversationId || !humanText) return;
      const conversationView = getTelegramConversationView(opts.persistDir, {
        conversationId,
        traceId: humanTraceId,
        taskId,
        projectId,
      });

      const generation = positiveInteger(data.generation);
      const attemptId = nonEmptyString(data.attemptId);
      if (checkpointReview && !attemptId) return;
      const requestId = checkpointReview
        ? `human-result-review:project:${projectId ?? "unknown"}:${taskId}:${generation ?? "current"}:checkpoint:${attemptId}`
        : `human-result-review:project:${projectId ?? "unknown"}:${taskId}:${generation ?? "current"}`;
      if (startedRequestIds.has(requestId) || hasReviewWork(opts.persistDir, conversationAppId, requestId)) {
        return {
          accepted: true as const,
          by: "human-result-follow-through",
          route: "direct" as const,
          note: "existing May project result review reused",
        };
      }

      const eventId = positiveInteger((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
      const prompt = buildProjectReviewPrompt({
        data,
        humanText,
        conversationId,
        replyToMessageId: inbound.telegram_msg_id,
        conversationView,
        checkpointReview,
      });
      const reviewTrace = {
        traceId: humanTraceId,
        ...(eventId ? { parentEventId: eventId } : {}),
      };
      const admittedToApp = dispatchReview({
        opts,
        appId: conversationAppId,
        interfaceAgent,
        eventType,
        eventId,
        requestId,
        prompt,
        trace: reviewTrace,
        inbound,
        inboundData: inboundData ?? {},
        conversationId,
        taskId,
        projectId,
      });
      startedRequestIds.add(requestId);
      return {
        accepted: true as const,
        by: "human-result-follow-through",
        route: "direct" as const,
        note: admittedToApp
          ? "legacy project result admitted to durable May App review"
          : "fresh May review started for human-linked project result",
      };
    }

    if (!CLI_TERMINAL_EVENTS.has(eventType) || (event as { owner?: unknown }).owner !== interfaceOwner) return;

    const data = eventData(event);
    const taskId = nonEmptyString(data.taskId);
    if (!taskId) return;

    const sourceSessionId = nonEmptyString(data.sourceSessionId);
    if (sourceSessionId && opts.manager.activeSessions.has(sourceSessionId)) return;

    const eventId = positiveInteger((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
    const trace = event.trace ?? readPersistedTrace(opts.persistDir, eventId);
    if (!trace?.traceId) return;

    const inbound = getLatestInboundNotificationMessage(opts.persistDir, trace.traceId);
    if (!inbound) return;
    const inboundData = parseRecord(inbound.data);
    const conversationId = nonEmptyString(inboundData?.conversationId);
    const humanText = nonEmptyString(inboundData?.text);
    if (!conversationId || !humanText) return;
    const conversationView = getTelegramConversationView(opts.persistDir, {
      conversationId,
      traceId: trace.traceId,
      taskId,
      projectId: nonEmptyString(data.projectId) ?? undefined,
    });

    const requestId = `human-result-review:cli:${taskId}`;
    if (startedRequestIds.has(requestId) || hasReviewWork(opts.persistDir, conversationAppId, requestId)) {
      return {
        accepted: true as const,
        by: "human-result-follow-through",
        route: "direct" as const,
        note: "existing May result review reused",
      };
    }

    const reviewTrace: EventTrace = {
      traceId: trace.traceId,
      ...(eventId ? { parentEventId: eventId } : trace.parentEventId ? { parentEventId: trace.parentEventId } : {}),
    };
    const prompt = buildReviewPrompt({
      eventType: event.type,
      data,
      humanText,
      conversationId,
      replyToMessageId: inbound.telegram_msg_id,
      conversationView,
    });
    const admittedToApp = dispatchReview({
      opts,
      appId: conversationAppId,
      interfaceAgent,
      eventType,
      eventId,
      requestId,
      prompt,
      trace: reviewTrace,
      inbound,
      inboundData: inboundData ?? {},
      conversationId,
      taskId,
      projectId: nonEmptyString(data.projectId),
    });
    startedRequestIds.add(requestId);

    return {
      accepted: true as const,
      by: "human-result-follow-through",
      route: "direct" as const,
      note: admittedToApp
        ? "legacy CLI result admitted to durable May App review"
        : "fresh May review started for human-originated CLI result",
    };
  });
}

function dispatchReview(input: {
  opts: HumanResultFollowThroughOptions;
  appId: string;
  interfaceAgent: string;
  eventType: string;
  eventId?: number;
  requestId: string;
  prompt: string;
  trace: EventTrace;
  inbound: { telegram_msg_id: number; sent_at: number };
  inboundData: Record<string, unknown>;
  conversationId: string;
  taskId?: string;
  projectId?: string;
}): boolean {
  const channelThreadId =
    nonEmptyString(input.inboundData.channelThreadId) ??
    (positiveInteger(input.inboundData.topicId) ? String(input.inboundData.topicId) : undefined);
  const admitted = input.opts.admitAppReview?.({
    appId: input.appId,
    source: {
      kind: "human",
      id: `telegram:${input.inbound.telegram_msg_id}`,
    },
    input: {
      kind: "message",
      data: {
        message: input.prompt,
        context: {
          compatibility: "legacy-human-result",
          eventType: input.eventType,
          requestId: input.requestId,
          traceId: input.trace.traceId,
          ...(input.taskId ? { taskId: input.taskId } : {}),
          ...(input.projectId ? { projectId: input.projectId } : {}),
        },
      },
    },
    conversationId: input.conversationId,
    conversationSequence: input.eventId ?? input.inbound.sent_at,
    channel: "telegram",
    ...(channelThreadId ? { channelThreadId } : {}),
    channelMessageId: input.inbound.telegram_msg_id,
    idempotencyKey: input.requestId,
    trace: input.trace,
  });
  if (admitted) return true;

  input.opts.manager.run(input.interfaceAgent, input.prompt, {
    kind: "chat",
    autoClose: "never",
    source: "telegram",
    requestId: input.requestId,
    conversationId: input.conversationId,
    channelMessageId: input.inbound.telegram_msg_id,
    trace: input.trace,
  });
  return false;
}

function buildDirectProjectReviewPrompt(input: {
  data: Record<string, unknown>;
  humanText: string;
  conversationId: string;
  replyToMessageId: number;
  conversationView: TelegramConversationView;
}): string {
  return [
    "May direct project-owner result review",
    "",
    "The accountable app owner answered an earlier human request without leaving durable follow-up work. Review that answer in a fresh bounded May turn.",
    "Do not expose app-internal routing or treat the owner's claim as proof when the requested outcome requires evidence.",
    "",
    "Original human request",
    input.humanText,
    "",
    "Owner result",
    `Project: ${nonEmptyString(input.data.projectId) ?? nonEmptyString(input.data.project) ?? "unknown"}`,
    `Disposition: ${nonEmptyString(input.data.disposition) ?? "unknown"}`,
    `Summary: ${nonEmptyString(input.data.summary) ?? "No summary"}`,
    ...conversationViewLines(input.conversationView),
    "",
    "Delivery context",
    `Conversation: ${input.conversationId}`,
    `Reply to Telegram message: ${input.replyToMessageId}`,
    "",
    "Reply in plain language with the direct answer or no-op reason. Replan missing proof through the app, and ask Hao only for a real authority decision.",
  ].join("\n");
}

function buildProjectReviewPrompt(input: {
  data: Record<string, unknown>;
  humanText: string;
  conversationId: string;
  replyToMessageId: number;
  conversationView: TelegramConversationView;
  checkpointReview: boolean;
}): string {
  const evidence = Array.isArray(input.data.evidence)
    ? input.data.evidence.map(String).filter(Boolean).slice(0, 8)
    : [];
  return [
    input.checkpointReview ? "May long-running project checkpoint review" : "May long-running project result review",
    "",
    input.checkpointReview
      ? "The accountable app owner reviewed a missed checkpoint for an earlier human request and the same task is still waiting. Review the evidence in a fresh bounded May turn."
      : "The accountable app task reached a terminal result linked to an earlier human request. Review it in a fresh bounded May turn.",
    "Do not forward the owner's claim as proof. Inspect the task evidence when needed and preserve the original requested outcome.",
    "",
    "Original human request",
    input.humanText,
    "",
    "Owner result",
    `Project: ${nonEmptyString(input.data.projectId) ?? nonEmptyString(input.data.project) ?? "unknown"}`,
    `Task: ${nonEmptyString(input.data.taskId) ?? "unknown"}`,
    `Disposition: ${nonEmptyString(input.data.disposition) ?? "unknown"}`,
    ...(input.checkpointReview ? [`Review reason: ${CONDITION_REVIEW_REASON}`] : []),
    `Summary: ${nonEmptyString(input.data.summary) ?? "No summary"}`,
    ...(evidence.length ? ["Evidence:", ...evidence.map((item) => `- ${item}`)] : []),
    ...conversationViewLines(input.conversationView),
    "",
    "Delivery context",
    `Conversation: ${input.conversationId}`,
    `Reply to Telegram message: ${input.replyToMessageId}`,
    "",
    input.checkpointReview
      ? "Decide whether the same owner task needs changed execution, a proved blocker, or a fresh bounded checkpoint. Route a broken wake path to its runtime owner. Send Hao nothing unless there is a verified result, material change, or exact human-authority decision."
      : "Verify the terminal outcome. Then send one plain-language closeout, replan missing proof, or ask only for a real authority decision. Keep healthy internal progress silent.",
  ].join("\n");
}

function buildReviewPrompt(input: {
  eventType: string;
  data: Record<string, unknown>;
  humanText: string;
  conversationId: string;
  replyToMessageId: number;
  conversationView: TelegramConversationView;
}): string {
  const lines = [
    "May long-running result review",
    "",
    "The May session that started this worker is gone. This fresh review continues the same human request from the durable trace.",
    "Keep that recovery context in your internal understanding, but tell the human only what helps them decide.",
    "",
    "Original human request",
    input.humanText,
    "",
    "Completed worker result",
    `Event: ${input.eventType}`,
    `Task: ${nonEmptyString(input.data.taskId) ?? "unknown"}`,
  ];
  for (const [label, key] of [
    ["Tool", "tool"],
    ["Summary", "summary"],
    ["Error", "error"],
    ["Reason", "reason"],
    ["Result", "resultPath"],
    ["Structured result", "structuredResultPath"],
    ["Evidence events", "eventsPath"],
  ] as const) {
    const value = nonEmptyString(input.data[key]);
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push(
    ...conversationViewLines(input.conversationView),
    "",
    "Delivery context",
    `Conversation: ${input.conversationId}`,
    `Reply to Telegram message: ${input.replyToMessageId}`,
    "",
    "Review the worker result before answering. Inspect the referenced evidence when needed. Do not forward raw worker output or treat worker completion as proof by itself. Reply in plain language with the verified result, replan missing proof, or ask only for a real authority decision. Preserve the original request scope.",
  );
  return lines.join("\n");
}

function conversationViewLines(view: TelegramConversationView): string[] {
  const lines = ["", "Durable request view"];
  if (view.focus?.traceId) lines.push(`Trace: ${view.focus.traceId}`);
  if (view.focus?.taskId) lines.push(`Linked task: ${view.focus.taskId}`);
  if (view.focus?.projectId) lines.push(`Project: ${view.focus.projectId}`);
  if (view.focus?.owner) lines.push(`Current owner: ${view.focus.owner}`);
  if (view.focus?.status) lines.push(`Current state: ${view.focus.status}`);
  for (const event of view.focus?.events.slice(-6) ?? []) {
    const detail = [event.type, event.status, event.summary].filter(Boolean).join(" — ");
    lines.push(`Evidence #${event.eventId}: ${detail}`);
  }
  if (view.recentMessages.length) lines.push("Nearby Telegram messages (oldest to newest)");
  for (const message of view.recentMessages.slice(-8)) {
    const speaker = message.direction === "inbound" ? "Hao" : message.agent || "May";
    lines.push(`${speaker}: ${message.text.slice(0, 400)}`);
  }
  lines.push("Use the trace and linked task before nearby wording. Nearby messages are context, not a new target.");
  return lines;
}

function readPersistedTrace(persistDir: string, eventId: number | undefined): EventTrace | undefined {
  if (!eventId) return undefined;
  const row = getDb(persistDir)
    .prepare("SELECT trace_id, parent_event_id FROM event_traces WHERE event_id = ?")
    .get(eventId) as { trace_id?: unknown; parent_event_id?: unknown } | undefined;
  const traceId = nonEmptyString(row?.trace_id);
  if (!traceId) return undefined;
  const parentEventId = positiveInteger(row?.parent_event_id);
  return { traceId, ...(parentEventId ? { parentEventId } : {}) };
}

function hasReviewWork(persistDir: string, appId: string, requestId: string): boolean {
  const row = getDb(persistDir)
    .prepare(
      `SELECT 1 AS found FROM sessions WHERE requestId = ?
       UNION ALL
       SELECT 1 AS found FROM app_inbox_items WHERE app_id = ? AND idempotency_key = ?
       LIMIT 1`,
    )
    .get(requestId, appId, requestId) as { found?: unknown } | undefined;
  return row?.found === 1;
}

function findHumanTraceForProjectTask(persistDir: string, taskId: string, projectId?: string): string | undefined {
  try {
    const row = getDb(persistDir)
      .prepare(
        `SELECT trace.trace_id AS traceId
           FROM events ownerResult
           JOIN event_traces trace ON trace.event_id = ownerResult.id
           JOIN json_each(ownerResult.data, '$.taskRefs') taskRef
          WHERE ownerResult.event_type = 'project.owner.reviewed'
            AND json_extract(taskRef.value, '$.taskId') = ?
            AND (? IS NULL OR json_extract(taskRef.value, '$.projectId') = ?)
          ORDER BY ownerResult.id DESC
          LIMIT 1`,
      )
      .get(taskId, projectId ?? null, projectId ?? null) as { traceId?: unknown } | undefined;
    return nonEmptyString(row?.traceId);
  } catch {
    return undefined;
  }
}

function parseRecord(raw: string | null | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}
