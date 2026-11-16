import type { SqliteDb } from "../db.js";

export type EventTraceInput = {
  traceId: string;
  parentEventId?: number;
};

/** Restore causal context from its existing authority before continuing an event. */
export function readEventTraceMetadata(db: SqliteDb, eventId: number): {
  trace?: EventTraceInput;
  visibility?: "default" | "detail";
} {
  const row = db.prepare("SELECT trace_id, parent_event_id, visibility FROM event_traces WHERE event_id = ?").get(eventId);
  if (!row || typeof row.trace_id !== "string") return {};
  return {
    trace: {
      traceId: row.trace_id,
      ...(typeof row.parent_event_id === "number" ? { parentEventId: row.parent_event_id } : {}),
    },
    visibility: row.visibility === "detail" ? "detail" : "default",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function eventExists(db: SqliteDb, eventId: number | undefined): eventId is number {
  if (!eventId) return false;
  const row = db.prepare("SELECT 1 as found FROM events WHERE id = ?").get(eventId) as { found?: unknown } | null;
  return !!row;
}

function eventTraceId(db: SqliteDb, eventId: number): string {
  const row = db.prepare("SELECT trace_id FROM event_traces WHERE event_id = ?").get(eventId) as {
    trace_id?: unknown;
  } | null;
  return nonEmptyString(row?.trace_id) ?? `event:${eventId}`;
}

function eventDataRecord(event: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(event.data)) return event.data;
  return event;
}

function dataEventId(data: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = positiveInteger(data[key]);
    if (value) return value;
  }
  return undefined;
}

export function parseEventTrace(value: unknown): EventTraceInput | undefined {
  if (!isRecord(value)) return undefined;
  const traceId = nonEmptyString(value.traceId);
  if (!traceId) return undefined;
  const parentEventId = positiveInteger(value.parentEventId);
  return { traceId, ...(parentEventId ? { parentEventId } : {}) };
}

export function eventVisibility(event: unknown): "default" | "detail" {
  if (!isRecord(event)) return "default";
  return event.visibility === "detail" ? "detail" : "default";
}

export function persistEventTrace(db: SqliteDb, event: unknown, eventId: number): void {
  if (!Number.isInteger(eventId) || eventId <= 0) return;
  const record = isRecord(event) ? event : {};
  const data = eventDataRecord(record);
  const trace = parseEventTrace(record.trace);
  const openEventId = dataEventId(data, ["openEventId", "open_event_id"]);
  const inferredParentEventId = eventExists(db, openEventId) ? openEventId : undefined;
  const traceId =
    trace?.traceId ?? (inferredParentEventId ? eventTraceId(db, inferredParentEventId) : `event:${eventId}`);
  const parentEventId = eventExists(db, trace?.parentEventId) ? trace!.parentEventId! : (inferredParentEventId ?? null);
  const visibility = eventVisibility(record);

  db.run(
    `INSERT OR REPLACE INTO event_traces
     (event_id, trace_id, parent_event_id, visibility)
     VALUES (?, ?, ?, ?)`,
    [eventId, traceId, parentEventId, visibility],
  );
}
