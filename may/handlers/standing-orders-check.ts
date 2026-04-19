/**
 * standing-orders-check — Periodic compliance check.
 *
 * Scans recent sessions for standing order violations.
 * Reports violations to May for follow-up.
 * Runs every 30 min (same as heartbeats).
 *
 * Checks are mechanical — pattern matching on session data, no LLM needed.
 */
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    const since = Date.now() - 30 * 60 * 1000; // last 30 min

    const violations: string[] = [];

    // ORDER-001/002: Sessions that claim success but produced nothing
    const emptySessions = db.prepare(`
      SELECT agent, sessionId, opCount FROM sessions 
      WHERE startedAt > ? AND status = 'done' AND opCount > 3
      AND agent NOT IN ('evaluator')
    `).all(since) as Array<{ agent: string; sessionId: string; opCount: number }>;

    for (const s of emptySessions) {
      // Check if session has any file modifications in its digest
      const digest = db.prepare(
        `SELECT files_modified FROM session_digests WHERE sessionId = ?`
      ).get(s.sessionId) as { files_modified: string | null } | undefined;
      
      const files = digest?.files_modified ? JSON.parse(digest.files_modified) : [];
      if (files.length === 0) {
        // Check if it ran a workflow (that counts as production)
        const hasWorkflow = db.prepare(
          `SELECT 1 FROM sessions WHERE parentSessionId = ? LIMIT 1`
        ).get(s.sessionId);
        
        if (!hasWorkflow) {
          violations.push(
            `ORDER-001/002: ${s.agent} session ${s.sessionId} (${s.opCount} ops) produced no files and no workflow. Actions over words.`
          );
        }
      }
    }

    // ORDER-004: Check if any agent wrote budget language to heartbeat files
    // We can check git diff for recent changes
    // Skip for now — this is better caught at write time

    // ORDER-008: Check if May used message instead of fork
    const mayMessages = db.prepare(`
      SELECT requestId, task FROM requests 
      WHERE fromEntity = 'may' AND method = 'message' AND createdAt > ?
      AND task NOT LIKE '%convention%' AND task NOT LIKE '%metric%'
    `).all(since) as Array<{ requestId: string; task: string }>;

    if (mayMessages.length > 0) {
      violations.push(
        `ORDER-008: May used agents.message ${mayMessages.length} time(s) in last 30min. Should use agents.fork for dispatching work.`
      );
    }

    // Report violations
    if (violations.length > 0) {
      const report = `Standing orders check found ${violations.length} violation(s):\n` +
        violations.map(v => `- ${v}`).join("\n");
      ctx.log(report);
      ctx.notify(report);
    }
  };
};
