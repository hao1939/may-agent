/**
 * audit-requests — JS cron handler (Phase 4 of request-tracking).
 *
 * Hourly job that reconciles request lifecycle:
 * 1. Warns on CREATED requests older than 2h (stale — never picked up)
 * 2. Resets IN_PROGRESS requests older than 4h with no active session → CREATED
 * 3. Archives COMPLETED/FAILED/BLOCKED requests older than 7 days
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Configuration ─────────────────────────────────────────────────────

/** Requests older than this in CREATED status trigger a warning. */
const STALE_CREATED_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Requests older than this in IN_PROGRESS with no active session get reset. */
const STALE_IN_PROGRESS_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Completed/failed requests older than this get archived (deleted). */
const ARCHIVE_DAYS = 7;

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    // Lazy import to avoid bun:sqlite issues in vitest
    const {
      getStaleRequests,
      getActiveRequests,
      updateRequest,
      archiveOld,
    } = await import("../../../src/lib/requests.js");

    // 1. Warn on stale CREATED requests (> 2h old, never picked up)
    const staleCreated = getStaleRequests(ctx.persistDir, STALE_CREATED_MS)
      .filter(r => r.status === "CREATED");

    if (staleCreated.length > 0) {
      ctx.log(
        `[audit-requests] ⚠️ ${staleCreated.length} stale CREATED request(s) older than 2h: ` +
        staleCreated.map(r => `${r.requestId.slice(0, 8)}… (${r.fromEntity}→${r.toAgent})`).join(", ")
      );
    }

    // 2. Reset orphaned IN_PROGRESS requests (> 4h, no active session)
    const activeSessions = getActiveSessionIds(ctx.persistDir);
    const staleInProgress = getStaleRequests(ctx.persistDir, STALE_IN_PROGRESS_MS)
      .filter(r => r.status === "IN_PROGRESS")
      .filter(r => !r.sessionId || !activeSessions.has(r.sessionId));

    let resetCount = 0;
    for (const req of staleInProgress) {
      try {
        updateRequest(ctx.persistDir, req.requestId, {
          status: "CREATED",
          sessionId: undefined,
        });
        resetCount++;
      } catch {
        // Non-fatal — log and continue
        ctx.log(`[audit-requests] Failed to reset request ${req.requestId}`);
      }
    }

    if (resetCount > 0) {
      ctx.log(`[audit-requests] Reset ${resetCount} orphaned IN_PROGRESS request(s) to CREATED.`);
    }

    // 3. Archive old completed/failed requests (> 7 days)
    const archived = archiveOld(ctx.persistDir, ARCHIVE_DAYS);
    if (archived > 0) {
      ctx.log(`[audit-requests] Archived ${archived} completed/failed request(s) older than ${ARCHIVE_DAYS} days.`);
    }

    // Summary
    const active = getActiveRequests(ctx.persistDir);
    ctx.log(
      `[audit-requests] Audit complete. Active: ${active.length}, ` +
      `Stale warnings: ${staleCreated.length}, ` +
      `Reset: ${resetCount}, Archived: ${archived}.`
    );
  };
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Get set of currently active session IDs by scanning .state/sessions/active/.
 */
function getActiveSessionIds(persistDir: string): Set<string> {
  const activeDir = join(persistDir, "sessions", "active");
  if (!existsSync(activeDir)) return new Set();
  try {
    return new Set(
      readdirSync(activeDir).filter(n => n.startsWith("s_"))
    );
  } catch {
    return new Set();
  }
}
