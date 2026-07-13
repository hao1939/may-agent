/**
 * db-retention — Enforces data retention policy on the runtime SQLite DB.
 *
 * Retention windows:
 *   - events: 5 days
 *   - sessions: 14 days
 *   - session_digests: 14 days (session-linked)
 *   - workflow_runs: 14 days (session-linked)
 *   - metric_snapshots: 30 days (already handled by metrics-snapshot, but
 *     included here as a safety net)
 *   - evaluations: 30 days (analytical value)
 *
 * Size-based retention (KE-1986):
 *   - events.data > 1MB: deleted regardless of age
 *   - sessions.task > 1MB: deleted regardless of age
 *   - session_digests.task > 1MB: deleted regardless of age
 *   - workflow_runs.task > 1MB: deleted regardless of age
 *
 * Runs daily. After deletions exceed a threshold, runs VACUUM to reclaim space.
 * Always VACUUMs if any oversized rows are deleted (they can be 200MB+ each).
 *
 * Approved via work-queue.md (2026-06-04):
 *   projects/may-agent.app/agents/arc/workspace/proposals/2026-05-27-db-retention-policy.md
 * Extended via work-queue.md (2026-06-15):
 *   projects/may-agent.app/agents/arc/workspace/proposals/2026-06-15-extend-db-retention-to-uncapped-tables.md
 * Size-based retention added (2026-06-14):
 *   projects/may-agent.app/agents/arc/workspace/proposals/2026-06-14-size-based-event-retention.md
 *   shared/knowledge/entries/KE-1986-platform-owner-review-context-cascade-db-bloat.md
 */

import type {
  EventEnvelope,
  HandlerContext,
  HandlerModule,
} from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";

const EVENT_RETENTION_DAYS = 5; // reduced from 7d: DB at 2506MB > 2500MB threshold (2026-06-21)
const SESSION_RETENTION_DAYS = 14;
const DIGEST_RETENTION_DAYS = 14; // session_digests: matches session retention
const WORKFLOW_RETENTION_DAYS = 14; // workflow_runs: matches session retention
const SNAPSHOT_RETENTION_DAYS = 14;
const EVALUATION_RETENTION_DAYS = 30; // evaluations: analytical value, retain longer
const VACUUM_THRESHOLD = 500; // Run VACUUM if total deletions exceed this (lowered from 1000: hourly runs delete ~837 rows but VACUUM never fired at 1000 threshold → alert #2213 DB 2518MB)
const OVERSIZED_ROW_BYTES = 1_048_576; // 1 MB — KE-1986: platform-owner-review context cascade

