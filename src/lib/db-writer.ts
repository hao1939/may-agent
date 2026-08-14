/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * This is the ONLY component that writes to the DB.
 * Core emits events, DbWriter persists them.
 *
 * See: shared/may-agent-docs/events.md
 */

import { createHash } from "node:crypto";
import {
  EVENT_DEDUPLICATED,
  EVENT_INGRESS_SOURCE,
  EVENT_REDELIVERY_REQUIRED,
  EVENT_ROW_ID,
  type AgentEvent,
  type DeliveryResult,
} from "../app/event-bus.js";
import { getDb, upsertSession, updateSessionDb } from "./requests.js";
import type { SqliteDb } from "./db.js";
import { isCanonicalEventEnvelope, isRecord } from "../../packages/control/src/event-envelope.js";
import { withSqliteBusyRetry } from "./db/busy-retry.js";
import { persistEventClosure, persistEventTrace } from "./db/event-traces.js";
import { describeText, writeContentAddressedJson, writeSessionResult, type ArtifactDescriptor } from "./artifacts.js";
import { log } from "./log.js";

/** Keep coordination rows small; full large bodies live in event-bodies/. */
const INLINE_EVENT_DATA_BYTES = 4_096;
const MAX_EVENT_PROJECTION_LENGTH = 12_000;

const DURABLE_COMMAND_EVENTS = new Set([
  "fork",
  "input",
  "steer",
  "cancel",
  "cancel_all",
  "resume",
  "reload",
  "restart",
  "shutdown",
]);

const DEFAULT_UNACCEPTED_TTL_MS = 2 * 60 * 1000;
const DEFAULT_PAIR_TTL_MS = 45 * 60 * 1000;
// Task assignment pairs use a longer TTL because project tasks legitimately
// take 2-4 hours to complete. The default 45min TTL caused bulk-assignment
// batches (e.g. 150 alpha-project tasks) to orphan simultaneously and breach
// the event.pair-orphan-count threshold.

function eventPayload(event: Record<string, unknown>): Record<string, unknown> {
  if (isCanonicalEventEnvelope(event)) return event.data as Record<string, unknown>;
  const { type: _type, ...data } = event;
  return data;
}

function eventSource(event: Record<string, unknown>, fallback?: unknown): string | null {
  const source = isCanonicalEventEnvelope(event) ? event.source : eventPayload(event).source;
  return typeof source === "string" ? source : typeof fallback === "string" ? fallback : null;
}

function eventOwner(event: Record<string, unknown>, fallback?: unknown): string | null {
  const owner = isCanonicalEventEnvelope(event) ? event.owner : eventPayload(event).owner;
  return typeof owner === "string" ? owner : typeof fallback === "string" ? fallback : null;
}

function eventUrgency(event: Record<string, unknown>): string {
  const urgency = isCanonicalEventEnvelope(event) ? event.urgency : eventPayload(event).urgency;
  return typeof urgency === "string" ? urgency : "normal";
}

function eventTtlMs(event: Record<string, unknown>): number | null {
  const ttl = isCanonicalEventEnvelope(event) ? event.ttl_ms : eventPayload(event).ttl_ms;
  return typeof ttl === "number" ? ttl : null;
}

function stableEventValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableEventValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableEventValue(item)]),
  );
}

function idempotencyHash(event: AgentEvent, payload: Record<string, unknown>): string {
  const record = event as AgentEvent & Record<string, unknown>;
  const canonical = isCanonicalEventEnvelope(record)
    ? {
        ...Object.fromEntries(
          Object.entries(record).filter(([key]) => key !== "data" && key !== "timestamp" && key !== "trace"),
        ),
        data: payload,
      }
    : {
        type: event.type,
        data: Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "timestamp")),
      };
  return createHash("sha256")
    .update(JSON.stringify(stableEventValue(canonical)))
    .digest("hex");
}

function ingressSource(event: AgentEvent, fallback: string | null): string {
  const trusted = (event as AgentEvent & { [EVENT_INGRESS_SOURCE]?: unknown })[EVENT_INGRESS_SOURCE];
  return typeof trusted === "string" && trusted.trim() ? trusted.trim() : (fallback ?? "internal");
}

