/**
 * db-retention — Enforces data retention policy on the runtime SQLite DB.
 *
 * Retention windows:
 *   - events: 7 days
 *   - sessions: 14 days
 *   - metric_snapshots: 30 days (already handled by metrics-snapshot, but
 *     included here as a safety net)
 *
 * Runs daily. After deletions exceed a threshold, runs VACUUM to reclaim space.
 *
 * Approved via work-queue.md (2026-06-04):
 *   agents/arc/workspace/proposals/2026-05-27-db-retention-policy.md
 */

import type { EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";

const EVENT_RETENTION_DAYS = 7;
const SESSION_RETENTION_DAYS = 14;
const SNAPSHOT_RETENTION_DAYS = 30;
const VACUUM_THRESHOLD = 1000; // Run VACUUM if total deletions exceed this

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: EventEnvelope) => {
    const db = ctx.sdk.getDb();
    const now = Date.now();

    let totalDeleted = 0;

    // ── Tier 1: Delete old events (>7 days) ──────────────────────────────
    const eventCutoff = now - EVENT_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run(
        "DELETE FROM events WHERE timestamp < ?",
        [eventCutoff]
      );
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log("info", `[db-retention] Deleted ${deleted} events older than ${EVENT_RETENTION_DAYS}d`);
    } catch (e) {
      ctx.sdk.log("info", `[db-retention] Error deleting old events: ${e}`);
    }

    // ── Tier 1: Delete old sessions (>14 days) ───────────────────────────
    const sessionCutoff = now - SESSION_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run(
        "DELETE FROM sessions WHERE startedAt < ?",
        [sessionCutoff]
      );
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      ctx.sdk.log("info", `[db-retention] Deleted ${deleted} sessions older than ${SESSION_RETENTION_DAYS}d`);
    } catch (e) {
      ctx.sdk.log("info", `[db-retention] Error deleting old sessions: ${e}`);
    }

    // ── Safety net: Delete old metric_snapshots (>30 days) ───────────────
    const snapshotCutoff = now - SNAPSHOT_RETENTION_DAYS * 86_400_000;
    try {
      const result = db.run(
        "DELETE FROM metric_snapshots WHERE measured_at < ?",
        [snapshotCutoff]
      );
      const deleted = (result as any)?.changes ?? 0;
      totalDeleted += deleted;
      if (deleted > 0) {
        ctx.sdk.log("info", `[db-retention] Deleted ${deleted} metric_snapshots older than ${SNAPSHOT_RETENTION_DAYS}d`);
      }
    } catch (e) {
      ctx.sdk.log("info", `[db-retention] Error deleting old snapshots: ${e}`);
    }

    // ── VACUUM if significant deletions occurred ─────────────────────────
    if (totalDeleted >= VACUUM_THRESHOLD) {
      try {
        ctx.sdk.log("info", `[db-retention] Running VACUUM (${totalDeleted} rows deleted)...`);
        db.run("VACUUM");
        ctx.sdk.log("info", `[db-retention] VACUUM complete`);
      } catch (e) {
        ctx.sdk.log("info", `[db-retention] VACUUM failed (non-critical): ${e}`);
      }
    }

    // ── Emit summary event ───────────────────────────────────────────────
    ctx.sdk.emit("handler.completed", {
      handler: "db-retention",
      deletedEvents: totalDeleted,
      vacuumed: totalDeleted >= VACUUM_THRESHOLD,
    });

    ctx.sdk.log("info", `[db-retention] Complete. Total deleted: ${totalDeleted}`);
  };
};
