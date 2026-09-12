import type { HostExecutionHealth, HostHealthSnapshot, ObserverContext } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";

const HOUR_MS = 3_600_000;
export const HOST_HEALTH_MAX_LOOKBACK_MS = 24 * HOUR_MS;
export const HOST_HEALTH_DETAIL_LIMIT = 20;
// Execution errors are counted from execution records below. These are the
// additional Host boundaries which can fail without producing an execution.
export const HOST_HEALTH_FAILURE_EVENTS = [
  "handler.failed",
  "subscriber.failed",
  "app.observer.failed",
  "agent.config_invalid",
  "session.resume_failed",
  "message.delivery_failed",
  "metric.measurement.failed",
] as const;

function executionHealth(
  db: SqliteDb,
  table: "sessions" | "workflow_runs",
  start: number,
  end: number,
): HostExecutionHealth {
  const id = table === "sessions" ? "sessionId" : "runId";
  const known = "'done', 'error', 'blocked', 'interrupted'";
  const counts = db
    .prepare(
      `SELECT COUNT(*) AS ended,
    COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
    COUNT(CASE WHEN status = 'error' THEN 1 END) AS error,
    COUNT(CASE WHEN status = 'blocked' THEN 1 END) AS blocked,
    COUNT(CASE WHEN status = 'interrupted' THEN 1 END) AS interrupted,
    COUNT(CASE WHEN status IS NULL OR status NOT IN (${known}) THEN 1 END) AS other
    FROM ${table} WHERE endedAt >= ? AND endedAt < ?`,
    )
    .get(start, end) as Pick<HostExecutionHealth, "ended" | "done" | "error" | "blocked" | "interrupted" | "other">;
  const running = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE status = 'running'`).get()!.count as number;
  const undated = db
    .prepare(
      `SELECT COUNT(*) AS count FROM ${table}
    WHERE endedAt IS NULL AND status IN (${known}) AND startedAt >= ? AND startedAt < ?`,
    )
    .get(start, end)!.count as number;
  const recentErrors = db
    .prepare(
      `SELECT ${id} AS executionId, endedAt FROM ${table}
    WHERE status = 'error' AND endedAt >= ? AND endedAt < ?
    ORDER BY endedAt DESC, ${id} DESC LIMIT ?`,
    )
    .all(start, end, HOST_HEALTH_DETAIL_LIMIT) as HostExecutionHealth["recentErrors"];
  return { ...counts, running, undated, recentErrors, errorsTruncated: counts.error > recentErrors.length };
}

/** Read-only optional report. Failure rejects the whole snapshot, never healthy zeros. */
export function readHostHealth(
  db: SqliteDb,
  options: Parameters<ObserverContext["read"]["hostHealth"]>[0] = {},
  now = Date.now(),
): HostHealthSnapshot {
  const lookbackMs = options.lookbackMs ?? HOUR_MS;
  if (!Number.isSafeInteger(lookbackMs) || lookbackMs < 1 || lookbackMs > HOST_HEALTH_MAX_LOOKBACK_MS) {
    throw new Error("Host health lookbackMs must be a positive integer of at most one day");
  }
  const start = now - lookbackMs;
  const types = HOST_HEALTH_FAILURE_EVENTS.map(() => "?").join(", ");
  // Share one read snapshot without acquiring a writer reservation. Nested
  // callers retain their own transaction; no rows, collector or timer are added.
  db.exec("SAVEPOINT host_health_read");
  try {
    const byType = db
      .prepare(
        `SELECT event_type AS type, COUNT(*) AS count FROM events
      WHERE event_type IN (${types}) AND timestamp >= ? AND timestamp < ?
      GROUP BY event_type ORDER BY event_type`,
      )
      .all(...HOST_HEALTH_FAILURE_EVENTS, start, now) as HostHealthSnapshot["runtimeFailures"]["byType"];
    const recent = db
      .prepare(
        `SELECT id AS eventId, event_type AS type, timestamp FROM events
      WHERE event_type IN (${types}) AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp DESC, id DESC LIMIT ?`,
      )
      .all(
        ...HOST_HEALTH_FAILURE_EVENTS,
        start,
        now,
        HOST_HEALTH_DETAIL_LIMIT,
      ) as HostHealthSnapshot["runtimeFailures"]["recent"];
    const total = byType.reduce((sum, row) => sum + row.count, 0);
    const snapshot: HostHealthSnapshot = {
      generatedAt: now,
      window: { start, end: now },
      coverage: { retainedOnly: true, executionScope: "all" },
      executions: {
        agents: executionHealth(db, "sessions", start, now),
        workflows: executionHealth(db, "workflow_runs", start, now),
      },
      runtimeFailures: { total, byType, recent, truncated: total > recent.length },
    };
    db.exec("RELEASE host_health_read");
    return snapshot;
  } catch (error) {
    db.exec("ROLLBACK TO host_health_read");
    db.exec("RELEASE host_health_read");
    throw error;
  }
}
