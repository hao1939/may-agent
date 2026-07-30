import { EVENT_ROW_ID, childEventTrace, eventData, type AgentEvent, type EventBus, type EventTrace } from "./event-bus.js";
import { getDb } from "../lib/db/connection.js";
import { getLatestInboundNotificationMessage } from "../lib/db/notifications.js";
import type { RunOptions } from "../lib/manager.js";

type ReviewManager = {
  activeSessions: { has: (sessionId: string) => boolean };
  run: (agent: string, task: string, opts?: RunOptions) => string;
};

export type HumanResultFollowThroughOptions = {
  bus: EventBus;
  manager: ReviewManager;
  persistDir: string;
  interfaceAgent?: string;
};

const CLI_TERMINAL_EVENTS = new Set(["cli.task.completed", "cli.task.failed", "cli.task.orphaned"]);
const PROJECT_TERMINAL_DISPOSITIONS = new Set(["converged", "attention"]);

/**
 * Start a fresh May review when a human-originated CLI result outlives the May
 * session that requested it. The CLI task and event trace remain the durable
 * work record; this subscriber only restores the missing review turn.
 */
export function attachHumanResultFollowThrough(opts: HumanResultFollowThroughOptions): () => void {
  const interfaceAgent = opts.interfaceAgent?.trim() || "may";
  const interfaceOwner = `agent:${interfaceAgent}`;
  const startedRequestIds = new Set<string>();

  return opts.bus.subscribe((event) => {
    const eventType = String((event as unknown as { type?: unknown }).type ?? "");
    if (eventType === "project.task.reconciled") {
      const data = eventData(event);
      const disposition = nonEmptyString(data.disposition);
      const taskId = nonEmptyString(data.taskId);
      const projectId = nonEmptyString(data.projectId) ?? nonEmptyString(data.project);
      if (!taskId || !disposition || !PROJECT_TERMINAL_DISPOSITIONS.has(disposition)) return;

      const humanTraceId = findHumanTraceForProjectTask(opts.persistDir, taskId, projectId);
      if (!humanTraceId) return;
      const inbound = getLatestInboundNotificationMessage(opts.persistDir, humanTraceId);
      if (!inbound) return;
      const inboundData = parseRecord(inbound.data);
      const conversationId = nonEmptyString(inboundData?.conversationId);
      const humanText = nonEmptyString(inboundData?.text);
      if (!conversationId || !humanText) return;

      const generation = positiveInteger(data.generation);
      const requestId = `human-result-review:project:${projectId ?? "unknown"}:${taskId}:${generation ?? "current"}`;
      if (startedRequestIds.has(requestId) || hasReviewSession(opts.persistDir, requestId)) {
        return {
          accepted: true as const,
          by: "human-result-follow-through",
          route: "direct" as const,
          note: "existing May project result review reused",
        };
      }

      const eventId = positiveInteger((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
      opts.manager.run(
        interfaceAgent,
        buildProjectReviewPrompt({
          data,
          humanText,
          conversationId,
          replyToMessageId: inbound.telegram_msg_id,
        }),
        {
          kind: "chat",
          autoClose: "never",
          source: "telegram",
          requestId,
          conversationId,
          channelMessageId: inbound.telegram_msg_id,
          trace: {
            traceId: humanTraceId,
            ...(eventId ? { parentEventId: eventId } : {}),
          },
        },
      );
      startedRequestIds.add(requestId);
      return {
        accepted: true as const,
        by: "human-result-follow-through",
        route: "direct" as const,
        note: "fresh May review started for human-linked project result",
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

    const requestId = `human-result-review:cli:${taskId}`;
    if (startedRequestIds.has(requestId) || hasReviewSession(opts.persistDir, requestId)) {
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
    });
    opts.manager.run(interfaceAgent, prompt, {
      kind: "chat",
      autoClose: "never",
      source: "telegram",
      requestId,
      conversationId,
      channelMessageId: inbound.telegram_msg_id,
      trace: reviewTrace,
    });
    startedRequestIds.add(requestId);

    return {
      accepted: true as const,
      by: "human-result-follow-through",
      route: "direct" as const,
      note: "fresh May review started for human-originated CLI result",
    };
  });
}

function buildProjectReviewPrompt(input: {
  data: Record<string, unknown>;
  humanText: string;
  conversationId: string;
  replyToMessageId: number;
}): string {
  const evidence = Array.isArray(input.data.evidence)
    ? input.data.evidence.map(String).filter(Boolean).slice(0, 8)
    : [];
  return [
    "May long-running project result review",
    "",
    "The accountable app task reached a terminal result linked to an earlier human request. Review it in a fresh bounded May turn.",
    "Do not forward the owner's claim as proof. Inspect the task evidence when needed and preserve the original requested outcome.",
    "",
    "Original human request",
    input.humanText,
    "",
    "Owner result",
    `Project: ${nonEmptyString(input.data.projectId) ?? nonEmptyString(input.data.project) ?? "unknown"}`,
    `Task: ${nonEmptyString(input.data.taskId) ?? "unknown"}`,
    `Disposition: ${nonEmptyString(input.data.disposition) ?? "unknown"}`,
    `Summary: ${nonEmptyString(input.data.summary) ?? "No summary"}`,
    ...(evidence.length ? ["Evidence:", ...evidence.map((item) => `- ${item}`)] : []),
    "",
    "Delivery context",
    `Conversation: ${input.conversationId}`,
    `Reply to Telegram message: ${input.replyToMessageId}`,
    "",
    "Verify the terminal outcome. Then send one plain-language closeout, replan missing proof, or ask only for a real authority decision. Keep healthy internal progress silent.",
  ].join("\n");
}

function buildReviewPrompt(input: {
  eventType: string;
  data: Record<string, unknown>;
  humanText: string;
  conversationId: string;
  replyToMessageId: number;
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
    "",
    "Delivery context",
    `Conversation: ${input.conversationId}`,
    `Reply to Telegram message: ${input.replyToMessageId}`,
    "",
    "Review the worker result before answering. Inspect the referenced evidence when needed. Do not forward raw worker output or treat worker completion as proof by itself. Reply in plain language with the verified result, replan missing proof, or ask only for a real authority decision. Preserve the original request scope.",
  );
  return lines.join("\n");
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

function hasReviewSession(persistDir: string, requestId: string): boolean {
  const row = getDb(persistDir)
    .prepare("SELECT 1 AS found FROM sessions WHERE requestId = ? LIMIT 1")
    .get(requestId) as { found?: unknown } | undefined;
  return row?.found === 1;
}

function findHumanTraceForProjectTask(
  persistDir: string,
  taskId: string,
  projectId?: string,
): string | undefined {
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
