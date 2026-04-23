/**
 * audit-requests — JS cron handler (Phase 4 of request-tracking).
 *
 * Runs every 2h to reconcile request lifecycle:
 * 0. **Bulk expiry** — expire ALL CREATED requests older than 48h,
 *    EXCEPT P0 requests from human/Hao (those are important directives)
 * 1. Auto-expires stale CREATED `send` requests older than 4h
 *    (they've been injected into multiple heartbeats by then — continuing
 *    to inject them wastes ~$58/day in tokens at 31 stuck requests)
 * 2. Auto-expires stale CREATED `call` requests to non-agent targets (e.g. "finish")
 *    older than 1h (these are tracking artifacts, not real requests)
 * 2b. Auto-expires stale CREATED `call` requests to known agents older than 4h
 *    (test/debug calls like "echo hello" that were never picked up)
 * 3. Resets IN_PROGRESS requests older than 4h with no active session → CREATED
 * 4. Archives COMPLETED/FAILED requests older than 7 days
 *
 * Also exports `shouldRateLimit()` for use by request-creation code:
 *   if an agent already has >50 pending CREATED requests, skip creating
 *   new P2 requests (and >100 skips P1 too).
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Configuration ─────────────────────────────────────────────────────

/** CREATED requests (any method) older than this get bulk-expired, except P0 from human. */
const BULK_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Send requests older than this in CREATED status get auto-expired. */
const STALE_SEND_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Non-agent call requests (e.g. "finish") older than this get auto-expired. */
const STALE_NONAGENT_CALL_MS = 1 * 60 * 60 * 1000; // 1 hour

/** Agent-targeted call requests older than this get auto-expired (stale test/debug calls). */
const STALE_AGENT_CALL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Requests older than this in IN_PROGRESS with no active session get reset. */
const STALE_IN_PROGRESS_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Completed/failed requests older than this get archived (deleted). */
const ARCHIVE_DAYS = 7;

/** Known agent names — requests to anything else are tracking artifacts. */
const KNOWN_AGENTS = new Set([
  "may", "bob", "optimizer", "coach", "tech-lead", "evaluator",
  "scout", "qa", "coder", "amy", "amy-kimi",
]);

/** Rate-limit: skip P2 creation when agent has this many pending requests. */
const RATE_LIMIT_P2_THRESHOLD = 50;

/** Rate-limit: skip P1 creation when agent has this many pending requests. */
const RATE_LIMIT_P1_THRESHOLD = 100;

/** Entities whose P0 requests are never auto-expired. */
const PROTECTED_ENTITIES = new Set(["human", "hao", "user"]);

// ── Types ─────────────────────────────────────────────────────────────

interface RequestRow {
  requestId: string;
  status: string;
  method: string;
  toAgent: string;
  fromEntity: string | null;
  priority: string | null;
  sessionId: string | null;
  createdAt: number;
  completedAt: number | null;
  summary: string | null;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    let db: ReturnType<HandlerContext["getDb"]>;
    try {
      db = ctx.getDb();
    } catch {
      ctx.log("[audit-requests] DB not available, skipping audit.");
      return;
    }

    const now = Date.now();
    let expiredSends = 0;
    let expiredNonAgent = 0;
    let bulkExpired = 0;

    // 0. Bulk-expire ALL CREATED requests older than 48h
    //    Exception: P0 requests from human/Hao are never auto-expired.
    //    This is the main mechanism to keep the pending queue under 100.
    try {
      const bulkStale = db.prepare(
        `SELECT requestId, status, method, toAgent, fromEntity, priority, createdAt
         FROM requests WHERE status = 'CREATED' AND createdAt < ?`
      ).all(now - BULK_EXPIRY_MS) as RequestRow[];

      for (const req of bulkStale) {
        // Protect P0 requests from human/Hao
        const entity = (req.fromEntity ?? "").toLowerCase();
        const isProtected = (req.priority === "P0") &&
          Array.from(PROTECTED_ENTITIES).some(e => entity.includes(e));
        if (isProtected) continue;

        try {
          db.prepare(
            `UPDATE requests SET status = ?, summary = ?, completedAt = ?, updatedAt = ? WHERE requestId = ?`
          ).run(
            "COMPLETED",
            `Auto-expired after ${Math.round((now - req.createdAt) / 3600000)}h (bulk 48h expiry)`,
            now,
            now,
            req.requestId,
          );
          bulkExpired++;
        } catch {
          ctx.log(`[audit-requests] Failed to bulk-expire request ${req.requestId}`);
        }
      }
    } catch {
      ctx.log("[audit-requests] Failed to query for bulk expiry.");
    }

