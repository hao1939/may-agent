/**
 * audit-requests — JS cron handler (Phase 4 of request-tracking).
 *
 * Runs every 2h to reconcile request lifecycle:
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
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Configuration ─────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────

interface RequestRow {
  requestId: string;
  status: string;
  method: string;
  toAgent: string;
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
