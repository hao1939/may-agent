import type { SqliteDb } from "../../../lib/db.js";
import { readJsonArtifactWithDescriptor } from "../../../lib/artifacts.js";
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

/** Rebuild the immutable event input needed to finish a plan after restart. */
export function loadPersistedEvent(db: SqliteDb, eventId: number, persistDir?: string): AgentEvent | null {
  const row = db
    .prepare(
      `SELECT event_type, source, owner, data, body_ref, body_sha256, body_bytes,
              session_id, project_id, task_id, timestamp, urgency, ttl_ms
       FROM events
       WHERE id = ?`,
    )
    .get(eventId);
  if (!row || typeof row.event_type !== "string") return null;

  let data = parseStoredEventData(row.data) ?? {};
  if (typeof row.body_ref === "string" && row.body_ref.trim()) {
    if (!persistDir) return null;
    const artifact = readJsonArtifactWithDescriptor<Record<string, unknown>>(persistDir, row.body_ref);
    if (
      artifact &&
      (!row.body_sha256 || artifact.descriptor.sha256 === row.body_sha256) &&
      (!row.body_bytes || artifact.descriptor.bytes === Number(row.body_bytes))
    ) {
      data = artifact.value;
    } else return null; // Never replay a truncated projection as the original input.
  }
  const appId =
    typeof data.appId === "string" && data.appId.trim()
      ? data.appId.trim()
      : typeof row.project_id === "string" && row.project_id.trim()
        ? row.project_id.trim()
        : undefined;
  const taskId = typeof row.task_id === "string" && row.task_id.trim() ? row.task_id.trim() : undefined;
  const sessionId = typeof row.session_id === "string" && row.session_id.trim() ? row.session_id.trim() : undefined;
  const target = { ...(appId ? { appId } : {}), ...(taskId ? { taskId } : {}), ...(sessionId ? { sessionId } : {}) };
  const event = {
    type: row.event_type,
    ...(typeof row.source === "string" ? { source: row.source } : {}),
    ...(typeof row.owner === "string" ? { owner: row.owner } : {}),
    ...(Object.keys(target).length > 0 ? { target } : {}),
    data,
    ...(typeof row.timestamp === "number" ? { timestamp: row.timestamp } : {}),
    ...(row.urgency === "low" || row.urgency === "normal" || row.urgency === "high" || row.urgency === "immediate"
      ? { urgency: row.urgency }
      : {}),
    ...(typeof row.ttl_ms === "number" ? { ttl_ms: row.ttl_ms } : {}),
  } as AgentEvent;
  Object.defineProperty(event, EVENT_ROW_ID, { value: eventId, configurable: true });
  return event;
}
