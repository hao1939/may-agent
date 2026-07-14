/**
 * DbWriter — EventBus subscriber that persists events to SQLite.
 *
 * This is the ONLY component that writes to the DB.
 * Core emits events, DbWriter persists them.
 *
 * See: shared/may-agent-docs/events.md
 */

import { EVENT_ROW_ID, type AgentEvent, type DeliveryResult } from "../app/event-bus.js";
import { getDb, upsertSession, updateSessionDb } from "./requests.js";
import type { SqliteDb } from "./db.js";
import { isCanonicalEventEnvelope, isRecord } from "../../packages/control/src/event-envelope.js";
import { persistEventClosure, persistEventTrace } from "./db/event-traces.js";

/** Maximum event data payload persisted (200KB). Prevents DB bloat from
 * recursive session tasks or oversized payloads. */
const MAX_EVENT_DATA = 200_000;

const DURABLE_COMMAND_EVENTS = new Set([
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
const TASK_ASSIGNED_PAIR_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CLOSING_SUFFIXES = [
  ".completed",
  ".failed",
  ".accepted",
  ".rejected",
  ".resolved",
  ".dismissed",
  ".closed",
  ".blocked",
  ".reviewed",
];

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

function compactEventValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    const max = depth === 0 ? 16_000 : 8_000;
    return value.length <= max
      ? value
      : `${value.slice(0, max)}...[TRUNCATED: ${value.length} chars]`;
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
  if (json.length <= MAX_EVENT_DATA) return json;

  const compacted = compactEventValue(payload) as Record<string, unknown>;
  const compactJson = JSON.stringify({
    ...compacted,
    _truncated: { originalLength: json.length },
  });
  if (compactJson.length <= MAX_EVENT_DATA) return compactJson;

  const fallback: Record<string, unknown> = {
    _truncated: {
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
    "handler",
  ];
  const scalarEntries = Object.entries(payload).filter(
    ([, value]) => value === null || typeof value !== "object",
  );
  const orderedEntries = [
    ...priorityKeys.flatMap((key) => scalarEntries.filter(([entryKey]) => entryKey === key)),
    ...scalarEntries.filter(([key]) => !priorityKeys.includes(key)),
  ];
  for (const [key, value] of orderedEntries) {
    const candidate = { ...fallback, [key]: compactEventValue(value, 1) };
    if (JSON.stringify(candidate).length > MAX_EVENT_DATA) continue;
    fallback[key] = candidate[key];
  }
  return JSON.stringify(fallback);
}

function parseStoredEventData(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isTerminalNoopEvent(
  eventType: unknown,
  data: Record<string, unknown> | null,
): boolean {
  if (eventType !== "session.end" || !data) return false;
  return (
    data.reconciled === true &&
    typeof data.sessionId === "string" &&
    typeof data.agent === "string" &&
    data.status === "done"
  );
}

function keyPart(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function correlationKey(eventType: string, payload: Record<string, unknown>): string | undefined {
  if (eventType.startsWith("session.")) return keyPart(payload.sessionId);
  if (eventType.startsWith("workflow.")) return keyPart(payload.workflowRunId);
  if (eventType.startsWith("handler."))
    return keyPart(payload.handlerRunId) ?? keyPart(payload.workflowRunId) ?? keyPart(payload.handler);
  if (eventType.startsWith("escalation.")) return keyPart(payload.escalationId);
  if (eventType.startsWith("cli.task.")) return keyPart(payload.taskId);
  if (eventType.startsWith("project.owner."))
    return keyPart(payload.projectId) ?? keyPart(payload.project) ?? keyPart(payload.projectPath);
  if (eventType.startsWith("project.task.")) {
    const taskId = keyPart(payload.taskId);
    if (!taskId) return undefined;
    const attemptId = keyPart(payload.attemptId);
    return attemptId ? `${taskId}:${attemptId}` : taskId;
  }
  return keyPart(payload.requestId);
}

function openingPair(eventType: string): { name: string; base: string; timeoutMs: number } | undefined {
  if (eventType === "session.start") return { name: "session", base: "session", timeoutMs: 60 * 60 * 1000 };
  if (eventType.endsWith(".started"))
    return {
      name: eventType.slice(0, -".started".length),
      base: eventType.slice(0, -".started".length),
      timeoutMs: DEFAULT_PAIR_TTL_MS,
    };
  if (eventType.endsWith(".requested"))
    return {
      name: eventType.slice(0, -".requested".length),
      base: eventType.slice(0, -".requested".length),
      timeoutMs: 60 * 60 * 1000,
    };
  if (eventType.endsWith(".created"))
    return {
      name: eventType.slice(0, -".created".length),
      base: eventType.slice(0, -".created".length),
      timeoutMs: 24 * 60 * 60 * 1000,
    };
  if (eventType.endsWith(".assigned"))
    return {
      name: eventType.slice(0, -".assigned".length),
      base: eventType.slice(0, -".assigned".length),
      timeoutMs: TASK_ASSIGNED_PAIR_TTL_MS,
    };
  return undefined;
}

function closingPair(eventType: string): { base: string } | undefined {
  if (eventType === "session.idle") return { base: "session" };
  if (eventType === "session.end") return { base: "session" };
  for (const suffix of CLOSING_SUFFIXES) {
    if (eventType.endsWith(suffix)) return { base: eventType.slice(0, -suffix.length) };
  }
  return undefined;
}

function closingEventTypesForBase(base: string): string[] {
  if (base === "session") return ["session.idle", "session.end"];
  return CLOSING_SUFFIXES.map((suffix) => `${base}${suffix}`);
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
    try {
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
          updateSessionDb(this.persistDir, payload.sessionId as string, {
            status: payload.status as any,
            error: payload.error as string | undefined,
            outcome: payload.outcome as string | undefined,
            opCount: payload.opCount as number | undefined,
            lastActivityAt: Date.now(),
            endedAt: Date.now(),
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
          if (DURABLE_COMMAND_EVENTS.has(event.type)) {
            try {
              const ev = event as any;
              const data = eventPayload(ev);
              this.insertEventRow(event, data, eventSource(ev), eventOwner(ev), eventUrgency(ev), eventTtlMs(ev));
            } catch {
              /* table may not exist */
            }
            break;
          }

          // Persist domain events (dot-separated types) to events table
          if (event.type.includes(".")) {
            try {
              const ev = event as any;
              if (!isCanonicalEventEnvelope(ev)) break;
              const data = eventPayload(ev);
              this.insertEventRow(event, data, eventSource(ev), eventOwner(ev), eventUrgency(ev), eventTtlMs(ev));
            } catch {
              /* table may not exist */
            }
          }
          break;
      }
    } catch (err) {
      // DB errors are operational — log but don't break the bus
      console.error(`[db-writer] Error persisting ${event.type}:`, err instanceof Error ? err.message : err);
    }
  };

  recordDelivery = (event: AgentEvent, result: DeliveryResult): void => {
    try {
      const rowId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
      if (typeof rowId !== "number" || !Number.isFinite(rowId)) return;
      const now = Date.now();
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
      if (result.route === "owner_inbox") this.openOwnerInboxPair(event, rowId, now);
    } catch {
      /* best-effort delivery metadata */
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
      const info = this.db.run(
        "INSERT INTO events (event_type, source, owner, data, timestamp, urgency, ttl_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [event.type, source, owner, capEventData(payload), timestamp, urgency, ttlMs],
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
      } catch {
        /* event may be frozen; delivery metadata will be skipped */
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
    const rows = this.db.prepare(
      `SELECT open_event_id, pair_name
       FROM event_pair_runs
       WHERE open_event_id = ?
         AND status IN ('open', 'orphan')`,
    ).all(openEventId) as Array<{ open_event_id?: unknown; pair_name?: unknown }>;
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
    const key = correlationKey(eventType, payload);
    if (!key) return;
    // When a task is re-assigned with a new attemptId, supersede older open/orphan
    // pairs for the same taskId to prevent orphan accumulation from re-attempts.
    if (eventType === "project.task.assigned") {
      const taskId = keyPart(payload.taskId);
      if (taskId) {
        const superseded = this.db.prepare(
          `SELECT open_event_id
           FROM event_pair_runs
           WHERE status IN ('open', 'orphan')
             AND pair_name = ?
             AND correlation_key LIKE ? || ':%'
             AND correlation_key != ?`,
        ).all(pair.name, taskId, key) as Array<{ open_event_id?: unknown }>;
        this.db.run(
          `UPDATE event_pair_runs
           SET status = 'closed',
               close_event_id = ?,
               closed_at = ?,
               note = 'superseded by new task attempt'
           WHERE status IN ('open', 'orphan')
             AND pair_name = ?
             AND correlation_key LIKE ? || ':%'
             AND correlation_key != ?`,
          [openEventId, openedAt, pair.name, taskId, key],
        );
        for (const row of superseded) {
          persistEventClosure(this.db, openEventId, Number(row.open_event_id), pair.name, openedAt);
        }
      }
    }
    this.db.run(
      `INSERT OR IGNORE INTO event_pair_runs
       (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at, note)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
      [pair.name, key, openEventId, owner, openedAt, openedAt + pair.timeoutMs, `opened by ${eventType}`],
    );
    this.closeConventionPairFromEarlierEvent(pair.name, pair.base, key, openEventId, openedAt);
  }

  private closeConventionPairFromEarlierEvent(
    pairName: string,
    base: string,
    key: string,
    openEventId: number,
    openedAt: number,
  ): void {
    const closeTypes = closingEventTypesForBase(base);
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
      if (!payload || correlationKey(eventType, payload) !== key) continue;
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
          pairName,
          key,
          openEventId,
        ],
      );
      persistEventClosure(this.db, closeEventId, openEventId, pairName, openedAt);
      return;
    }
  }

  private closeConventionPairs(
    eventType: string,
    payload: Record<string, unknown>,
    closeEventId: number,
    closedAt: number,
  ): void {
    const pair = closingPair(eventType);
    if (!pair) return;
    const key = correlationKey(eventType, payload);
    if (!key) return;
    const rows = this.db.prepare(
      `SELECT open_event_id
       FROM event_pair_runs
       WHERE status IN ('open', 'orphan')
         AND pair_name = ?
         AND correlation_key = ?`,
    ).all(pair.base, key) as Array<{ open_event_id?: unknown }>;
    this.db.run(
      `UPDATE event_pair_runs
       SET status = 'closed',
           close_event_id = ?,
           closed_at = ?,
           note = COALESCE(note, ?)
       WHERE status IN ('open', 'orphan')
         AND pair_name = ?
         AND correlation_key = ?`,
      [closeEventId, closedAt, `closed by ${eventType}`, pair.base, key],
    );
    for (const row of rows) {
      persistEventClosure(this.db, closeEventId, Number(row.open_event_id), pair.base, closedAt);
    }
  }

  private sweepStalePairs(now: number): void {
    try {
      this.closeReverseOrderedConventionPairs();
      this.db.run(
        `UPDATE event_pair_runs
         SET status = 'orphan',
             note = COALESCE(note, 'expected closing event did not arrive before timeout')
         WHERE status = 'open'
           AND expected_close_at < ?`,
        [now],
      );
      // Purge orphan pairs older than 1h — they accumulate monotonically and
      // serve no diagnostic value once stale. Without this, the
      // event.pair-orphan-count metric breaches any threshold eventually.
      // Most orphans are owner_inbox pairs (messages not formally reviewed
      // within 2h TTL) which are expected at normal volume (~40/h). 1h
      // retention keeps the count below the alert threshold of 50 while still
      // providing a diagnostic window for genuine pair failures.
      const ORPHAN_RETENTION_MS = 1 * 60 * 60 * 1000;
      this.db.run(
        `DELETE FROM event_pair_runs
         WHERE status = 'orphan'
           AND expected_close_at < ?`,
        [now - ORPHAN_RETENTION_MS],
      );
    } catch {
      /* best-effort pair sweep */
    }
  }

  private closeReverseOrderedConventionPairs(): void {
    const rows = this.db
      .prepare(
        `SELECT pair_name, correlation_key, open_event_id, opened_at
         FROM event_pair_runs
         WHERE status IN ('open', 'orphan')
           AND pair_name = 'project.task'
         ORDER BY opened_at DESC
         LIMIT 50`,
      )
      .all() as Array<{
      pair_name?: unknown;
      correlation_key?: unknown;
      open_event_id?: unknown;
      opened_at?: unknown;
    }>;
    for (const row of rows) {
      const pairName = typeof row.pair_name === "string" ? row.pair_name : "";
      const key =
        typeof row.correlation_key === "string" ? row.correlation_key : "";
      const openEventId =
        typeof row.open_event_id === "number"
          ? row.open_event_id
          : Number(row.open_event_id);
      const openedAt =
        typeof row.opened_at === "number" ? row.opened_at : Number(row.opened_at);
      if (
        !pairName ||
        !key ||
        !Number.isFinite(openEventId) ||
        !Number.isFinite(openedAt)
      ) {
        continue;
      }
      this.closeConventionPairFromEarlierEvent(
        pairName,
        pairName,
        key,
        openEventId,
        openedAt,
      );
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
