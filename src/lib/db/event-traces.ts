import type { SqliteDb } from "../db.js";

export type EventTraceLinkType = "reference" | "closure";

export type EventTraceInput = {
  traceId: string;
  parentEventId?: number;
  links?: Array<{
    eventId: number;
    type?: EventTraceLinkType;
    label?: string;
  }>;
};

/** Restore causal context from its existing authority before continuing an event. */
export function readEventTraceMetadata(db: SqliteDb, eventId: number): {
  trace?: EventTraceInput;
  visibility?: "default" | "detail";
} {
  const row = db.prepare("SELECT trace_id, parent_event_id, visibility FROM event_traces WHERE event_id = ?").get(eventId);
  if (!row || typeof row.trace_id !== "string") return {};
  const links = db.prepare(`SELECT to_event_id, type, label FROM event_trace_links
    WHERE from_event_id = ? ORDER BY id`).all(eventId).map((link) => ({
    eventId: Number(link.to_event_id),
    type: linkType(link.type),
    ...(typeof link.label === "string" && link.label ? { label: link.label } : {}),
  }));
  return {
    trace: {
      traceId: row.trace_id,
      ...(typeof row.parent_event_id === "number" ? { parentEventId: row.parent_event_id } : {}),
      ...(links.length ? { links } : {}),
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

function linkType(value: unknown): EventTraceLinkType {
  return value === "closure" ? "closure" : "reference";
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

function isEscalationClosureEvent(type: string | undefined): boolean {
  return type === "escalation.resolved" || type === "escalation.dismissed";
}

function findPriorEscalationCreated(db: SqliteDb, escalationId: string, eventId: number): number | undefined {
  const row = db
    .prepare(
      `SELECT id
     FROM events
     WHERE event_type = 'escalation.created'
       AND id != ?
       AND escalation_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    )
    .get(eventId, escalationId) as { id?: unknown } | null;
  return positiveInteger(row?.id);
}

function hasDeclaredLink(
  trace: EventTraceInput | undefined,
  eventId: number | undefined,
  type?: EventTraceLinkType,
): boolean {
  if (!trace?.links || !eventId) return false;
  return trace.links.some((link) => link.eventId === eventId && (!type || (link.type ?? "reference") === type));
}

export function parseEventTrace(value: unknown): EventTraceInput | undefined {
  if (!isRecord(value)) return undefined;
  const traceId = nonEmptyString(value.traceId);
  if (!traceId) return undefined;
  const parentEventId = positiveInteger(value.parentEventId);
  const links = Array.isArray(value.links)
    ? value.links.flatMap((item) => {
        if (!isRecord(item)) return [];
        const eventId = positiveInteger(item.eventId);
        if (!eventId) return [];
        return [
          {
            eventId,
            type: linkType(item.type),
            label: nonEmptyString(item.label),
          },
        ];
      })
    : undefined;
  return { traceId, ...(parentEventId ? { parentEventId } : {}), ...(links?.length ? { links } : {}) };
}

export function eventVisibility(event: unknown): "default" | "detail" {
  if (!isRecord(event)) return "default";
  return event.visibility === "detail" ? "detail" : "default";
}

export function persistEventTrace(db: SqliteDb, event: unknown, eventId: number, createdAt: number): void {
  if (!Number.isInteger(eventId) || eventId <= 0) return;
  const record = isRecord(event) ? event : {};
  const data = eventDataRecord(record);
  const eventType = nonEmptyString(record.type);
  const trace = parseEventTrace(record.trace);
  const openEventId = dataEventId(data, ["openEventId", "open_event_id"]);
  const escalationId = nonEmptyString(data.escalationId);
  const escalationCreatedId =
    escalationId && isEscalationClosureEvent(eventType)
      ? findPriorEscalationCreated(db, escalationId, eventId)
      : undefined;
  const inferredParentEventId = eventExists(db, openEventId)
    ? openEventId
    : eventExists(db, escalationCreatedId)
      ? escalationCreatedId
      : undefined;
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

  for (const link of trace?.links ?? []) {
    if (!eventExists(db, link.eventId)) continue;
    db.run(
      `INSERT OR IGNORE INTO event_trace_links
       (from_event_id, to_event_id, type, label, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [eventId, link.eventId, link.type ?? "reference", link.label ?? "", createdAt],
    );
  }

  if (openEventId && eventExists(db, openEventId) && !hasDeclaredLink(trace, openEventId, "closure")) {
    db.run(
      `INSERT OR IGNORE INTO event_trace_links
       (from_event_id, to_event_id, type, label, created_at)
       VALUES (?, ?, 'closure', ?, ?)`,
      [eventId, openEventId, eventType ?? "openEventId", createdAt],
    );
  }

  if (
    escalationCreatedId &&
    eventExists(db, escalationCreatedId) &&
    !hasDeclaredLink(trace, escalationCreatedId, "closure")
  ) {
    db.run(
      `INSERT OR IGNORE INTO event_trace_links
       (from_event_id, to_event_id, type, label, created_at)
       VALUES (?, ?, 'closure', ?, ?)`,
      [
        eventId,
        escalationCreatedId,
        eventType ?? "escalation.followup",
        createdAt,
      ],
    );
  }
}

/**
 * Make a live lifecycle close authoritative in the trace graph.
 *
 * This is intentionally separate from historical backfill: callers use it in
 * the same transaction that records the closing event and updates the pair.
 */
export function persistEventClosure(
  db: SqliteDb,
  closeEventId: number,
  openEventId: number,
  label: string,
  createdAt: number,
): void {
  if (!eventExists(db, closeEventId) || !eventExists(db, openEventId)) return;
  const traceId = eventTraceId(db, openEventId);
  db.run(
    `UPDATE event_traces
     SET trace_id = ?,
         parent_event_id = COALESCE(parent_event_id, ?)
     WHERE event_id = ?`,
    [traceId, openEventId, closeEventId],
  );
  const existing = db
    .prepare(
      `SELECT 1 AS found
     FROM event_trace_links
     WHERE from_event_id = ?
       AND to_event_id = ?
       AND type = 'closure'
     LIMIT 1`,
    )
    .get(closeEventId, openEventId) as { found?: unknown } | null;
  if (!existing) {
    db.run(
      `INSERT INTO event_trace_links
       (from_event_id, to_event_id, type, label, created_at)
       VALUES (?, ?, 'closure', ?, ?)`,
      [closeEventId, openEventId, label, createdAt],
    );
  }
}