function idempotencyScope(correlation: ReturnType<typeof eventCorrelation>, owner: string | null): string {
  return (
    correlation.projectId ??
    correlation.taskId ??
    correlation.workflowRunId ??
    correlation.sessionId ??
    owner ??
    "global"
  );
}

function compactEventValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    const max = depth === 0 ? 4_000 : 2_000;
    return value.length <= max ? value : `${value.slice(0, max)}...[TRUNCATED: ${value.length} chars]`;
  }
  if (value === null || typeof value !== "object") return value;
  if (depth >= 6) return "[TRUNCATED: maximum event data depth]";
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map((item) => compactEventValue(item, depth + 1));
    if (value.length > 50) items.push(`[TRUNCATED: ${value.length - 50} more items]`);
    return items;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const compacted = Object.fromEntries(
    entries.slice(0, 100).map(([key, item]) => [key, compactEventValue(item, depth + 1)]),
  );
  if (entries.length > 100) compacted._truncatedProperties = entries.length - 100;
  return compacted;
}

function capEventData(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  if (json.length <= MAX_EVENT_PROJECTION_LENGTH) return json;

  const compacted = compactEventValue(payload) as Record<string, unknown>;
  const compactJson = JSON.stringify({
    ...compacted,
    _truncated: payload._truncated ?? { originalLength: json.length },
  });
  if (compactJson.length <= MAX_EVENT_PROJECTION_LENGTH) return compactJson;

  const fallback: Record<string, unknown> = {
    _truncated: payload._truncated ?? {
      originalLength: json.length,
      reason: "event payload exceeded persistence limit",
    },
  };
  const priorityKeys = [
    "sessionId",
    "agent",
    "status",
    "outcome",
    "summary",
    "error",
    "workflowRunId",
    "projectId",
    "taskId",
    "attemptId",
    "handler",
    "metricId",
    "metric",
    "alertId",
    "escalationId",
    "durationMs",
    "lane",
    "reason",
  ];
  const scalarEntries = Object.entries(payload).filter(([, value]) => value === null || typeof value !== "object");
  const orderedEntries = [
    ...priorityKeys.flatMap((key) => scalarEntries.filter(([entryKey]) => entryKey === key)),
    ...scalarEntries.filter(([key]) => !priorityKeys.includes(key)),
  ];
  for (const [key, value] of orderedEntries) {
    const candidate = { ...fallback, [key]: compactEventValue(value, 1) };
    if (JSON.stringify(candidate).length > MAX_EVENT_PROJECTION_LENGTH) continue;
    fallback[key] = candidate[key];
  }
  return JSON.stringify(fallback);
}

