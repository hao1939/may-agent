/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * Core emits events; DbWriter persists the EventHub record and any exact
 * Task wake that must be atomic with it. Other resource owners persist their
 * own state in the same database.
 */

import { createHash } from "node:crypto";
import { isLiveOnlyEventType } from "../app/core/events/persistence-policy.js";
import { readTaskEventTarget } from "../app/core/events/task-target.js";
import { readPersistedEventEnvelope } from "../app/core/events/persisted.js";
import { recordTaskProgress } from "../app/core/tasks/task-progress-observations.js";
import {
  EVENT_APP_ADMISSION_REDELIVERY_REQUIRED,
  EVENT_DEDUPLICATED,
  EVENT_DELIVERY_RESULT,
  EVENT_INGRESS_SOURCE,
  EVENT_INTERFACE_INPUT,
  EVENT_RECORD_ONLY,
  EVENT_REDELIVERY_REQUIRED,
  EVENT_ROW_ID,
  EVENT_TASK_EMISSION_FENCE,
  type EventTaskEmissionFence,
  type AgentEvent,
  type DeliveryOutcome,
  type DeferredEventDelivery,
} from "../app/core/events/bus.js";
import { getDb } from "./db/connection.js";
import type { SqliteDb } from "./db.js";
import { isCanonicalEventEnvelope, isRecord } from "../../packages/control/src/event-envelope.js";
import { withSqliteBusyRetry } from "./db/busy-retry.js";
import { afterStateCommit, inStateTransaction, stateTransaction } from "./db/transaction.js";
import { persistEventTrace, readEventTraceMetadata } from "./db/event-traces.js";
import { advanceTaskResourceRevision } from "./db/task-resource-schema.js";
import { describeText, writeContentAddressedJson, type ArtifactDescriptor } from "./artifacts.js";
import { log } from "@may-agent/sdk/runtime";
import { applyMetricMutation } from "./db/metric-mutation.js";

/** Keep coordination rows small; full large bodies live in event-bodies/. */
const INLINE_EVENT_DATA_BYTES = 4_096;
const MAX_EVENT_PROJECTION_LENGTH = 12_000;

