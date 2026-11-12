import type { SqliteDb } from "../../../lib/db.js";
import { describeText, readJsonArtifactWithDescriptor } from "../../../lib/artifacts.js";
import { readEventTraceMetadata } from "../../../lib/db/event-traces.js";
import {
  EVENT_DELIVERY_RESULT,
  EVENT_RECORD_ONLY,
  EVENT_ROW_ID,
  eventData,
  type AgentEvent,
  type EventBus,
} from "./bus.js";

function parseStoredEventData(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The document preserves semantic metadata; SQL correlation columns are search projections. */
export function readPersistedEventEnvelope(value: unknown, eventType: string): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  const envelope = parseStoredEventData(value);
  if (!envelope || typeof envelope.type !== "string" || !envelope.type.trim()) {
    throw new Error("Stored event envelope must be an object with an event type");
  }
  // Admission plans and delivery contracts are selected by this indexed identity.
  if (envelope.type !== eventType) throw new Error("Stored event envelope type disagrees with its record");
  for (const key of ["source", "owner"]) {
    if (envelope[key] !== null && typeof envelope[key] !== "string") {
      throw new Error(`Stored event envelope ${key} must be a string or null`);
    }
  }
  if (typeof envelope.timestamp !== "number" || !Number.isFinite(envelope.timestamp)) {
    throw new Error("Stored event envelope timestamp must be finite");
  }
  if (typeof envelope.urgency !== "string" || !["low", "normal", "high", "immediate"].includes(envelope.urgency)) {
    throw new Error("Stored event envelope urgency is invalid");
  }
  if (envelope.action !== undefined && typeof envelope.action !== "string") {
    throw new Error("Stored event envelope action must be a string");
  }
  if (envelope.ttl_ms !== undefined && (typeof envelope.ttl_ms !== "number" || !Number.isFinite(envelope.ttl_ms))) {
    throw new Error("Stored event envelope ttl_ms must be finite");
  }
  if (envelope.target !== undefined &&
    (!envelope.target || typeof envelope.target !== "object" || Array.isArray(envelope.target))) {
    throw new Error("Stored event envelope target must be an object");
  }
  const target = envelope.target as Record<string, unknown> | undefined;
  for (const key of ["appId", "project", "taskId", "executionId", "sessionId", "metricId", "owner", "human"]) {
    const field = target?.[key];
    if (field !== undefined && (key === "human" ? typeof field !== "boolean" : typeof field !== "string")) {
      throw new Error(`Stored event envelope target.${key} has an invalid type`);
    }
  }
  return envelope;
}

/** Rebuild the immutable event input needed to finish a plan after restart. */
export function loadPersistedEvent(db: SqliteDb, eventId: number, persistDir?: string): AgentEvent | null {
  const row = db
    .prepare(
      `SELECT event_type, source, owner, data, envelope_json, body_ref, body_sha256, body_bytes,
              timestamp, urgency, ttl_ms, record_only
       FROM events
       WHERE id = ?`,
    )
    .get(eventId);
  if (!row || typeof row.event_type !== "string") return null;
  let envelope: Record<string, unknown> | undefined;
  try {
    envelope = readPersistedEventEnvelope(row.envelope_json, row.event_type);
  } catch {
    return null;
  }

  let data: unknown;
  if (typeof row.body_ref === "string" && row.body_ref.trim()) {
    if (!persistDir) return null;
    const artifact = readJsonArtifactWithDescriptor<Record<string, unknown>>(persistDir, row.body_ref);
    if (
      artifact &&
      (row.body_sha256 == null || artifact.descriptor.sha256 === row.body_sha256) &&
      (row.body_bytes == null || artifact.descriptor.bytes === Number(row.body_bytes))
    ) {
      data = artifact.value;
    } else return null; // Never replay a truncated projection as the original input.
  } else {
    if (typeof row.data !== "string") return null;
    // DbWriter describes inline JSON with a trailing newline, like artifacts.
    const descriptor = describeText("", `${row.data}\n`);
    if (
      (row.body_sha256 != null && descriptor.sha256 !== row.body_sha256) ||
      (row.body_bytes != null && descriptor.bytes !== Number(row.body_bytes))
    )
      return null;
    data = parseStoredEventData(row.data);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as Record<string, unknown>;
  const event = {
    // Old rows retain their known fields, never a guessed address or action.
    ...(envelope ?? {
      type: row.event_type,
      ...(typeof row.source === "string" ? { source: row.source } : {}),
      ...(typeof row.owner === "string" ? { owner: row.owner } : {}),
      ...(typeof row.timestamp === "number" ? { timestamp: row.timestamp } : {}),
      ...(typeof row.urgency === "string" ? { urgency: row.urgency } : {}),
      ...(typeof row.ttl_ms === "number" ? { ttl_ms: row.ttl_ms } : {}),
    }),
    data: payload,
    ...readEventTraceMetadata(db, eventId),
  } as AgentEvent;
  Object.defineProperty(event, EVENT_ROW_ID, { value: eventId, configurable: true });
  Object.defineProperty(event, EVENT_RECORD_ONLY, { value: row.record_only === 1, configurable: true });
  return event;
}

/** Resume a previously recorded Telegram input without rebuilding its payload from current focus. */
export function resumeRecordedTelegramInput(
  db: SqliteDb,
  bus: EventBus,
  options: { type: string; idempotencyKey: string; persistDir?: string; requireAccepted?: boolean },
): number | undefined {
  const row = db
    .prepare(
      "SELECT id, delivery_status FROM events WHERE event_type = ? AND source = 'telegram' AND idempotency_key = ? LIMIT 1",
    )
    .get(options.type, options.idempotencyKey);
  if (!row) return undefined;
  const requireAccepted = options.requireAccepted ?? true;
  if (requireAccepted && (row.delivery_status !== "accepted" || options.type === "runtime.reload.requested")) {
    const event = loadPersistedEvent(db, Number(row.id), options.persistDir);
    if (!event) throw new Error("Original Telegram event is unavailable; input remains unacknowledged");
    const retried = bus.redeliverPersisted(event, Number(row.id));
    if (!retried[EVENT_DELIVERY_RESULT]?.accepted) {
      throw new Error("Telegram input is recorded but not yet admitted");
    }
  }
  return Number(row.id);
}

/** Read a durable reload completion summary for a previously recorded Telegram reload request. */
export function readPersistedTelegramReloadCompletion(
  db: SqliteDb,
  options: { idempotencyKey: string; persistDir?: string },
): { id: number; summary: string } | undefined {
  const completion = db
    .prepare(
      `
      SELECT e.id FROM events request
      JOIN event_traces t ON t.parent_event_id = request.id
      JOIN events e ON e.id = t.event_id
      WHERE request.event_type = 'runtime.reload.requested'
        AND request.source = 'telegram' AND request.idempotency_key = ?
        AND e.event_type = 'runtime.reload.finished'
      ORDER BY e.id DESC LIMIT 1
    `,
    )
    .get(options.idempotencyKey);
  if (!completion) return undefined;
  const event = loadPersistedEvent(db, Number(completion.id), options.persistDir);
  if (!event) throw new Error("Saved reload result is unavailable");
  return {
    id: Number(completion.id),
    summary: String(eventData(event).summary || "[reload] Finished"),
  };
}