function cleanupEventTraceProjection(db: { run: (sql: string, params?: unknown[]) => unknown }, log: (msg: string) => void): void {
  try {
    db.run("DELETE FROM event_traces WHERE event_id NOT IN (SELECT id FROM events)");
    db.run(
      `UPDATE event_traces
       SET parent_event_id = NULL
       WHERE parent_event_id IS NOT NULL
         AND parent_event_id NOT IN (SELECT id FROM events)`,
    );
    db.run(
      `DELETE FROM event_trace_links
       WHERE from_event_id NOT IN (SELECT id FROM events)
          OR to_event_id NOT IN (SELECT id FROM events)`,
    );
  } catch (e) {
    log(`[db-retention] Error cleaning event trace projection: ${e}`);
  }
}

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry,
) => {
  return async (_event?: EventEnvelope) => {
    const db = ctx.sdk.getDb();
    const now = Date.now();

    let totalDeleted = 0;

    // ── Tier 1: Delete old events (>7 days) ──────────────────────────────
    const eventCutoff = now - EVENT_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run("DELETE FROM events WHERE timestamp < ?", [
        eventCutoff,
      ]);
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log(
        "info",
        `[db-retention] Deleted ${deleted} events older than ${EVENT_RETENTION_DAYS}d`,
      );
      cleanupEventTraceProjection(db, (msg) => ctx.sdk.log("info", msg));
    } catch (e) {
      ctx.sdk.log("info", `[db-retention] Error deleting old events: ${e}`);
    }

    // ── Tier 1: Delete old sessions (>14 days) ───────────────────────────
    const sessionCutoff = now - SESSION_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run("DELETE FROM sessions WHERE startedAt < ?", [
        sessionCutoff,
      ]);
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log(
        "info",
        `[db-retention] Deleted ${deleted} sessions older than ${SESSION_RETENTION_DAYS}d`,
      );
    } catch (e) {
      ctx.sdk.log("info", `[db-retention] Error deleting old sessions: ${e}`);
    }

    // ── Safety net: Delete old metric_snapshots (>30 days) ───────────────
    const snapshotCutoff = now - SNAPSHOT_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run(
        "DELETE FROM metric_snapshots WHERE measured_at < ?",
        [snapshotCutoff],
      );
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      if (deleted > 0) {
        ctx.sdk.log(
          "info",
          `[db-retention] Deleted ${deleted} metric_snapshots older than ${SNAPSHOT_RETENTION_DAYS}d`,
        );
      }
    } catch (e) {
      ctx.sdk.log("info", `[db-retention] Error deleting old snapshots: ${e}`);
    }

    // ── Tier 2: Delete old session_digests (>14 days) ────────────────────
    const digestCutoff = now - DIGEST_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run(
        "DELETE FROM session_digests WHERE created_at < ?",
        [digestCutoff],
      );
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log(
        "info",
        `[db-retention] Deleted ${deleted} session_digests older than ${DIGEST_RETENTION_DAYS}d`,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting old session_digests: ${e}`,
      );
    }

    // ── Tier 2: Delete old workflow_runs (>14 days) ──────────────────────
    const workflowCutoff = now - WORKFLOW_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run("DELETE FROM workflow_runs WHERE startedAt < ?", [
        workflowCutoff,
      ]);
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log(
        "info",
        `[db-retention] Deleted ${deleted} workflow_runs older than ${WORKFLOW_RETENTION_DAYS}d`,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting old workflow_runs: ${e}`,
      );
    }

    // ── Tier 2: Delete old evaluations (>30 days) ────────────────────────
    const evalCutoff = now - EVALUATION_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run("DELETE FROM evaluations WHERE createdAt < ?", [
        evalCutoff,
      ]);
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log(
        "info",
        `[db-retention] Deleted ${deleted} evaluations older than ${EVALUATION_RETENTION_DAYS}d`,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting old evaluations: ${e}`,
      );
    }

    // ── Size-based retention (KE-1986): delete oversized rows ────────────
    // The platform-owner-review workflow creates exponential context cascade
    // in event/session data blobs (1.6MB→220MB per event). Normal events avg
    // ~7KB; normal sessions avg ~42KB. 1MB threshold provides 100x+ margin.
    let oversizedDeleted = 0;

    // Oversized events.data
    try {
      const result = db.run("DELETE FROM events WHERE LENGTH(data) > ?", [
        OVERSIZED_ROW_BYTES,
      ]);
      const deleted = (result as any)?.changes ?? 0;
      oversizedDeleted += deleted;
      if (deleted > 0) {
        ctx.sdk.log(
          "info",
          `[db-retention] Deleted ${deleted} oversized events (data > 1MB)`,
        );
        cleanupEventTraceProjection(db, (msg) => ctx.sdk.log("info", msg));
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting oversized events: ${e}`,
      );
    }

    // Oversized sessions.task
    try {
      const result = db.run("DELETE FROM sessions WHERE LENGTH(task) > ?", [
        OVERSIZED_ROW_BYTES,
      ]);
      const deleted = (result as any)?.changes ?? 0;
      oversizedDeleted += deleted;
      if (deleted > 0) {
        ctx.sdk.log(
          "info",
          `[db-retention] Deleted ${deleted} oversized sessions (task > 1MB)`,
        );
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting oversized sessions: ${e}`,
      );
    }

    // Oversized session_digests.task
    try {
      const result = db.run(
        "DELETE FROM session_digests WHERE LENGTH(task) > ?",
        [OVERSIZED_ROW_BYTES],
      );
      const deleted = (result as any)?.changes ?? 0;
      oversizedDeleted += deleted;
      if (deleted > 0) {
        ctx.sdk.log(
          "info",
          `[db-retention] Deleted ${deleted} oversized session_digests (task > 1MB)`,
        );
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting oversized session_digests: ${e}`,
      );
    }

    // Oversized workflow_runs.task
    try {
      const result = db.run(
        "DELETE FROM workflow_runs WHERE LENGTH(task) > ?",
        [OVERSIZED_ROW_BYTES],
      );
      const deleted = (result as any)?.changes ?? 0;
      oversizedDeleted += deleted;
      if (deleted > 0) {
        ctx.sdk.log(
          "info",
          `[db-retention] Deleted ${deleted} oversized workflow_runs (task > 1MB)`,
        );
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error deleting oversized workflow_runs: ${e}`,
      );
    }

    totalDeleted += oversizedDeleted;

    // ── Column truncation: session_digests.task ──────────────────────────
    // session_digests.task duplicates sessions.task on every step (avg 12KB,
    // total ~530MB for 46K rows). The task text is already in sessions; the
    // digest only needs a short reference. Truncate to 2KB to save ~500MB.
    let truncatedDigestTasks = 0;
    const DIGEST_TASK_MAX_BYTES = 2048;
    try {
      const result = db.run(
        `UPDATE session_digests SET task = SUBSTR(task, 1, ?) || '... [truncated by db-retention]' WHERE LENGTH(task) > ?`,
        [DIGEST_TASK_MAX_BYTES, DIGEST_TASK_MAX_BYTES + 100],
      );
      truncatedDigestTasks = (result as any)?.changes ?? 0;
      if (truncatedDigestTasks > 0) {
        ctx.sdk.log(
          "info",
          `[db-retention] Truncated ${truncatedDigestTasks} session_digests.task columns (>${DIGEST_TASK_MAX_BYTES}B)`,
        );
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] Error truncating session_digests.task: ${e}`,
      );
    }

    // ── WAL checkpoint to reclaim WAL disk space (KE-2016) ────────────────
    // WAL grows unboundedly when concurrent connections hold read transactions.
    // TRUNCATE mode resets WAL to zero bytes if no readers are active; PASSIVE
    // at least checkpoints committed frames without blocking.
    try {
      ctx.sdk.log(
        "info",
        `[db-retention] Running PRAGMA wal_checkpoint(TRUNCATE)...`,
      );
      db.run("PRAGMA wal_checkpoint(TRUNCATE)");
      ctx.sdk.log("info", `[db-retention] WAL checkpoint complete`);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[db-retention] WAL checkpoint failed (non-critical): ${e}`,
      );
    }

    // ── VACUUM if significant deletions/truncations occurred ───────────────
    // Always VACUUM if oversized rows were deleted — they can be 200MB+ each.
    // Also VACUUM when many digest tasks were truncated — reclaims ~500MB.
    const needsVacuum =
      totalDeleted >= VACUUM_THRESHOLD ||
      oversizedDeleted > 0 ||
      truncatedDigestTasks > 1000;
    if (needsVacuum) {
      try {
        ctx.sdk.log(
          "info",
          `[db-retention] Running VACUUM (${totalDeleted} rows deleted)...`,
        );
        db.run("VACUUM");
        ctx.sdk.log("info", `[db-retention] VACUUM complete`);
        // Post-VACUUM checkpoint: VACUUM in WAL mode rewrites the entire DB
        // through the WAL (~1.4GB), causing a transient spike visible to
        // metrics-snapshot. Checkpoint immediately to reclaim that space.
        try {
          db.run("PRAGMA wal_checkpoint(TRUNCATE)");
          ctx.sdk.log(
            "info",
            `[db-retention] Post-VACUUM WAL checkpoint complete`,
          );
        } catch (e2) {
          ctx.sdk.log(
            "info",
            `[db-retention] Post-VACUUM WAL checkpoint failed (non-critical): ${e2}`,
          );
        }
      } catch (e) {
        ctx.sdk.log(
          "info",
          `[db-retention] VACUUM failed (non-critical): ${e}`,
        );
      }
    }

    // ── Emit summary event ───────────────────────────────────────────────
    ctx.sdk.emit("handler.completed", {
      handler: "db-retention",
      deletedEvents: totalDeleted,
      oversizedDeleted,
      truncatedDigestTasks,
      vacuumed: needsVacuum,
    });

    ctx.sdk.log(
      "info",
      `[db-retention] Complete. Total deleted: ${totalDeleted}`,
    );
  };
};