function stringField(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numberField(payload: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function eventCorrelation(payload: Record<string, unknown>) {
  return {
    sessionId: stringField(payload, "sessionId", "session_id", "sourceSessionId"),
    workflowRunId: stringField(payload, "workflowRunId", "workflow_run_id"),
    projectId: stringField(payload, "projectId", "project_id", "project"),
    taskId: stringField(payload, "taskId", "task_id"),
    attemptId: stringField(payload, "attemptId", "attempt_id"),
    handler: stringField(payload, "handler"),
    metricId: stringField(payload, "metricId", "metric_id", "metric"),
    alertId: stringField(payload, "alertId", "alert_id"),
    escalationId: stringField(payload, "escalationId", "escalation_id"),
    status: stringField(payload, "status"),
    durationMs: numberField(payload, "durationMs", "duration_ms"),
  };
}

function prepareEventBody(
  persistDir: string,
  payload: Record<string, unknown>,
): { data: string; artifact: ArtifactDescriptor } {
  const serialized = `${JSON.stringify(payload)}\n`;
  const inlineDescriptor = describeText("", serialized);
  if (inlineDescriptor.bytes <= INLINE_EVENT_DATA_BYTES) {
    return { data: JSON.stringify(payload), artifact: inlineDescriptor };
  }
  const artifact = writeContentAddressedJson(persistDir, "event-bodies", payload);
  const projected = compactEventValue(payload) as Record<string, unknown>;
  return {
    data: capEventData({
      ...projected,
      _truncated: {
        originalLength: serialized.length - 1,
        reason: "full event body stored as artifact",
      },
      _artifact: {
        ref: artifact.ref,
        sha256: artifact.sha256,
        bytes: artifact.bytes,
      },
    }),
    artifact,
  };
}

function parseStoredEventData(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstEscalationResumeCondition(payload: Record<string, unknown>): string | null {
  const resume = objectValue(payload.resume);
  const evidence = objectValue(payload.evidence);
  const finishParams = objectValue(evidence?.finishParams);
  const blockers = arrayValue(finishParams?.blockers);
  const firstBlocker = objectValue(blockers?.[0]);

  return (
    textValue(payload.resumeCondition) ??
    textValue(payload.resume_condition) ??
    textValue(resume?.condition) ??
    textValue(resume?.resumeCondition) ??
    textValue(finishParams?.resumeCondition) ??
    textValue(finishParams?.resume_condition) ??
    textValue(finishParams?.next_steps) ??
    textValue(finishParams?.nextSteps) ??
    textValue(firstBlocker?.context) ??
    textValue(firstBlocker?.reason) ??
    textValue(payload.blockedOn) ??
    textValue(payload.requestedAction)
  );
}

function normalizePersistedEscalationPayload(
  eventType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (eventType !== "escalation.created") return payload;
  const resumeCondition = firstEscalationResumeCondition(payload);
  if (!resumeCondition) return payload;

  const resume = objectValue(payload.resume);
  const sourceSessionId = textValue(payload.sourceSessionId);
  return {
    ...payload,
    resumeCondition,
    ...(resume
      ? {
          resume:
            textValue(resume.condition) || textValue(resume.resumeCondition)
              ? resume
              : { ...resume, condition: resumeCondition },
        }
      : sourceSessionId
        ? {
            resume: {
              kind: "session",
              sessionId: sourceSessionId,
              condition: resumeCondition,
            },
          }
        : {}),
  };
}

const RECONCILED_TERMINAL_SESSION_STATUSES = new Set(["done", "error", "interrupted"]);

function isTerminalNoopEvent(eventType: unknown, data: Record<string, unknown> | null): boolean {
  if (eventType !== "session.end" || !data) return false;
  return (
    data.reconciled === true &&
    typeof data.sessionId === "string" &&
    typeof data.agent === "string" &&
    RECONCILED_TERMINAL_SESSION_STATUSES.has(String(data.status))
  );
}

function keyPart(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

type PairContract = {
  name: string;
  open: string;
  closes: readonly string[];
  timeoutMs: number;
  key: (payload: Record<string, unknown>) => string | undefined;
  allowEarlierClose?: boolean;
  preferExplicitOpenEventId?: boolean;
};

const sessionKey = (payload: Record<string, unknown>) => keyPart(payload.sessionId);
const workflowKey = (payload: Record<string, unknown>) => keyPart(payload.workflowRunId);
const handlerKey = (payload: Record<string, unknown>) =>
  keyPart(payload.handlerRunId) ?? keyPart(payload.workflowRunId) ?? keyPart(payload.handler);
const escalationKey = (payload: Record<string, unknown>) => keyPart(payload.escalationId);
const cliTaskKey = (payload: Record<string, unknown>) => keyPart(payload.taskId);
const projectOwnerKey = (payload: Record<string, unknown>) =>
  keyPart(payload.projectId) ?? keyPart(payload.project) ?? keyPart(payload.projectPath);

// Lifecycle tracking is deliberately explicit. Adding an event suffix must not
// silently create work or a request-shaped correlation contract.
const PAIR_CONTRACTS: readonly PairContract[] = [
  {
    name: "session",
    open: "session.start",
    closes: ["session.idle", "session.end"],
    timeoutMs: 60 * 60 * 1000,
    key: sessionKey,
  },
  {
    name: "handler",
    open: "handler.started",
    closes: ["handler.completed", "handler.failed"],
    timeoutMs: DEFAULT_PAIR_TTL_MS,
    key: handlerKey,
  },
  {
    name: "workflow",
    open: "workflow.started",
    closes: ["workflow.completed", "workflow.failed", "workflow.blocked", "workflow.interrupted"],
    timeoutMs: DEFAULT_PAIR_TTL_MS,
    key: workflowKey,
  },
  {
    name: "escalation",
    open: "escalation.created",
    closes: ["escalation.resolved", "escalation.dismissed"],
    timeoutMs: 24 * 60 * 60 * 1000,
    key: escalationKey,
  },
  {
    name: "cli.task.request",
    open: "cli.task.requested",
    closes: ["cli.task.started", "cli.task.failed"],
    timeoutMs: 60 * 60 * 1000,
    key: cliTaskKey,
  },
  {
    name: "cli.task",
    open: "cli.task.started",
    closes: ["cli.task.completed", "cli.task.failed", "cli.task.orphaned"],
    timeoutMs: DEFAULT_PAIR_TTL_MS,
    key: cliTaskKey,
  },
  {
    name: "may.break-glass",
    open: "may.break-glass.started",
    closes: ["may.break-glass.completed", "may.break-glass.failed"],
    timeoutMs: 60 * 60 * 1000,
    key: sessionKey,
  },
  {
    name: "project.intent",
    open: "project.comment.created",
    closes: ["project.owner.reviewed"],
    timeoutMs: 60 * 60 * 1000,
    key: projectOwnerKey,
    allowEarlierClose: false,
    preferExplicitOpenEventId: true,
  },
  {
    name: "project.owner",
    open: "project.owner.requested",
    closes: ["project.owner.reviewed"],
    timeoutMs: 60 * 60 * 1000,
    key: projectOwnerKey,
    allowEarlierClose: false,
    preferExplicitOpenEventId: true,
  },
];

function openingPair(eventType: string): PairContract | undefined {
  return PAIR_CONTRACTS.find((contract) => contract.open === eventType);
}

function closingPairs(eventType: string): PairContract[] {
  return PAIR_CONTRACTS.filter((contract) => contract.closes.includes(eventType));
}

export class DbWriter {
  private db: SqliteDb;
  private persistDir: string;
  private deliveryTrackingStartedAt = Date.now();

  constructor(persistDir: string) {
    this.persistDir = persistDir;
    this.db = getDb(persistDir);
  }

  /** Subscribe this writer to an EventBus. */
  handler = (event: AgentEvent): void => {
    switch (event.type) {
      case "session.start": {
        const ev = event as any;
        if (!isCanonicalEventEnvelope(ev)) break;
        const payload = eventPayload(ev);
        upsertSession(this.persistDir, {
          sessionId: payload.sessionId as string,
          agent: payload.agent as string,
          task: (payload.task as string | undefined) ?? "",
          status: "running",
          kind: payload.kind as string | undefined,
          source: (payload.source as string | undefined) ?? eventSource(ev) ?? undefined,
          parentSessionId: payload.parentSessionId as string | undefined,
          workflowRunId: payload.workflowRunId as string | undefined,
          projectId: payload.projectId as string | undefined,
          requestId: payload.requestId as string | undefined,
          stepLabel: payload.stepLabel as string | undefined,
          startedAt: Date.now(),
        });
        this.insertEventRow(event, payload, eventSource(ev, payload.agent), eventOwner(ev, payload.agent));
        break;
      }

      case "session.end": {
        const ev = event as any;
        if (!isCanonicalEventEnvelope(ev)) break;
        const payload = eventPayload(ev);
        const endedAt = Date.now();
        const resultArtifact = writeSessionResult(this.persistDir, payload.sessionId as string, {
          status: payload.status,
          outcome: payload.outcome,
          error: payload.error,
          summary: payload.summary,
          opCount: payload.opCount,
          turnCount: payload.turnCount,
          finishParams: payload.finishParams,
          endedAt,
        });
        updateSessionDb(this.persistDir, payload.sessionId as string, {
          status: payload.status as any,
          error: payload.error as string | undefined,
          outcome: payload.outcome as string | undefined,
          opCount: payload.opCount as number | undefined,
          lastActivityAt: endedAt,
          endedAt,
          resultArtifact,
        });
        this.insertEventRow(event, payload, eventSource(ev, payload.agent), eventOwner(ev, payload.agent));
        break;
      }

      case "session.idle": {
        const ev = event as any;
        if (!isCanonicalEventEnvelope(ev)) break;
        const payload = eventPayload(ev);
        updateSessionDb(this.persistDir, payload.sessionId as string, {
          status: "idle",
          error: payload.error as string | undefined,
          outcome: payload.summary as string | undefined,
          opCount: payload.opCount as number | undefined,
          lastActivityAt: Date.now(),
        });
        this.insertEventRow(event, payload, eventSource(ev, payload.agent), eventOwner(ev, payload.agent));
        break;
      }

      case "message.created": {
        const ev = event as any;
        if (!isCanonicalEventEnvelope(ev)) break;
        const payload = eventPayload(ev);
        const priority = payload.priority ?? "P2";
        const urgency = eventUrgency(ev);
        // v2 inter-agent message — persist with canonical source/owner so
        // inbox queries key on the event owner.
        // Preserve any additional payload fields (for example approval
        // dispatch lineage metadata) so exact follow-up queries can rely on
        // events.data instead of parsing freeform content.
        this.insertEventRow(
          event,
          {
            ...payload,
            intent: payload.intent ?? null,
            artifact: payload.artifact ?? null,
            priority,
          },
          eventSource(ev),
          eventOwner(ev),
          urgency,
        );
        break;
      }

      default:
        if (DURABLE_COMMAND_EVENTS.has(event.type) || event.type.startsWith("trigger.")) {
          const ev = event as any;
          const data = eventPayload(ev);
          this.insertEventRow(event, data, eventSource(ev), eventOwner(ev), eventUrgency(ev), eventTtlMs(ev));
          break;
        }

        // Persist domain events (dot-separated types) to events table
        if (event.type.includes(".")) {
          const ev = event as any;
          if (!isCanonicalEventEnvelope(ev)) break;
          const data = eventPayload(ev);
          this.insertEventRow(event, data, eventSource(ev), eventOwner(ev), eventUrgency(ev), eventTtlMs(ev));
        }
        break;
    }
  };

  recordDelivery = (event: AgentEvent, result: DeliveryResult): void => {
    const rowId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
    if (typeof rowId !== "number" || !Number.isFinite(rowId)) return;
    try {
      withSqliteBusyRetry(`record delivery acceptance for event ${rowId}`, () => {
        const now = Date.now();
        try {
          this.db.exec("BEGIN IMMEDIATE");
          if (result.route === "owner_inbox") this.openOwnerInboxPair(event, rowId, now);
          this.db.run(
            `UPDATE events
             SET delivery_status = 'accepted',
                 accepted_by = ?,
                 accepted_at = ?,
                 delivery_route = ?,
                 delivery_note = ?
             WHERE id = ?`,
            [result.by, now, result.route ?? "direct", result.note ?? null, rowId],
          );
          this.db.exec("COMMIT");
        } catch (error) {
          try {
            this.db.exec("ROLLBACK");
          } catch {
            /* preserve the original failure */
          }
          throw error;
        }
      });
    } catch (error) {
      log(
        "warn",
        `[event-delivery] failed to record acceptance for event ${rowId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  private insertEventRow(
    event: AgentEvent,
    payload: Record<string, unknown>,
    source: string | null,
    owner: string | null,
    urgency = eventUrgency(event as Record<string, unknown>),
    ttlMs = eventTtlMs(event as Record<string, unknown>),
  ): number | null {
    const timestamp = Date.now();
    this.sweepStalePairs(timestamp);
    this.sweepUnacceptedEvents(timestamp);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const persistedPayload = normalizePersistedEscalationPayload(event.type, payload);
      if (persistedPayload !== payload && isCanonicalEventEnvelope(event)) {
        (event as AgentEvent & { data: Record<string, unknown> }).data = persistedPayload;
      }
      const correlation = eventCorrelation(persistedPayload);
      const idempotencyKey =
        typeof persistedPayload.idempotencyKey === "string" ? persistedPayload.idempotencyKey.trim() : "";
      const trustedIngressSource = ingressSource(event, source);
      const scope = idempotencyScope(correlation, owner);
      const inputHash = idempotencyHash(event, persistedPayload);
      if (idempotencyKey) {
        const existing = this.db
          .prepare(
            `SELECT e.id, e.idempotency_hash, e.delivery_status, e.source, e.owner, e.timestamp,
                    t.trace_id, t.parent_event_id
             FROM events e
             LEFT JOIN event_traces t ON t.event_id = e.id
             WHERE e.event_type = ?
               AND e.ingress_source = ?
               AND e.idempotency_scope = ?
               AND e.idempotency_key = ?
             LIMIT 1`,
          )
          .get(event.type, trustedIngressSource, scope, idempotencyKey) as
          | {
              id?: unknown;
              idempotency_hash?: unknown;
              delivery_status?: unknown;
              source?: unknown;
              owner?: unknown;
              timestamp?: unknown;
              trace_id?: unknown;
              parent_event_id?: unknown;
            }
          | undefined;
        const existingId = Number(existing?.id);
        if (Number.isInteger(existingId) && existingId > 0) {
          if (existing?.idempotency_hash !== inputHash) {
            throw new Error(`Idempotency key ${idempotencyKey} was already used with different event input`);
          }
          const retryEvent = event as AgentEvent & Record<string, unknown>;
          if (typeof existing.source === "string") retryEvent.source = existing.source;
          if (typeof existing.owner === "string") retryEvent.owner = existing.owner;
          if (typeof existing.timestamp === "number") retryEvent.timestamp = existing.timestamp;
          if (typeof existing.trace_id === "string") {
            event.trace = {
              traceId: existing.trace_id,
              ...(typeof existing.parent_event_id === "number" ? { parentEventId: existing.parent_event_id } : {}),
            };
          }
          Object.defineProperty(event, EVENT_ROW_ID, { value: existingId, configurable: true });
          Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true, configurable: true });
          if (existing.delivery_status === "pending" || existing.delivery_status === "unhandled") {
            Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
          }
          this.db.exec("COMMIT");
          return existingId;
        }
      }
      const body = prepareEventBody(this.persistDir, persistedPayload);
      const info = this.db.run(
        `INSERT INTO events
          (event_type, source, owner, data, body_ref, body_sha256, body_bytes,
           session_id, workflow_run_id, project_id, task_id, attempt_id, handler,
           metric_id, alert_id, escalation_id, subject_status, duration_ms,
           timestamp, urgency, ttl_ms, idempotency_key, idempotency_scope,
           idempotency_hash, ingress_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.type,
          source,
          owner,
          body.data,
          body.artifact.ref || null,
          body.artifact.sha256,
          body.artifact.bytes,
          correlation.sessionId,
          correlation.workflowRunId,
          correlation.projectId,
          correlation.taskId,
          correlation.attemptId,
          correlation.handler,
          correlation.metricId,
          correlation.alertId,
          correlation.escalationId,
          correlation.status,
          correlation.durationMs,
          timestamp,
          urgency,
          ttlMs,
          idempotencyKey || null,
          scope,
          idempotencyKey ? inputHash : null,
          trustedIngressSource,
        ],
      );
      const rowId = Number(info.lastInsertRowid);
      if (!Number.isFinite(rowId) || rowId <= 0) {
        this.db.exec("ROLLBACK");
        return null;
      }
      try {
        Object.defineProperty(event, EVENT_ROW_ID, {
          value: rowId,
          configurable: true,
        });
      } catch (error) {
        throw new Error(`Persisted event ${rowId} cannot expose its durable receipt`, { cause: error });
      }
      persistEventTrace(this.db, event, rowId, timestamp);
      this.closePairForFollowup(payload, rowId, timestamp);
      this.closeConventionPairs(event.type, payload, rowId, timestamp);
      this.openConventionPair(event.type, payload, rowId, eventOwner(event as Record<string, unknown>), timestamp);
      this.db.exec("COMMIT");
      return rowId;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        /* preserve the original persistence error */
      }
      throw error;
    }
  }

  private closePairForFollowup(payload: Record<string, unknown>, closeEventId: number, closedAt: number): void {
    const rawOpenEventId = payload.openEventId ?? payload.open_event_id;
    const openEventId = typeof rawOpenEventId === "number" ? rawOpenEventId : Number(rawOpenEventId);
    if (!Number.isFinite(openEventId) || openEventId <= 0) return;
    const rows = this.db
      .prepare(
        `SELECT open_event_id, pair_name
       FROM event_pair_runs
       WHERE open_event_id = ?
         AND status IN ('open', 'orphan')`,
      )
      .all(openEventId) as Array<{ open_event_id?: unknown; pair_name?: unknown }>;
    this.db.run(
      `UPDATE event_pair_runs
       SET status = 'closed',
           close_event_id = ?,
           closed_at = ?,
           note = COALESCE(note, 'closed by follow-up event')
       WHERE open_event_id = ?
         AND status IN ('open', 'orphan')`,
      [closeEventId, closedAt, openEventId],
    );
    for (const row of rows) {
      persistEventClosure(
        this.db,
        closeEventId,
        Number(row.open_event_id),
        typeof row.pair_name === "string" ? row.pair_name : "follow-up",
        closedAt,
      );
    }
  }

  private openOwnerInboxPair(event: AgentEvent, openEventId: number, openedAt: number): void {
    const ttlMs = eventTtlMs(event as Record<string, unknown>) ?? 2 * 60 * 60 * 1000;
    const owner = eventOwner(event as Record<string, unknown>);
    this.db.run(
      `INSERT OR IGNORE INTO event_pair_runs
       (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at, note)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        "owner_inbox",
        `event:${openEventId}`,
        openEventId,
        owner,
        openedAt,
        openedAt + ttlMs,
        `owner inbox item opened by ${event.type}`,
      ],
    );
  }

  private openConventionPair(
    eventType: string,
    payload: Record<string, unknown>,
    openEventId: number,
    owner: string | null,
    openedAt: number,
  ): void {
    const pair = openingPair(eventType);
    if (!pair) return;
    const key = pair.key(payload);
    if (!key) return;
    this.db.run(
      `INSERT OR IGNORE INTO event_pair_runs
       (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at, note)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
      [pair.name, key, openEventId, owner, openedAt, openedAt + pair.timeoutMs, `opened by ${eventType}`],
    );
    this.closeConventionPairFromEarlierEvent(pair, key, openEventId, openedAt);
  }

  private closeConventionPairFromEarlierEvent(
    pair: PairContract,
    key: string,
    openEventId: number,
    openedAt: number,
  ): void {
    if (pair.allowEarlierClose === false) return;
    const closeTypes = [...pair.closes];
    if (closeTypes.length === 0) return;
    const placeholders = closeTypes.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT id, event_type, data, timestamp
         FROM events
         WHERE event_type IN (${placeholders})
           AND id != ?
         ORDER BY id DESC
         LIMIT 200`,
      )
      .all(...closeTypes, openEventId) as Array<{
      id?: unknown;
      event_type?: unknown;
      data?: unknown;
      timestamp?: unknown;
    }>;
    for (const row of rows) {
      const eventType = typeof row.event_type === "string" ? row.event_type : "";
      const payload = parseStoredEventData(row.data);
      if (!payload || pair.key(payload) !== key) continue;
      const closeEventId = typeof row.id === "number" ? row.id : Number(row.id);
      if (!Number.isFinite(closeEventId) || closeEventId <= 0) return;
      const closeTimestamp = typeof row.timestamp === "number" ? row.timestamp : Number(row.timestamp);
      this.db.run(
        `UPDATE event_pair_runs
         SET status = 'closed',
             close_event_id = ?,
             closed_at = ?,
             note = ?
         WHERE status IN ('open', 'orphan')
           AND pair_name = ?
           AND correlation_key = ?
           AND open_event_id = ?`,
        [
          closeEventId,
          Math.max(openedAt, Number.isFinite(closeTimestamp) ? closeTimestamp : openedAt),
          `closed by earlier ${eventType}`,
          pair.name,
          key,
          openEventId,
        ],
      );
      persistEventClosure(this.db, closeEventId, openEventId, pair.name, openedAt);
      return;
    }
  }

  private closeConventionPairs(
    eventType: string,
    payload: Record<string, unknown>,
    closeEventId: number,
    closedAt: number,
  ): void {
    const pairs = closingPairs(eventType);
    for (const pair of pairs) {
      const rawOpenEventId = payload.openEventId ?? payload.open_event_id;
      const openEventId = typeof rawOpenEventId === "number" ? rawOpenEventId : Number(rawOpenEventId);
      if (pair.preferExplicitOpenEventId && Number.isFinite(openEventId) && openEventId > 0) {
        continue;
      }
      const key = pair.key(payload);
      if (!key) continue;
      const rows = this.db
        .prepare(
          `SELECT open_event_id
       FROM event_pair_runs
       WHERE status IN ('open', 'orphan')
         AND pair_name = ?
         AND correlation_key = ?`,
        )
        .all(pair.name, key) as Array<{ open_event_id?: unknown }>;
      this.db.run(
        `UPDATE event_pair_runs
       SET status = 'closed',
           close_event_id = ?,
           closed_at = ?,
           note = COALESCE(note, ?)
       WHERE status IN ('open', 'orphan')
         AND pair_name = ?
         AND correlation_key = ?`,
        [closeEventId, closedAt, `closed by ${eventType}`, pair.name, key],
      );
      for (const row of rows) {
        persistEventClosure(this.db, closeEventId, Number(row.open_event_id), pair.name, closedAt);
      }
    }
  }

  private sweepStalePairs(now: number): void {
    try {
      this.db.run(
        `UPDATE event_pair_runs
         SET status = 'orphan',
             note = COALESCE(note, 'expected closing event did not arrive before timeout')
         WHERE status = 'open'
           AND expected_close_at < ?`,
        [now],
      );
    } catch {
      /* best-effort orphan marking */
    }
  }

  private sweepUnacceptedEvents(now: number): void {
    try {
      const terminalRows = this.db
        .prepare(
          `SELECT id, event_type, data
           FROM events
           WHERE delivery_status IN ('pending', 'unhandled')
             AND timestamp >= ?
             AND timestamp + COALESCE(ttl_ms, ?) < ?
           LIMIT 500`,
        )
        .all(this.deliveryTrackingStartedAt, DEFAULT_UNACCEPTED_TTL_MS, now);
      for (const row of terminalRows) {
        if (!isTerminalNoopEvent(row.event_type, parseStoredEventData(row.data))) {
          continue;
        }
        this.db.run(
          `UPDATE events
           SET delivery_status = 'accepted',
               accepted_by = COALESCE(accepted_by, 'terminal-noop'),
               accepted_at = COALESCE(accepted_at, ?),
               delivery_route = COALESCE(delivery_route, 'noop'),
               delivery_note = COALESCE(delivery_note, 'terminal lifecycle fact accepted as no-op')
           WHERE id = ?
             AND delivery_status IN ('pending', 'unhandled')`,
          [now, row.id],
        );
      }

      this.db.run(
        `UPDATE events
         SET delivery_status = 'unhandled',
             delivery_note = COALESCE(delivery_note, 'no responsible consumer accepted event before timeout')
         WHERE delivery_status = 'pending'
           AND timestamp >= ?
           AND timestamp + COALESCE(ttl_ms, ?) < ?`,
        [this.deliveryTrackingStartedAt, DEFAULT_UNACCEPTED_TTL_MS, now],
      );
    } catch {
      /* best-effort delivery sweep */
    }
  }
}