    if (bulkExpired > 0) {
      ctx.log(
        `[audit-requests] Bulk-expired ${bulkExpired} CREATED request(s) older than ${BULK_EXPIRY_MS / 3600000}h.`
      );
    }

    // 1. Auto-expire stale CREATED `send` requests (> 4h)
    //    These have been injected into enough heartbeats. Keeping them
    //    just bloats context and wastes tokens.
    try {
      const staleSends = db.prepare(
        `SELECT * FROM requests WHERE status = 'CREATED' AND method = 'send' AND createdAt < ?`
      ).all(now - STALE_SEND_MS) as RequestRow[];

      for (const req of staleSends) {
        try {
          db.prepare(
            `UPDATE requests SET status = ?, summary = ?, completedAt = ?, updatedAt = ? WHERE requestId = ?`
          ).run(
            "COMPLETED",
            `Auto-expired after ${Math.round((now - req.createdAt) / 3600000)}h (injected into heartbeats, presumed processed)`,
            now,
            now,
            req.requestId,
          );
          expiredSends++;
        } catch {
          ctx.log(`[audit-requests] Failed to expire send request ${req.requestId}`);
        }
      }
    } catch {
      ctx.log("[audit-requests] Failed to query stale send requests.");
    }

    if (expiredSends > 0) {
      ctx.log(
        `[audit-requests] Auto-expired ${expiredSends} stale CREATED send request(s) older than ${STALE_SEND_MS / 3600000}h.`
      );
    }

    // 2. Auto-expire stale CREATED `call` requests to non-agent targets
    //    e.g. "bob -> finish" — these are tracking artifacts from the finish() tool
    try {
      const staleCallRows = db.prepare(
        `SELECT * FROM requests WHERE status = 'CREATED' AND method = 'call' AND createdAt < ?`
      ).all(now - STALE_NONAGENT_CALL_MS) as RequestRow[];

      const staleNonAgent = staleCallRows.filter(r => !KNOWN_AGENTS.has(r.toAgent));

      for (const req of staleNonAgent) {
        try {
          db.prepare(
            `UPDATE requests SET status = ?, summary = ?, completedAt = ?, updatedAt = ? WHERE requestId = ?`
          ).run(
            "COMPLETED",
            `Auto-expired: non-agent call target "${req.toAgent}" (tracking artifact)`,
            now,
            now,
            req.requestId,
          );
          expiredNonAgent++;
        } catch {
          ctx.log(`[audit-requests] Failed to expire non-agent request ${req.requestId}`);
        }
      }
    } catch {
      ctx.log("[audit-requests] Failed to query stale non-agent call requests.");
    }

    if (expiredNonAgent > 0) {
      ctx.log(
        `[audit-requests] Auto-expired ${expiredNonAgent} non-agent call request(s).`
      );
    }

    // 2b. Auto-expire stale CREATED `call` requests to known agents (> 4h)
    //     These are typically test/debug calls ("echo hello") that were never picked up.
    //     At 72+ stale requests, they bloat the active request list and waste context.
    let expiredAgentCalls = 0;
    try {
      const staleAgentCallRows = db.prepare(
        `SELECT * FROM requests WHERE status = 'CREATED' AND method = 'call' AND createdAt < ?`
      ).all(now - STALE_AGENT_CALL_MS) as RequestRow[];

      const staleAgentCalls = staleAgentCallRows.filter(r => KNOWN_AGENTS.has(r.toAgent));

      for (const req of staleAgentCalls) {
        try {
          db.prepare(
            `UPDATE requests SET status = ?, summary = ?, completedAt = ?, updatedAt = ? WHERE requestId = ?`
          ).run(
            "COMPLETED",
            `Auto-expired: stale call to "${req.toAgent}" after ${Math.round((now - req.createdAt) / 3600000)}h (never picked up)`,
            now,
            now,
            req.requestId,
          );
          expiredAgentCalls++;
        } catch {
          ctx.log(`[audit-requests] Failed to expire agent call request ${req.requestId}`);
        }
      }
    } catch {
      ctx.log("[audit-requests] Failed to query stale agent call requests.");
    }

    if (expiredAgentCalls > 0) {
      ctx.log(
        `[audit-requests] Auto-expired ${expiredAgentCalls} stale agent call request(s) older than ${STALE_AGENT_CALL_MS / 3600000}h.`
      );
    }

