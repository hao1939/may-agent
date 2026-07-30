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
  closedPairMissingClosureCount: number;
  pairTraceSplitCount: number;
  humanRootWithoutSingleIntentCount: number;
  humanResultUndeliveredCount: number;
  humanLinkedTaskWithoutCloseoutCount: number;
  bookkeepingOnlyAcceptanceCount: number;
  structuralOk: boolean;
  semanticOk: boolean;
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

function isEscalationFollowupEvent(type: string | undefined): boolean {
  return (
    isEscalationClosureEvent(type) ||
    type === "escalation.resume_attempted" ||
    type === "escalation.resume_started" ||
    type === "escalation.resume_failed"
  );
}

function findPriorEscalationCreated(db: SqliteDb, escalationId: string, eventId: number): number | undefined {
  const row = db.prepare(
    `SELECT id
     FROM events
     WHERE event_type = 'escalation.created'
       AND id != ?
       AND escalation_id = ?
     ORDER BY id DESC
     LIMIT 1`,
  ).get(eventId, escalationId) as { id?: unknown } | null;
  return positiveInteger(row?.id);
}

function hasDeclaredLink(trace: EventTraceInput | undefined, eventId: number | undefined, type?: EventTraceLinkType): boolean {
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

export function persistEventTrace(
  db: SqliteDb,
  event: unknown,
  eventId: number,
  createdAt: number,
): void {
  if (!Number.isInteger(eventId) || eventId <= 0) return;
  const record = isRecord(event) ? event : {};
  const data = eventDataRecord(record);
  const eventType = nonEmptyString(record.type);
  const trace = parseEventTrace(record.trace);
  const openEventId = dataEventId(data, ["openEventId", "open_event_id"]);
  const escalationId = nonEmptyString(data.escalationId);
  const escalationCreatedId =
    escalationId && isEscalationFollowupEvent(eventType)
      ? findPriorEscalationCreated(db, escalationId, eventId)
      : undefined;
  const inferredParentEventId = eventExists(db, openEventId)
    ? openEventId
    : eventExists(db, escalationCreatedId)
      ? escalationCreatedId
      : undefined;
  const traceId =
    trace?.traceId ??
    (inferredParentEventId ? eventTraceId(db, inferredParentEventId) : `event:${eventId}`);
  const parentEventId = eventExists(db, trace?.parentEventId)
    ? trace!.parentEventId!
    : inferredParentEventId ?? null;
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
    !hasDeclaredLink(trace, escalationCreatedId, isEscalationClosureEvent(eventType) ? "closure" : "reference")
  ) {
    db.run(
      `INSERT OR IGNORE INTO event_trace_links
       (from_event_id, to_event_id, type, label, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        eventId,
        escalationCreatedId,
        isEscalationClosureEvent(eventType) ? "closure" : "reference",
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
  const existing = db.prepare(
    `SELECT 1 AS found
     FROM event_trace_links
     WHERE from_event_id = ?
       AND to_event_id = ?
       AND type = 'closure'
     LIMIT 1`,
  ).get(closeEventId, openEventId) as { found?: unknown } | null;
  if (!existing) {
    db.run(
      `INSERT INTO event_trace_links
       (from_event_id, to_event_id, type, label, created_at)
       VALUES (?, ?, 'closure', ?, ?)`,
      [closeEventId, openEventId, label, createdAt],
    );
  }
}

function cleanupInvalidTraceRows(db: SqliteDb): number {
  const cleanupDanglingPairs = db.run(
    `DELETE FROM event_pair_runs
     WHERE open_event_id NOT IN (SELECT id FROM events)
        OR (close_event_id IS NOT NULL AND close_event_id NOT IN (SELECT id FROM events))`,
  );
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
    (cleanupDanglingPairs.changes ?? 0) +
    (cleanupDanglingTraces.changes ?? 0) +
    (cleanupDanglingParents.changes ?? 0) +
    (cleanupDanglingLinks.changes ?? 0)
  );
}

function backfillPayloadRelationTraces(db: SqliteDb, options: { limit: number; createdAt: number }): number {
  const { limit, createdAt } = options;
  db.exec("DROP TABLE IF EXISTS temp_event_payload_open_event_backfill");
  db.exec(
    `CREATE TEMP TABLE temp_event_payload_open_event_backfill AS
     SELECT e.id as event_id,
            e.event_type as event_type,
            CAST(COALESCE(json_extract(e.data, '$.openEventId'), json_extract(e.data, '$.open_event_id')) AS INTEGER) as open_event_id
     FROM (
       SELECT id, event_type, data
       FROM events
       WHERE json_valid(data)
     ) e
     JOIN events opened ON opened.id = CAST(COALESCE(json_extract(e.data, '$.openEventId'), json_extract(e.data, '$.open_event_id')) AS INTEGER)
     WHERE COALESCE(json_extract(e.data, '$.openEventId'), json_extract(e.data, '$.open_event_id')) IS NOT NULL
       AND e.id != opened.id
     ORDER BY e.id
     LIMIT ${limit}`,
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_temp_payload_open_event ON temp_event_payload_open_event_backfill(event_id)");
  const openTraceUpdate = db.run(
    `UPDATE event_traces
     SET trace_id = (
           SELECT COALESCE(parent_trace.trace_id, 'event:' || p.open_event_id)
           FROM temp_event_payload_open_event_backfill p
           LEFT JOIN event_traces parent_trace ON parent_trace.event_id = p.open_event_id
           WHERE p.event_id = event_traces.event_id
         ),
         parent_event_id = (
           SELECT p.open_event_id
           FROM temp_event_payload_open_event_backfill p
           WHERE p.event_id = event_traces.event_id
         )
     WHERE parent_event_id IS NULL
       AND trace_id = 'event:' || event_id
       AND EXISTS (
         SELECT 1
         FROM temp_event_payload_open_event_backfill p
         WHERE p.event_id = event_traces.event_id
       )`,
  );
  const openLinkInsert = db.run(
    `INSERT OR IGNORE INTO event_trace_links
     (from_event_id, to_event_id, type, label, created_at)
     SELECT event_id, open_event_id, 'closure', COALESCE(event_type, 'openEventId'), ?
     FROM temp_event_payload_open_event_backfill`,
    [createdAt],
  );
  db.exec("DROP TABLE IF EXISTS temp_event_payload_open_event_backfill");

  db.exec("DROP TABLE IF EXISTS temp_event_payload_escalation_backfill");
  db.exec(
    `CREATE TEMP TABLE temp_event_payload_escalation_backfill AS
     SELECT e.id as event_id,
            e.event_type as event_type,
            opened.id as escalation_event_id
     FROM (
       SELECT id, event_type, data
       FROM events
       WHERE json_valid(data)
     ) e
     JOIN (
       SELECT json_extract(data, '$.escalationId') as escalation_id, MAX(id) as escalation_event_id
       FROM events
       WHERE event_type = 'escalation.created'
         AND json_valid(data)
         AND json_extract(data, '$.escalationId') IS NOT NULL
       GROUP BY json_extract(data, '$.escalationId')
     ) picked
       ON picked.escalation_id = json_extract(e.data, '$.escalationId')
     JOIN events opened ON opened.id = picked.escalation_event_id
     WHERE e.event_type IN (
         'escalation.resolved',
         'escalation.dismissed',
         'escalation.resume_attempted',
         'escalation.resume_started',
         'escalation.resume_failed'
       )
       AND json_extract(e.data, '$.escalationId') IS NOT NULL
       AND e.id != opened.id
     ORDER BY e.id
     LIMIT ${limit}`,
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_temp_payload_escalation ON temp_event_payload_escalation_backfill(event_id)");
  const escalationTraceUpdate = db.run(
    `UPDATE event_traces
     SET trace_id = (
           SELECT COALESCE(parent_trace.trace_id, 'event:' || p.escalation_event_id)
           FROM temp_event_payload_escalation_backfill p
           LEFT JOIN event_traces parent_trace ON parent_trace.event_id = p.escalation_event_id
           WHERE p.event_id = event_traces.event_id
         ),
         parent_event_id = (
           SELECT p.escalation_event_id
           FROM temp_event_payload_escalation_backfill p
           WHERE p.event_id = event_traces.event_id
         )
     WHERE parent_event_id IS NULL
       AND trace_id = 'event:' || event_id
       AND EXISTS (
         SELECT 1
         FROM temp_event_payload_escalation_backfill p
         WHERE p.event_id = event_traces.event_id
       )`,
  );
  const escalationLinkInsert = db.run(
    `INSERT OR IGNORE INTO event_trace_links
     (from_event_id, to_event_id, type, label, created_at)
     SELECT event_id,
            escalation_event_id,
            CASE WHEN event_type IN ('escalation.resolved', 'escalation.dismissed') THEN 'closure' ELSE 'reference' END,
            COALESCE(event_type, 'escalation.followup'),
            ?
     FROM temp_event_payload_escalation_backfill`,
    [createdAt],
  );
  db.exec("DROP TABLE IF EXISTS temp_event_payload_escalation_backfill");

  return (
    (openTraceUpdate.changes ?? 0) +
    (openLinkInsert.changes ?? 0) +
    (escalationTraceUpdate.changes ?? 0) +
    (escalationLinkInsert.changes ?? 0)
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
     WHERE p.open_event_id IS NOT NULL
       AND p.close_event_id IS NOT NULL
     ORDER BY p.id
     LIMIT ${limit}`,
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
           SELECT COALESCE(opened.trace_id, 'event:' || p.open_event_id)
           FROM temp_event_pair_trace_backfill p
           LEFT JOIN event_traces opened ON opened.event_id = p.open_event_id
           WHERE p.close_event_id = event_traces.event_id
           ORDER BY p.open_event_id
           LIMIT 1
         ),
         parent_event_id = (
           SELECT p.open_event_id
           FROM temp_event_pair_trace_backfill p
           WHERE p.close_event_id = event_traces.event_id
           ORDER BY p.open_event_id
           LIMIT 1
         )
     WHERE EXISTS (
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
  const payloadRelationBackfill = backfillPayloadRelationTraces(db, { limit, createdAt });
  return (
    cleaned +
    (baseline.changes ?? 0) +
    (closeTraceInsert.changes ?? 0) +
    (closeTraceUpdate.changes ?? 0) +
    (linkInsert.changes ?? 0) +
    payloadRelationBackfill
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
    closedPairMissingClosureCount: count(
      db,
      `SELECT COUNT(*) AS c
       FROM event_pair_runs p
       LEFT JOIN event_trace_links l
         ON l.from_event_id = p.close_event_id
        AND l.to_event_id = p.open_event_id
        AND l.type = 'closure'
       WHERE p.status = 'closed'
         AND p.close_event_id IS NOT NULL
         AND l.id IS NULL`,
    ),
    pairTraceSplitCount: count(
      db,
      `SELECT COUNT(*) AS c
       FROM event_pair_runs p
       JOIN event_traces opened ON opened.event_id = p.open_event_id
       JOIN event_traces closed ON closed.event_id = p.close_event_id
       WHERE p.status = 'closed'
         AND opened.trace_id != closed.trace_id
         AND 1 = (
           SELECT COUNT(*)
           FROM event_pair_runs siblings
           WHERE siblings.status = 'closed'
             AND siblings.close_event_id = p.close_event_id
         )`,
    ),
    humanRootWithoutSingleIntentCount: count(
      db,
      `SELECT COUNT(*) AS c
       FROM events root
       WHERE root.event_type = 'human.input.received'
         AND 1 != (
           SELECT COUNT(*)
           FROM event_traces child_trace
           JOIN events child ON child.id = child_trace.event_id
           WHERE child_trace.parent_event_id = root.id
             AND (
               child.event_type IN (
                 'chat.start.requested',
                 'session.steer.requested',
                 'project.comment.created',
                 'project.approval.submitted',
                 'human.input.rejected'
               )
               OR child.event_type LIKE 'runtime.%.requested'
               OR child.event_type IN ('session.cancel.requested', 'session.cancel_all.requested')
             )
         )`,
    ),
    humanResultUndeliveredCount: count(
      db,
      `SELECT COUNT(*) AS c
       FROM events terminal
       JOIN event_traces terminal_trace ON terminal_trace.event_id = terminal.id
       WHERE terminal.event_type IN ('session.idle', 'session.end')
         AND EXISTS (
           SELECT 1
           FROM events root
           JOIN event_traces root_trace ON root_trace.event_id = root.id
           WHERE root.event_type = 'human.input.received'
             AND root_trace.trace_id = terminal_trace.trace_id
         )
         AND NOT EXISTS (
           SELECT 1
           FROM events delivery
           JOIN event_traces delivery_trace ON delivery_trace.event_id = delivery.id
           WHERE delivery.event_type = 'channel.delivery.completed'
             AND delivery_trace.trace_id = terminal_trace.trace_id
       )`,
    ),
    humanLinkedTaskWithoutCloseoutCount: count(
      db,
      `WITH humanTraces AS MATERIALIZED (
         SELECT DISTINCT trace.trace_id
         FROM events humanRoot
         JOIN event_traces trace ON trace.event_id = humanRoot.id
         WHERE humanRoot.event_type = 'human.input.received'
       ),
       humanTasks AS MATERIALIZED (
         SELECT json_extract(taskRef.value, '$.taskId') AS taskId,
                json_extract(taskRef.value, '$.projectId') AS projectId
         FROM events ownerResult
         JOIN event_traces ownerTrace ON ownerTrace.event_id = ownerResult.id
         JOIN humanTraces ON humanTraces.trace_id = ownerTrace.trace_id
         JOIN json_each(ownerResult.data, '$.taskRefs') taskRef
         WHERE ownerResult.event_type = 'project.owner.reviewed'
       )
       SELECT COUNT(DISTINCT terminal.id) AS c
       FROM humanTasks human
       CROSS JOIN events terminal INDEXED BY idx_events_type
       WHERE terminal.event_type = 'project.task.reconciled'
         AND terminal.task_id = human.taskId
         AND (terminal.project_id IS NULL OR terminal.project_id = human.projectId)
         AND json_extract(terminal.data, '$.disposition') IN ('converged', 'attention')
         AND NOT EXISTS (
           SELECT 1
           FROM event_traces reviewTrace
           JOIN events reviewStart ON reviewStart.id = reviewTrace.event_id
           WHERE reviewTrace.parent_event_id = terminal.id
             AND reviewStart.event_type = 'session.start'
             AND reviewStart.owner = 'agent:may'
             AND EXISTS (
               SELECT 1
               FROM events delivery
               JOIN event_traces deliveryTrace ON deliveryTrace.event_id = delivery.id
               WHERE delivery.event_type = 'channel.delivery.completed'
                 AND delivery.id > terminal.id
                 AND deliveryTrace.trace_id = reviewTrace.trace_id
                 AND json_extract(delivery.data, '$.sessionId') = json_extract(reviewStart.data, '$.sessionId')
             )
         )`,
    ),
    bookkeepingOnlyAcceptanceCount: count(
      db,
      `SELECT COUNT(*) AS c
       FROM events
       WHERE accepted_by = 'event-pair-tracker'
         AND event_type NOT LIKE 'session.%'
         AND event_type NOT LIKE 'workflow.%'
         AND event_type NOT LIKE 'handler.%'
         AND event_type NOT LIKE 'cli.task.%'`,
    ),
    structuralOk: false,
    semanticOk: false,
    ok: false,
  };
  result.structuralOk =
    result.danglingTraceCount === 0 &&
    result.missingTraceCount === 0 &&
    result.danglingParentCount === 0 &&
    result.danglingLinkCount === 0 &&
    result.invalidVisibilityCount === 0 &&
    result.invalidLinkTypeCount === 0;
  result.semanticOk =
    result.closedPairMissingClosureCount === 0 &&
    result.pairTraceSplitCount === 0 &&
    result.humanRootWithoutSingleIntentCount === 0 &&
    result.humanResultUndeliveredCount === 0 &&
    result.humanLinkedTaskWithoutCloseoutCount === 0 &&
    result.bookkeepingOnlyAcceptanceCount === 0;
  result.ok = result.structuralOk && result.semanticOk;
  return result;
}
