/**
 * audit-requests — JS cron handler (Phase 4 of request-tracking).
 *
 * Runs every 2h to reconcile request lifecycle:
 * 1. Auto-expires stale CREATED `send` requests older than 4h
 *    (they've been injected into multiple heartbeats by then — continuing
 *    to inject them wastes ~$58/day in tokens at 31 stuck requests)
 * 2. Auto-expires stale CREATED `call` requests to non-agent targets (e.g. "finish")
 *    older than 1h (these are tracking artifacts, not real requests)
 * 3. Resets IN_PROGRESS requests older than 4h with no active session → CREATED
 * 4. Archives COMPLETED/FAILED/BLOCKED requests older than 7 days
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Configuration ─────────────────────────────────────────────────────

/** Send requests older than this in CREATED status get auto-expired. */
const STALE_SEND_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Non-agent call requests (e.g. "finish") older than this get auto-expired. */
const STALE_NONAGENT_CALL_MS = 1 * 60 * 60 * 1000; // 1 hour

/** Requests older than this in IN_PROGRESS with no active session get reset. */
const STALE_IN_PROGRESS_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Completed/failed requests older than this get archived (deleted). */
const ARCHIVE_DAYS = 7;

/** Known agent names — requests to anything else are tracking artifacts. */
const KNOWN_AGENTS = new Set([
  "may", "bob", "optimizer", "coach", "tech-lead", "evaluator",
  "scout", "qa", "coder", "amy", "amy-kimi",
]);

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

    let expiredSends = 0;
    let expiredNonAgent = 0;

    // 1. Auto-expire stale CREATED `send` requests (> 4h)
    //    These have been injected into enough heartbeats. Keeping them
    //    just bloats context and wastes tokens.
    const staleSends = getStaleRequests(ctx.persistDir, STALE_SEND_MS)
      .filter(r => r.status === "CREATED" && r.method === "send");

    for (const req of staleSends) {
      try {
        updateRequest(ctx.persistDir, req.requestId, {
          status: "COMPLETED",
          summary: `Auto-expired after ${Math.round((Date.now() - req.createdAt) / 3600000)}h (injected into heartbeats, presumed processed)`,
          completedAt: Date.now(),
        });
        expiredSends++;
      } catch {
        ctx.log(`[audit-requests] Failed to expire send request ${req.requestId}`);
      }
    }

    if (expiredSends > 0) {
      ctx.log(
        `[audit-requests] Auto-expired ${expiredSends} stale CREATED send request(s) older than ${STALE_SEND_MS / 3600000}h.`
      );
    }

    // 2. Auto-expire stale CREATED `call` requests to non-agent targets
    //    e.g. "bob -> finish" — these are tracking artifacts from the finish() tool
    const staleNonAgent = getStaleRequests(ctx.persistDir, STALE_NONAGENT_CALL_MS)
      .filter(r => r.status === "CREATED" && r.method === "call" && !KNOWN_AGENTS.has(r.toAgent));

    for (const req of staleNonAgent) {
      try {
        updateRequest(ctx.persistDir, req.requestId, {
          status: "COMPLETED",
          summary: `Auto-expired: non-agent call target "${req.toAgent}" (tracking artifact)`,
          completedAt: Date.now(),
        });
        expiredNonAgent++;
      } catch {
        ctx.log(`[audit-requests] Failed to expire non-agent request ${req.requestId}`);
      }
    }

    if (expiredNonAgent > 0) {
      ctx.log(
        `[audit-requests] Auto-expired ${expiredNonAgent} non-agent call request(s).`
      );
    }

    // 3. Reset orphaned IN_PROGRESS requests (> 4h, no active session)
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
        ctx.log(`[audit-requests] Failed to reset request ${req.requestId}`);
      }
    }

    if (resetCount > 0) {
      ctx.log(`[audit-requests] Reset ${resetCount} orphaned IN_PROGRESS request(s) to CREATED.`);
    }

    // 4. Archive old completed/failed requests (> 7 days)
    const archived = archiveOld(ctx.persistDir, ARCHIVE_DAYS);
    if (archived > 0) {
      ctx.log(`[audit-requests] Archived ${archived} completed/failed request(s) older than ${ARCHIVE_DAYS} days.`);
    }

    // Summary
    const active = getActiveRequests(ctx.persistDir);
    ctx.log(
      `[audit-requests] Audit complete. Active: ${active.length}, ` +
      `Expired sends: ${expiredSends}, Expired non-agent: ${expiredNonAgent}, ` +
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
