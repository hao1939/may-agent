import type { SqliteDb } from "../../../lib/db.js";
import { describeText, readJsonArtifactWithDescriptor } from "../../../lib/artifacts.js";
import { readEventTraceMetadata } from "../../../lib/db/event-traces.js";
import { EVENT_ROW_ID, type AgentEvent } from "./bus.js";

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
export function readPersistedEventEnvelope(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  const envelope = parseStoredEventData(value);
  if (!envelope || typeof envelope.type !== "string" || !envelope.type.trim()) {
    throw new Error("Stored event envelope must be an object with an event type");
  }
  if (envelope.target !== undefined &&
    (!envelope.target || typeof envelope.target !== "object" || Array.isArray(envelope.target))) {
    throw new Error("Stored event envelope target must be an object");
  }
  return envelope;
}

/** Rebuild the immutable event input needed to finish a plan after restart. */
export function loadPersistedEvent(db: SqliteDb, eventId: number, persistDir?: string): AgentEvent | null {
  const row = db
    .prepare(
      `SELECT event_type, source, owner, data, envelope_json, body_ref, body_sha256, body_bytes,
              timestamp, urgency, ttl_ms
       FROM events
       WHERE id = ?`,
    )
    .get(eventId);
  if (!row || typeof row.event_type !== "string") return null;
  let envelope: Record<string, unknown> | undefined;
  try {
    envelope = readPersistedEventEnvelope(row.envelope_json);
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
  return event;
}
