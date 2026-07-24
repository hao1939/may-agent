import { getDb } from "./connection.js";

export interface DbMaintenanceResult {
  deleted: Record<string, number>;
  checkpoint: "ok" | "busy" | "failed";
}

const DAY_MS = 86_400_000;
const ORPHAN_ACTIONABLE_MS = 4 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 2000;

function changes(result: unknown): number {
  return Number((result as { changes?: number } | null)?.changes ?? 0);
}

/**
 * Perform one bounded maintenance pass.
 *
 * Every statement has a fixed row/page limit. The pass never VACUUMs and never
 * loops until caught up, so it is safe to run in a dedicated runtime process
 * alongside the daemon.
 */
export function runDbMaintenancePass(
  persistDir: string,
  opts: { now?: number; batchSize?: number } = {},
): DbMaintenanceResult {
  const db = getDb(persistDir);
  const now = opts.now ?? Date.now();
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? DEFAULT_BATCH_SIZE, 5_000));
  const deleted: Record<string, number> = {};

  const remove = (name: string, sql: string, params: unknown[]) => {
    deleted[name] = changes(db.run(sql, params));
  };

  db.run(
    `UPDATE event_pair_runs
     SET status = 'orphan',
         note = COALESCE(note, 'expected closing event did not arrive before timeout')
     WHERE rowid IN (
       SELECT rowid FROM event_pair_runs
       WHERE status = 'open' AND expected_close_at < ?
       ORDER BY expected_close_at LIMIT ?
     )`,
    [now, batchSize],
  );

  deleted.retiredOrphans = changes(
    db.run(
      `UPDATE event_pair_runs
       SET closed_at = ?,
           note = COALESCE(note || '; ', '') || 'retired stale orphan'
       WHERE rowid IN (
         SELECT rowid FROM event_pair_runs
         WHERE status = 'orphan'
           AND closed_at IS NULL
           AND expected_close_at < ?
         ORDER BY expected_close_at LIMIT ?
       )`,
      [now, now - ORPHAN_ACTIONABLE_MS, batchSize],
    ),
  );

  // Remove expired closed/orphan commitments first. Open commitments keep their
  // opening event protected by the retention trigger.
  remove(
    "event_pair_runs",
    `DELETE FROM event_pair_runs WHERE rowid IN (
       SELECT rowid FROM event_pair_runs
       WHERE status IN ('closed', 'orphan') AND opened_at < ?
       ORDER BY opened_at LIMIT ?
     )`,
    [now - 3 * DAY_MS, batchSize],
  );

  // Old closure/reference links may be released only when both endpoints are
  // expired and neither endpoint still anchors an open commitment.
  remove(
    "event_trace_links_expired",
    `DELETE FROM event_trace_links WHERE id IN (
       SELECT l.id
       FROM event_trace_links l
       JOIN events source_event ON source_event.id = l.from_event_id
       JOIN events target_event ON target_event.id = l.to_event_id
       WHERE l.created_at < ?
         AND source_event.timestamp < ?
         AND target_event.timestamp < ?
         AND NOT EXISTS (
           SELECT 1 FROM event_pair_runs p
           WHERE p.open_event_id IN (l.from_event_id, l.to_event_id)
             AND p.status IN ('open', 'orphan')
         )
       ORDER BY l.created_at LIMIT ?
     )`,
    [now - 5 * DAY_MS, now - 5 * DAY_MS, now - 5 * DAY_MS, batchSize],
  );

  // Delete only events with no retained causal/commitment reference. This
  // avoids repeatedly selecting rows the protection trigger must ignore.
  remove(
    "events",
    `DELETE FROM events WHERE id IN (
       SELECT e.id
       FROM events e
       WHERE e.timestamp < ?
         AND NOT EXISTS (
           SELECT 1 FROM event_pair_runs p
           WHERE p.open_event_id = e.id AND p.status IN ('open', 'orphan')
         )
         AND NOT EXISTS (
           SELECT 1 FROM event_traces t
           WHERE t.parent_event_id = e.id AND t.event_id != e.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM event_trace_links l
           WHERE l.from_event_id = e.id OR l.to_event_id = e.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM sessions s
           WHERE s.status IN ('running', 'idle')
             AND e.session_id = s.sessionId
         )
       ORDER BY e.timestamp LIMIT ?
     )`,
    [now - 5 * DAY_MS, batchSize],
  );

  remove(
    "event_traces",
    `DELETE FROM event_traces WHERE event_id IN (
       SELECT event_id FROM event_traces
       WHERE event_id NOT IN (SELECT id FROM events)
       LIMIT ?
     )`,
    [batchSize],
  );
  remove(
    "event_trace_links_orphaned",
    `DELETE FROM event_trace_links WHERE id IN (
       SELECT id FROM event_trace_links
       WHERE from_event_id NOT IN (SELECT id FROM events)
          OR to_event_id NOT IN (SELECT id FROM events)
       LIMIT ?
     )`,
    [batchSize],
  );

  remove(
    "sessions",
    `DELETE FROM sessions WHERE rowid IN (
       SELECT rowid FROM sessions
       WHERE startedAt < ? AND status NOT IN ('running', 'idle')
       ORDER BY startedAt LIMIT ?
     )`,
    [now - 14 * DAY_MS, batchSize],
  );
  remove(
    "workflow_runs",
    `DELETE FROM workflow_runs WHERE rowid IN (
       SELECT rowid FROM workflow_runs
       WHERE startedAt < ? AND status != 'running'
       ORDER BY startedAt LIMIT ?
     )`,
    [now - 14 * DAY_MS, batchSize],
  );
  remove(
    "session_digests",
    `DELETE FROM session_digests WHERE rowid IN (
       SELECT rowid FROM session_digests
       WHERE created_at < ? ORDER BY created_at LIMIT ?
     )`,
    [now - 14 * DAY_MS, batchSize],
  );
  remove(
    "evaluations",
    `DELETE FROM evaluations WHERE rowid IN (
       SELECT rowid FROM evaluations
       WHERE createdAt < ? ORDER BY createdAt LIMIT ?
     )`,
    [now - 30 * DAY_MS, batchSize],
  );
  remove(
    "metric_snapshots",
    `DELETE FROM metric_snapshots WHERE rowid IN (
       SELECT rowid FROM metric_snapshots
       WHERE measured_at < ? ORDER BY measured_at LIMIT ?
     )`,
    [now - 30 * DAY_MS, batchSize],
  );

  let checkpoint: DbMaintenanceResult["checkpoint"] = "failed";
  try {
    const result = db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get() as { busy?: number } | undefined;
    checkpoint = result?.busy ? "busy" : "ok";
  } catch {
    checkpoint = "failed";
  }

  // Opportunistic and bounded; does nothing when incremental auto-vacuum has
  // no reclaimable pages. Full VACUUM is an explicit offline operator action.
  try {
    db.exec("PRAGMA incremental_vacuum(100)");
  } catch {
    /* best effort */
  }

  return { deleted, checkpoint };
}
