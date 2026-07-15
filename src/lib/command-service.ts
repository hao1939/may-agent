import type { SqliteDb } from "./db.js";

export interface CommandAPI {
  /** Emit review events for inbox-routed events. Returns the number emitted. */
  reviewInboxEvents(eventIds: number[], reviewedBy?: string): number;
  /** Retire stale message inbox work through typed expiry events. */
  expireStaleMessages(olderThanMs: number): number;
  /** Retire stale signal inbox work through typed expiry events. */
  expireStaleSignalEvents(olderThanMs: number): number;
}

export interface CommandServiceOptions {
  getDb: () => SqliteDb;
  emit: (event: Record<string, unknown>) => unknown;
}

function reviewedEventType(openEventType: unknown): string {
  if (openEventType === "message.created") return "message.reviewed";
  if (openEventType === "project.feedback.created") return "project.feedback.reviewed";
  if (openEventType === "project.owner.requested") return "project.owner.reviewed";
  return "owner.inbox.reviewed";
}

function reviewInboxRows(
  db: SqliteDb,
  eventIds: number[],
  reviewedBy: string | undefined,
  emit: CommandServiceOptions["emit"],
): number {
  if (!eventIds.length) return 0;
  const agent = reviewedBy ?? "system";
  let reviewed = 0;
  const rows = eventIds.map((id) => db.prepare(
    `SELECT id, event_type, owner, data
     FROM events
     WHERE id = ?`,
  ).get(id) as { id: number; event_type: string; owner: string | null; data: string | null } | null);
  const existingFollowup = db.prepare(
    `SELECT id
     FROM events
     WHERE json_extract(data, '$.openEventId') = ?
     LIMIT 1`,
  );
  for (const row of rows) {
    if (!row?.id || existingFollowup.get(row.id)) continue;
    const type = reviewedEventType(row.event_type);
    emit({
      type,
      source: `inbox:${agent}`,
      owner: row.owner ?? `agent:${agent}`,
      data: {
        openEventId: row.id,
        openEventType: row.event_type,
        reviewedBy: agent,
      },
      trace: {
        traceId: `event:${row.id}`,
        parentEventId: row.id,
        links: [{ eventId: row.id, type: "closure", label: type }],
      },
    });
    reviewed++;
  }
  return reviewed;
}

function retireStaleInboxPairs(
  db: SqliteDb,
  eventTypes: string[],
  cutoff: number,
  note: string,
  emit: CommandServiceOptions["emit"],
): number {
  const placeholders = eventTypes.map(() => "?").join(", ");
  const rows = db.prepare(
    `SELECT p.open_event_id as openEventId, e.event_type as openEventType, e.owner
     FROM event_pair_runs p
     JOIN events e ON e.id = p.open_event_id
     WHERE p.pair_name = 'owner_inbox'
       AND p.status = 'open'
       AND e.event_type IN (${placeholders})
       AND e.timestamp < ?`,
  ).all(...eventTypes, cutoff) as Array<{ openEventId: number; openEventType: string; owner: string | null }>;
  for (const row of rows) {
    const type = row.openEventType === "message.created" ? "message.expired" : "owner.inbox.expired";
    emit({
      type,
      source: "inbox:retention",
      owner: row.owner ?? "agent:may",
      data: { openEventId: row.openEventId, openEventType: row.openEventType, reason: note },
      trace: {
        traceId: `event:${row.openEventId}`,
        parentEventId: row.openEventId,
        links: [{ eventId: row.openEventId, type: "closure", label: type }],
      },
    });
  }
  return rows.length;
}

export function createCommandService(opts: CommandServiceOptions): CommandAPI {
  return {
    reviewInboxEvents(eventIds, reviewedBy) {
      return reviewInboxRows(opts.getDb(), eventIds, reviewedBy, opts.emit);
    },
    expireStaleMessages(olderThanMs) {
      return retireStaleInboxPairs(
        opts.getDb(),
        ["message.created"],
        Date.now() - olderThanMs,
        "stale message inbox work retired",
        opts.emit,
      );
    },
    expireStaleSignalEvents(olderThanMs) {
      return retireStaleInboxPairs(
        opts.getDb(),
        [
          "session.resume_failed",
          "session.recovery_failed",
          "metric.breach",
          "metric.recovered",
          "metric.stalled",
          "handler.failed",
          "agent.config_invalid",
          "message.delivery_failed",
          "subscriber.failed",
        ],
        Date.now() - olderThanMs,
        "stale signal inbox work retired",
        opts.emit,
      );
    },
  };
}

export function createUnavailableCommandService(reason: string): CommandAPI {
  const fail = (): never => {
    throw new Error(reason);
  };
  return {
    reviewInboxEvents: fail,
    expireStaleMessages: fail,
    expireStaleSignalEvents: fail,
  };
}