const DEFAULT_UNACCEPTED_TTL_MS = 2 * 60 * 1000;
export const EVENT_DELIVERY_HOUSEKEEPING_INTERVAL_MS = 30_000;

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
  const semanticInput = Boolean((event as AgentEvent & { [EVENT_INTERFACE_INPUT]?: unknown })[EVENT_INTERFACE_INPUT]);
  const canonical = isCanonicalEventEnvelope(record)
    ? {
        ...Object.fromEntries(
          Object.entries(record).filter(
            ([key]) =>
              key !== "data" &&
              key !== "timestamp" &&
              key !== "trace" &&
              (!semanticInput || (key !== "source" && key !== "owner")),
          ),
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
  if ((event as AgentEvent & { [EVENT_INTERFACE_INPUT]?: unknown })[EVENT_INTERFACE_INPUT]) {
    return "event-interface";
  }
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

/** Read-only confirmation of an interface publication using its exact identity and input. */
export function findPersistedEventId(db: SqliteDb, event: AgentEvent): number | undefined {
  const record = event as AgentEvent & Record<string, unknown>;
  const payload = eventPayload(record);
  const key = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : "";
  if (!key) return undefined;
  const target = isRecord(record.target) ? record.target : {};
  const source = eventSource(record);
  const owner = eventOwner(record);
  // The nonempty predicate lets SQLite use the existing partial unique index.
  const row = db.prepare(`SELECT id FROM events
    WHERE event_type = ? AND ingress_source = ? AND idempotency_scope = ?
      AND idempotency_key = ? AND idempotency_key != '' AND idempotency_hash = ?`).get(
    event.type, ingressSource(event, source), idempotencyScope(eventCorrelation({ ...payload, ...target }), owner),
    key, idempotencyHash(event, payload),
  ) as { id?: unknown } | undefined;
  const id = Number(row?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
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

export class DbWriter {
  private db: SqliteDb;
  private persistDir: string;
  private reconciledUnhandledAdmissionPlans = false;
  private lastHousekeepingAt = Date.now();
  private housekeepingIntervalMs: number;

  constructor(
    persistDir: string,
    opts: { housekeepingIntervalMs?: number; existingSchemaOnly?: boolean } = {},
  ) {
    this.persistDir = persistDir;
    this.db = getDb(persistDir, { existingSchemaOnly: opts.existingSchemaOnly });
    this.housekeepingIntervalMs = Math.max(0, opts.housekeepingIntervalMs ?? EVENT_DELIVERY_HOUSEKEEPING_INTERVAL_MS);
  }

  /** Subscribe this writer to an EventBus. */
  handler = (event: AgentEvent): DeferredEventDelivery | void => {
    // Keep transaction ordering for live observations too: rolled-back state
    // must not wake readers. All fan-out still runs through the EventBus.
    if (isLiveOnlyEventType(event.type)) {
      this.validateTaskEmissionFence(
        (event as AgentEvent & { [EVENT_TASK_EMISSION_FENCE]?: EventTaskEmissionFence })[EVENT_TASK_EMISSION_FENCE],
        Date.now(),
      );
      recordTaskProgress(this.db, event);
      if (inStateTransaction(this.db)) {
        return { afterCommit: (deliver) => afterStateCommit(this.db, deliver) };
      }
      return;
    }
    switch (event.type) {
      case "session.start":
      case "session.end":
      case "session.idle": {
        if (!isCanonicalEventEnvelope(event)) break;
        const payload = eventPayload(event);
        this.insertEventRow(event, payload, eventSource(event, payload.agent), eventOwner(event, payload.agent));
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

      case "metric.threshold_changed":
      case "metric.alert_resolved": {
        const payload = eventPayload(event as unknown as Record<string, unknown>);
        this.insertEventRow(event, payload, eventSource(event), eventOwner(event), undefined, undefined, () =>
          applyMetricMutation(this.db, event.type, payload, event.timestamp ?? Date.now()));
        break;
      }

      default:
        if (event.type.startsWith("trigger.")) {
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
          break;
        }
        return;
    }
    if (inStateTransaction(this.db)) {
      return { afterCommit: (deliver) => afterStateCommit(this.db, deliver) };
    }
  };

  recordDelivery = (event: AgentEvent, result: DeliveryOutcome): void => {
    const rowId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
    if (typeof rowId !== "number" || !Number.isFinite(rowId)) return;
    try {
      withSqliteBusyRetry(`record delivery outcome for event ${rowId}`, () => {
        const now = Date.now();
        stateTransaction(this.db, () => {
          if (!result.accepted) {
            // Storage-only acceptance does not cover a required route that fails
            // on retry. Reopen that receipt, preserving independent acceptance
            // and any failure that has already expired. App admission is separate.
            this.db.run(
              `UPDATE events
               SET delivery_status = CASE WHEN delivery_status = 'accepted' THEN 'pending' ELSE delivery_status END,
                   accepted_by = NULL, accepted_at = NULL,
                   delivery_route = 'direct', delivery_note = ?
               WHERE id = ? AND (delivery_status IN ('pending', 'unhandled')
                 OR (delivery_status = 'accepted' AND delivery_route = 'noop'))`,
              [result.note, rowId],
            );
            return;
          }
          this.db.run(
            `UPDATE events
             SET delivery_status = 'accepted',
                 accepted_by = ?,
                 accepted_at = ?,
                 delivery_route = ?,
                 delivery_note = ?
             WHERE id = ? AND (? != 'noop'
               OR (delivery_status = 'pending' AND delivery_route IS NOT 'direct')
               OR (delivery_status = 'accepted' AND delivery_route = 'noop')
               OR (delivery_status = 'unhandled' AND delivery_route IS NULL
                 AND record_only = 1))`,
            [
              result.by,
              now,
              result.route ?? "direct",
              result.note ?? null,
              rowId,
              result.route ?? "direct",
            ],
          );
          // Storage-only acceptance cannot replace a failed delivery or another
          // owner's receipt. App admission still acknowledges its independent
          // inspection, atomically, even when the global receipt is retained.
          if (result.appAdmission === true) {
            this.db.run("UPDATE events SET app_admission_pending = 0 WHERE id = ?", [rowId]);
          }
        });
      });
    } catch (error) {
      log(
        "warn",
        `[event-delivery] failed to record outcome for event ${rowId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  /** Live observations and journaled facts share the same attempt authority. */
  private validateTaskEmissionFence(emissionFence: EventTaskEmissionFence | undefined, timestamp: number): void {
    if (!emissionFence) return;
    const ownership = this.db
      .prepare(
        `SELECT t.generation, t.current_attempt_id, a.task_generation, a.state, a.lease_until,
                m.value AS authority
         FROM app_tasks t
         JOIN app_task_attempts a
           ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
         JOIN app_task_store_meta m
           ON m.app_id = t.app_id AND m.key = 'authority'
         WHERE t.app_id = ? AND t.task_id = ? AND a.attempt_id = ?`,
      )
      .get(emissionFence.appId, emissionFence.taskId, emissionFence.attemptId) as
      | {
          generation?: number;
          current_attempt_id?: string;
          task_generation?: number;
          state?: string;
          lease_until?: number | null;
          authority?: string;
        }
      | null;
    const leaseUntil = Number(ownership?.lease_until);
    if (
      ownership?.authority !== "resources" ||
      ownership?.generation !== emissionFence.taskGeneration ||
      ownership?.task_generation !== emissionFence.taskGeneration ||
      ownership?.current_attempt_id !== emissionFence.attemptId ||
      ownership?.state !== "running" ||
      !Number.isFinite(leaseUntil) ||
      leaseUntil <= timestamp
    ) {
      throw new Error(
        `Task emission fence rejected stale attempt ${emissionFence.attemptId} for ` +
          `${emissionFence.appId}/${emissionFence.taskId}@${emissionFence.taskGeneration}`,
      );
    }
  }

  private insertEventRow(
    event: AgentEvent,
    payload: Record<string, unknown>,
    source: string | null,
    owner: string | null,
    urgency = eventUrgency(event as Record<string, unknown>),
    ttlMs = eventTtlMs(event as Record<string, unknown>),
    project?: () => void,
  ): number | null {
    const timestamp = Date.now();
    // Prepare identity before taking our writer slot. An outer caller transaction
    // still owns its lock; unkeyed Events need no identity hash in either case.
    const persistedPayload = payload;
    const envelope = event as AgentEvent & { target?: unknown };
    const target =
      envelope.target && typeof envelope.target === "object" && !Array.isArray(envelope.target)
        ? (envelope.target as Record<string, unknown>)
        : {};
    // Routing and evidence correlation are independent. Retain the authored
    // target separately; a Task emission indexes its producer, not its destination.
    const emissionFence = (event as AgentEvent & { [EVENT_TASK_EMISSION_FENCE]?: EventTaskEmissionFence })[
      EVENT_TASK_EMISSION_FENCE
    ];
    const observedCorrelation = eventCorrelation({ ...persistedPayload, ...target });
    const correlation = emissionFence
      ? {
          ...observedCorrelation,
          projectId: emissionFence.appId,
          taskId: emissionFence.taskId,
          attemptId: emissionFence.attemptId,
        }
      : observedCorrelation;
    const idempotencyKey =
      typeof persistedPayload.idempotencyKey === "string" ? persistedPayload.idempotencyKey.trim() : "";
    const trustedIngressSource = ingressSource(event, source);
    const scope = idempotencyScope(correlation, owner);
    const inputHash = idempotencyKey ? idempotencyHash(event, persistedPayload) : null;
    const nested = inStateTransaction(this.db);
    const commit = () => this.db.exec(nested ? "RELEASE event_write" : "COMMIT");
    const rollback = () => {
      if (nested) {
        this.db.exec("ROLLBACK TO event_write");
        this.db.exec("RELEASE event_write");
      } else this.db.exec("ROLLBACK");
    };
    withSqliteBusyRetry(`persist event '${event.type}'`, () => {
      this.db.exec(nested ? "SAVEPOINT event_write" : "BEGIN IMMEDIATE");
    });
    try {
      if (idempotencyKey) {
        const existing = this.db
          .prepare(
            `SELECT e.id, e.idempotency_hash, e.delivery_status, e.accepted_by, e.delivery_route, e.app_admission_pending,
                    e.source, e.owner, e.timestamp, e.envelope_json, e.record_only
             FROM events e
             WHERE e.event_type = ?
               AND e.ingress_source = ?
               AND e.idempotency_scope = ?
               AND e.idempotency_key = ? AND e.idempotency_key != ''
             LIMIT 1`,
          )
          .get(event.type, trustedIngressSource, scope, idempotencyKey) as
          | {
              id?: unknown;
              idempotency_hash?: unknown;
              delivery_status?: unknown;
              accepted_by?: unknown;
              delivery_route?: unknown;
              app_admission_pending?: unknown;
              source?: unknown;
              owner?: unknown;
              timestamp?: unknown;
              envelope_json?: unknown;
              record_only?: unknown;
            }
          | undefined;
        const existingId = Number(existing?.id);
        if (Number.isInteger(existingId) && existingId > 0) {
          if (existing?.idempotency_hash !== inputHash) {
            throw new Error(`Idempotency key ${idempotencyKey} was already used with different event input`);
          }
          const retryEvent = event as AgentEvent & Record<string, unknown> & {
            [EVENT_REDELIVERY_REQUIRED]?: boolean;
            [EVENT_APP_ADMISSION_REDELIVERY_REQUIRED]?: boolean;
          };
          const metadata = readPersistedEventEnvelope(existing.envelope_json, event.type) ?? existing;
          if (typeof metadata.source === "string") retryEvent.source = metadata.source;
          if (typeof metadata.owner === "string") retryEvent.owner = metadata.owner;
          if (typeof metadata.timestamp === "number") retryEvent.timestamp = metadata.timestamp;
          // Publication intent belongs to the original saved Event. A keyed
          // retry cannot turn a required delivery into an optional observation.
          Object.defineProperty(event, EVENT_RECORD_ONLY, { value: existing.record_only === 1, configurable: true });
          // Authored fields already matched the saved hash. Restore causality
          // without adding defaults that would change a subsequent retry's input.
          const { trace } = readEventTraceMetadata(this.db, existingId);
          if (trace) event.trace = trace;
          Object.defineProperty(event, EVENT_ROW_ID, { value: existingId, configurable: true });
          Object.defineProperty(event, EVENT_DEDUPLICATED, { value: true, configurable: true });
          if (
            existing.app_admission_pending !== 1 &&
            existing.delivery_status === "accepted" &&
            typeof existing.accepted_by === "string" &&
            existing.delivery_route !== "noop"
          ) {
            const route = existing.delivery_route === "direct" ? existing.delivery_route : undefined;
            Object.defineProperty(event, EVENT_DELIVERY_RESULT, {
              value: Object.freeze({ accepted: true, by: existing.accepted_by, ...(route ? { route } : {}) }),
              configurable: true,
            });
          }
          if (
            existing.app_admission_pending === 1 &&
            existing.delivery_status === "accepted" &&
            existing.delivery_route !== "noop"
          ) {
            // Global Event acceptance and App admission are independent receipts.
            // Limit this producer retry to the outstanding App route; unrelated
            // durable routes may already have performed their effects.
            if (!retryEvent[EVENT_REDELIVERY_REQUIRED]) {
              Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
            }
            if (!retryEvent[EVENT_APP_ADMISSION_REDELIVERY_REQUIRED]) {
              Object.defineProperty(event, EVENT_APP_ADMISSION_REDELIVERY_REQUIRED, {
                value: true,
                configurable: true,
              });
            }
          } else if (
            existing.delivery_status === "pending" ||
            existing.delivery_status === "unhandled" ||
            (existing.delivery_status === "accepted" && existing.delivery_route === "noop")
          ) {
            Object.defineProperty(event, EVENT_REDELIVERY_REQUIRED, { value: true, configurable: true });
          }
          // A prior direct acceptance is the receipt. A noop only proved
          // durable storage, so retry-safe routes may still acquire the fact.
          // In either case the producer mutation must never be replayed.
          commit();
          return existingId;
        }
      }
      this.validateTaskEmissionFence(emissionFence, timestamp);
      // A duplicate returns its receipt without new artifact I/O.
      const body = prepareEventBody(this.persistDir, persistedPayload);
      // Preserve envelope extensions without a column per field. Payload and
      // causal metadata already have their own durable representations.
      const { data: _data, trace: _trace, visibility: _visibility, ...metadata } =
        isCanonicalEventEnvelope(event) ? event as Record<string, unknown> : { type: event.type };
      const eventTimestamp = typeof metadata.timestamp === "number" && Number.isFinite(metadata.timestamp)
        ? metadata.timestamp : timestamp;
      const storedEnvelope = { ...metadata, type: event.type, source, owner, timestamp: eventTimestamp, urgency,
        ...(ttlMs !== null ? { ttl_ms: ttlMs } : {}) };
      const info = this.db.run(
        `INSERT INTO events
          (event_type, source, owner, data, envelope_json, body_ref, body_sha256, body_bytes,
           session_id, workflow_run_id, project_id, task_id, attempt_id, handler,
           metric_id, alert_id, subject_status, duration_ms,
           timestamp, urgency, ttl_ms, idempotency_key, idempotency_scope,
           idempotency_hash, ingress_source, record_only, app_admission_pending)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          event.type,
          source,
          owner,
          body.data,
          JSON.stringify(storedEnvelope),
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
          correlation.status,
          correlation.durationMs,
          timestamp,
          urgency,
          ttlMs,
          idempotencyKey || null,
          scope,
          idempotencyKey ? inputHash : null,
          trustedIngressSource,
          (event as AgentEvent & { [EVENT_RECORD_ONLY]?: boolean })[EVENT_RECORD_ONLY] === true ? 1 : 0,
        ],
      );
      const rowId = Number(info.lastInsertRowid);
      if (!Number.isFinite(rowId) || rowId <= 0) {
        rollback();
        return null;
      }
      try {
        // Live routes and recovery share envelope time; keep explicit producer time.
        (event as AgentEvent & { timestamp?: number }).timestamp = eventTimestamp;
        Object.defineProperty(event, EVENT_ROW_ID, {
          value: rowId,
          configurable: true,
        });
      } catch (error) {
        throw new Error(`Persisted event ${rowId} cannot expose its durable receipt`, { cause: error });
      }
      persistEventTrace(this.db, event, rowId);
      if (emissionFence) this.persistExactTaskWake(event, target, rowId, timestamp);
      project?.();
      commit();
      return rowId;
    } catch (error) {
      try {
        rollback();
      } catch {
        /* preserve the original persistence error */
      }
      throw error;
    }
  }

  /** Persist an exact resource-backed target wake before EventBus fan-out. */
  private persistExactTaskWake(
    event: AgentEvent,
    target: Record<string, unknown>,
    eventId: number,
    observedAt: number,
  ): void {
    const address = readTaskEventTarget(target);
    if (!address?.appId) return;
    const { appId, taskId } = address;
    const authority = this.db
      .prepare("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'")
      .get(appId) as { value?: string } | null;
    if (authority?.value !== "resources") return;
    const row = this.db
      .prepare("SELECT generation, trigger_json FROM app_tasks WHERE app_id = ? AND task_id = ?")
      .get(appId, taskId) as { generation?: number; trigger_json?: string | null } | null;
    if (!row || !Number.isInteger(row.generation)) {
      throw new Error(`Task emission target does not exist: ${appId}/${taskId}`);
    }
    const canonical = {
      ...(event as unknown as Record<string, unknown>),
      eventId,
    };
    const previous = (() => {
      try {
        return row.trigger_json ? (JSON.parse(row.trigger_json) as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    })();
    const previousEvents = Array.isArray(previous?.events)
      ? (previous.events as Array<Record<string, unknown>>)
      : previous?.event
        ? [{ event: previous.event, observedAt: previous.observedAt }]
        : [];
    const observedAtIso = new Date(observedAt).toISOString();
    const events = [...previousEvents, { event: canonical, observedAt: observedAtIso }];
    const trigger = {
      taskId,
      taskGeneration: row.generation,
      resourceVersion: Number(previous?.resourceVersion ?? 0) + 1,
      events,
      event: canonical,
      observedAt: observedAtIso,
    };
    this.db
      .prepare(
        `INSERT OR IGNORE INTO app_task_events(app_id, task_id, event_key, observed_at, event_json)
       VALUES (?, ?, ?, ?, ?)`,
      )
      .run(appId, taskId, `event:${eventId}`, observedAt, "{}");
    this.db.prepare(
      `UPDATE app_tasks
       SET changed = 1, ready = 1, trigger_json = ?, updated_at = ?,
           resource_version = resource_version + 1,
           resource_json = json_set(resource_json, '$.metadata.resourceVersion', resource_version + 1)
       WHERE app_id = ? AND task_id = ?`,
    ).run(JSON.stringify(trigger), observedAt, appId, taskId);
    advanceTaskResourceRevision(this.db, appId);
  }

  /** Run periodic delivery repair outside the event-persistence path. */
  runHousekeeping(now = Date.now()): void {
    if (now - this.lastHousekeepingAt < this.housekeepingIntervalMs) return;
    this.lastHousekeepingAt = now;
    this.sweepUnacceptedEvents(now);
  }

  private sweepUnacceptedEvents(now: number): void {
    try {
      // Acceptance is recorded by delivery, never inferred from a terminal
      // payload: even a completed session can have a failed required consumer.
      // Every prospective Event has an admission marker (1 pending, 0 inspected).
      // Its presence, or a saved pending plan, establishes tracked delivery even
      // after restart. Null legacy rows without a plan retain their uncertainty.
      const newlyUnhandled = this.db.run(
        `UPDATE events
         SET delivery_status = 'unhandled',
             delivery_note = COALESCE(delivery_note, 'no responsible consumer accepted event before timeout')
         WHERE delivery_status = 'pending'
           AND timestamp + COALESCE(ttl_ms, ?) < ?
           AND (
             app_admission_pending IS NOT NULL
             OR EXISTS (
               SELECT 1 FROM app_event_admission_plans plan
               WHERE plan.event_id = events.id AND plan.status = 'pending'
             )
           )`,
        [DEFAULT_UNACCEPTED_TTL_MS, now],
      );

      // An unavailable exact target never accepted the requested update and can
      // expire. Broad App routing already owns admission, even if the process
      // stopped before recording global Event acceptance. Keep that independent
      // obligation recoverable instead of discarding it with the Event receipt.
      if (this.reconciledUnhandledAdmissionPlans && newlyUnhandled.changes === 0) {
        return;
      }
      this.reconciledUnhandledAdmissionPlans = true;
      this.db.run(
        `UPDATE app_event_admission_commands
         SET status = 'superseded',
             last_error = COALESCE(last_error, 'origin event became unhandled before App admission'),
             updated_at = ?
         WHERE status = 'pending' AND route_kind = 'exact-task'
           AND event_id IN (
             SELECT id FROM events WHERE delivery_status = 'unhandled'
           )`,
        [now],
      );
      this.db.run(
        `UPDATE app_event_admission_plans
         SET status = 'superseded',
             last_error = COALESCE(last_error, 'origin event became unhandled before App admission'),
             completed_at = COALESCE(completed_at, ?),
             updated_at = ?
         WHERE status = 'pending'
           AND event_id IN (
             SELECT id FROM events WHERE delivery_status = 'unhandled'
           )
           AND EXISTS (
             SELECT 1 FROM app_event_admission_commands command
             WHERE command.event_id = app_event_admission_plans.event_id
               AND command.status = 'superseded'
           )
           AND NOT EXISTS (
             SELECT 1 FROM app_event_admission_commands command
             WHERE command.event_id = app_event_admission_plans.event_id
               AND command.status = 'pending'
           )`,
        [now, now],
      );
    } catch {
      /* best-effort delivery sweep */
    }
  }
}