    // 3. Reset orphaned IN_PROGRESS requests (> 4h, no active session)
    let resetCount = 0;
    try {
      const activeSessions = getActiveSessionIds(ctx.persistDir);
      const staleInProgress = db.prepare(
        `SELECT * FROM requests WHERE status = 'IN_PROGRESS' AND createdAt < ?`
      ).all(now - STALE_IN_PROGRESS_MS) as RequestRow[];

      const orphaned = staleInProgress.filter(
        r => !r.sessionId || !activeSessions.has(r.sessionId)
      );

      for (const req of orphaned) {
        try {
          db.prepare(
            `UPDATE requests SET status = 'CREATED', sessionId = NULL, updatedAt = ? WHERE requestId = ?`
          ).run(now, req.requestId);
          resetCount++;
        } catch {
          ctx.log(`[audit-requests] Failed to reset request ${req.requestId}`);
        }
      }
    } catch {
      ctx.log("[audit-requests] Failed to query stale in-progress requests.");
    }

    if (resetCount > 0) {
      ctx.log(`[audit-requests] Reset ${resetCount} orphaned IN_PROGRESS request(s) to CREATED.`);
    }

    // 4. Archive old completed/failed requests (> 7 days)
    let archived = 0;
    try {
      const archiveCutoff = now - ARCHIVE_DAYS * 86400000;
      const result = db.prepare(
        `DELETE FROM requests WHERE status IN ('COMPLETED', 'FAILED') AND completedAt < ?`
      ).run(archiveCutoff);
      archived = (result as { changes: number }).changes;
    } catch {
      ctx.log("[audit-requests] Failed to archive old requests.");
    }
    if (archived > 0) {
      ctx.log(`[audit-requests] Archived ${archived} completed/failed request(s) older than ${ARCHIVE_DAYS} days.`);
    }

    // Summary
    let activeCount = 0;
    try {
      const row = db.prepare(
        `SELECT COUNT(*) as count FROM requests WHERE status IN ('CREATED', 'IN_PROGRESS')`
      ).get() as { count: number } | null;
      activeCount = row?.count ?? 0;
    } catch {
      // DB query failed; leave at 0
    }
    ctx.log(
      `[audit-requests] Audit complete. Active: ${activeCount}, ` +
      `Bulk expired (48h): ${bulkExpired}, ` +
      `Expired sends: ${expiredSends}, Expired non-agent: ${expiredNonAgent}, ` +
      `Expired agent calls: ${expiredAgentCalls}, ` +
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

// ── Rate-limiting (exported for use by request-creation code) ─────────

/**
 * Check if request creation should be skipped for a given agent/priority.
 *
 * Call this before INSERT INTO requests to prevent queue bloat:
 * - Agent has >50 pending CREATED requests → skip P2
 * - Agent has >100 pending CREATED requests → skip P1
 * - P0 requests are never rate-limited
 *
 * @returns { limited: boolean, reason?: string, pendingCount: number }
 */
export function shouldRateLimit(
  db: { prepare(sql: string): { get(...args: any[]): any } },
  toAgent: string,
  priority: string | null | undefined,
): { limited: boolean; reason?: string; pendingCount: number } {
  const p = (priority ?? "P1").toUpperCase();

  // P0 is never rate-limited
  if (p === "P0") return { limited: false, pendingCount: 0 };

  let pendingCount = 0;
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as count FROM requests WHERE status = 'CREATED' AND toAgent = ?`
    ).get(toAgent) as { count: number } | null;
    pendingCount = row?.count ?? 0;
  } catch {
    // DB error → don't block creation
    return { limited: false, pendingCount: 0 };
  }

  if (p === "P2" && pendingCount >= RATE_LIMIT_P2_THRESHOLD) {
    return {
      limited: true,
      reason: `Agent "${toAgent}" has ${pendingCount} pending requests (threshold: ${RATE_LIMIT_P2_THRESHOLD} for P2)`,
      pendingCount,
    };
  }

  if (p === "P1" && pendingCount >= RATE_LIMIT_P1_THRESHOLD) {
    return {
      limited: true,
      reason: `Agent "${toAgent}" has ${pendingCount} pending requests (threshold: ${RATE_LIMIT_P1_THRESHOLD} for P1)`,
      pendingCount,
    };
  }

  return { limited: false, pendingCount };
}
