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

export type EventTraceIntegrity = {
  eventCount: number;
  traceCount: number;
  linkCount: number;
  danglingTraceCount: number;
  missingTraceCount: number;
  danglingParentCount: number;
  danglingLinkCount: number;
  invalidVisibilityCount: number;
  invalidLinkTypeCount: number;
  ok: boolean;
};

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

export function persistEventTrace(
  db: SqliteDb,
  event: unknown,
  eventId: number,
  createdAt: number,
): void {
  if (!Number.isInteger(eventId) || eventId <= 0) return;
  const record = isRecord(event) ? event : {};
  const trace = parseEventTrace(record.trace);
  const traceId = trace?.traceId ?? `event:${eventId}`;
  const parentEventId = eventExists(db, trace?.parentEventId) ? trace!.parentEventId! : null;
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
}

function cleanupInvalidTraceRows(db: SqliteDb): number {
  const cleanupDanglingTraces = db.run(
    `DELETE FROM event_traces
     WHERE event_id NOT IN (SELECT id FROM events)`,
  );
  const cleanupDanglingParents = db.run(
    `UPDATE event_traces
     SET parent_event_id = NULL
     WHERE parent_event_id IS NOT NULL
       AND parent_event_id NOT IN (SELECT id FROM events)`,
  );
  const cleanupDanglingLinks = db.run(
    `DELETE FROM event_trace_links
     WHERE from_event_id NOT IN (SELECT id FROM events)
        OR to_event_id NOT IN (SELECT id FROM events)`,
  );
  return (
    (cleanupDanglingTraces.changes ?? 0) +
    (cleanupDanglingParents.changes ?? 0) +
    (cleanupDanglingLinks.changes ?? 0)
  );
}

export function backfillEventPairTraces(db: SqliteDb, options: { limit?: number; createdAt?: number } = {}): number {
  const limit = Number.isInteger(options.limit) && options.limit! > 0 ? options.limit! : 100_000;
  const createdAt = options.createdAt ?? Date.now();
  const cleaned = cleanupInvalidTraceRows(db);
  const baseline = db.run(
    `INSERT OR IGNORE INTO event_traces
     (event_id, trace_id, parent_event_id, visibility)
     SELECT id, 'event:' || id, NULL, 'default'
     FROM events`,
  );
  db.exec("DROP TABLE IF EXISTS temp_event_pair_trace_backfill");
  db.exec(
    `CREATE TEMP TABLE temp_event_pair_trace_backfill AS
     SELECT p.close_event_id, p.open_event_id, COALESCE(p.pair_name, 'event_pair') as pair_name
     FROM event_pair_runs p
     JOIN events open_event ON open_event.id = p.open_event_id
     JOIN events close_event ON close_event.id = p.close_event_id
     JOIN (
       SELECT close_event_id, MIN(id) as id
       FROM (
         SELECT p.id, p.close_event_id
         FROM event_pair_runs p
         JOIN events open_event ON open_event.id = p.open_event_id
         JOIN events close_event ON close_event.id = p.close_event_id
         WHERE p.open_event_id IS NOT NULL
           AND p.close_event_id IS NOT NULL
         ORDER BY p.id
         LIMIT ${limit}
       )
       GROUP BY close_event_id
     ) picked ON picked.id = p.id`,
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_temp_event_pair_trace_close ON temp_event_pair_trace_backfill(close_event_id)");
  const closeTraceInsert = db.run(
    `INSERT OR IGNORE INTO event_traces
     (event_id, trace_id, parent_event_id, visibility)
     SELECT close_event_id, 'event:' || open_event_id, open_event_id, 'default'
     FROM temp_event_pair_trace_backfill`,
  );
  const closeTraceUpdate = db.run(
    `UPDATE event_traces
     SET trace_id = (
           SELECT 'event:' || p.open_event_id
           FROM temp_event_pair_trace_backfill p
           WHERE p.close_event_id = event_traces.event_id
         ),
         parent_event_id = (
           SELECT p.open_event_id
           FROM temp_event_pair_trace_backfill p
           WHERE p.close_event_id = event_traces.event_id
         )
     WHERE parent_event_id IS NULL
       AND trace_id = 'event:' || event_id
       AND EXISTS (
         SELECT 1
         FROM temp_event_pair_trace_backfill p
         WHERE p.close_event_id = event_traces.event_id
       )`,
  );
  const linkInsert = db.run(
    `INSERT OR IGNORE INTO event_trace_links
     (from_event_id, to_event_id, type, label, created_at)
     SELECT close_event_id, open_event_id, 'closure', pair_name, ?
     FROM temp_event_pair_trace_backfill`,
    [createdAt],
  );
  db.exec("DROP TABLE IF EXISTS temp_event_pair_trace_backfill");
  return (
    cleaned +
    (baseline.changes ?? 0) +
    (closeTraceInsert.changes ?? 0) +
    (closeTraceUpdate.changes ?? 0) +
    (linkInsert.changes ?? 0)
  );
}

function count(db: SqliteDb, sql: string): number {
  const row = db.prepare(sql).get() as { c?: unknown } | null;
  const value = typeof row?.c === "number" ? row.c : Number(row?.c);
  return Number.isFinite(value) ? value : 0;
}

export function checkEventTraceIntegrity(db: SqliteDb): EventTraceIntegrity {
  const result = {
    eventCount: count(db, "SELECT COUNT(*) as c FROM events"),
    traceCount: count(db, "SELECT COUNT(*) as c FROM event_traces"),
    linkCount: count(db, "SELECT COUNT(*) as c FROM event_trace_links"),
    danglingTraceCount: count(
      db,
      `SELECT COUNT(*) as c
       FROM event_traces t
       LEFT JOIN events e ON e.id = t.event_id
       WHERE e.id IS NULL`,
    ),
    missingTraceCount: count(
      db,
      `SELECT COUNT(*) as c
       FROM events e
       LEFT JOIN event_traces t ON t.event_id = e.id
       WHERE t.event_id IS NULL`,
    ),
    danglingParentCount: count(
      db,
      `SELECT COUNT(*) as c
       FROM event_traces t
       LEFT JOIN events e ON e.id = t.parent_event_id
       WHERE t.parent_event_id IS NOT NULL
         AND e.id IS NULL`,
    ),
    danglingLinkCount: count(
      db,
      `SELECT COUNT(*) as c
       FROM event_trace_links l
       LEFT JOIN events f ON f.id = l.from_event_id
       LEFT JOIN events t ON t.id = l.to_event_id
       WHERE f.id IS NULL OR t.id IS NULL`,
    ),
    invalidVisibilityCount: count(
      db,
      `SELECT COUNT(*) as c
       FROM event_traces
       WHERE visibility NOT IN ('default', 'detail')`,
    ),
    invalidLinkTypeCount: count(
      db,
      `SELECT COUNT(*) as c
       FROM event_trace_links
       WHERE type NOT IN ('reference', 'closure')`,
    ),
    ok: false,
  };
  result.ok =
    result.danglingTraceCount === 0 &&
    result.missingTraceCount === 0 &&
    result.danglingParentCount === 0 &&
    result.danglingLinkCount === 0 &&
    result.invalidVisibilityCount === 0 &&
    result.invalidLinkTypeCount === 0;
  return result;
}
