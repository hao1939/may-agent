/**
 * standing-orders-check — Periodic compliance check.
 *
 * Scans recent sessions and git changes for standing order violations.
 * Reports violations to May for follow-up.
 */
import { execSync } from "node:child_process";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    const since = Date.now() - 30 * 60 * 1000;
    const violations: string[] = [];

    // ORDER-001/002: Sessions that claim success but produced nothing
    try {
      const emptySessions = db.prepare(`
        SELECT agent, sessionId, opCount FROM sessions 
        WHERE startedAt > ? AND status = 'done' AND opCount > 3
        AND agent NOT IN ('evaluator')
      `).all(since) as Array<{ agent: string; sessionId: string; opCount: number }>;

      for (const s of emptySessions) {
        const digest = db.prepare(
          `SELECT files_modified FROM session_digests WHERE sessionId = ?`
        ).get(s.sessionId) as { files_modified: string | null } | undefined;
        const files = digest?.files_modified ? JSON.parse(digest.files_modified) : [];
        if (files.length === 0) {
          const hasWorkflow = db.prepare(
            `SELECT 1 FROM sessions WHERE parentSessionId = ? LIMIT 1`
          ).get(s.sessionId);
          if (!hasWorkflow) {
            violations.push(
              `ORDER-001/002: ${s.agent} session ${s.sessionId} (${s.opCount} ops) produced no files and no workflow.`
            );
          }
        }
      }
    } catch { /* DB query failed — skip */ }

    // ORDER-008: May used message instead of fork
    try {
      const mayMessages = db.prepare(`
        SELECT requestId FROM requests 
        WHERE fromEntity = 'may' AND method = 'message' AND createdAt > ?
        AND task NOT LIKE '%convention%' AND task NOT LIKE '%metric%'
      `).all(since) as Array<{ requestId: string }>;
      if (mayMessages.length > 0) {
        violations.push(
          `ORDER-008: May used agents.message ${mayMessages.length} time(s). Should use agents.fork.`
        );
      }
    } catch { /* skip */ }

    // GATEKEEPER: Check for edits to shared system files
    try {
      const gitLog = execSync(
        `cd /app/agents && git log --oneline --since="30 minutes ago" -- shared/workflows/ shared/guards/ shared/common-sense.md shared/standing-orders.md 2>/dev/null`,
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      if (gitLog) {
        const lines = gitLog.split("\n").filter(l => l.trim());
        for (const line of lines) {
          // Skip if it's a human commit (Hao)
          if (line.includes("Hao") || line.includes("hao")) continue;
          violations.push(
            `GATEKEEPER: System-scope file edited: ${line}. Shared workflows, guards, common-sense, and standing-orders need review.`
          );
        }
      }
    } catch { /* git not available or no changes */ }

    if (violations.length > 0) {
      const report = `Standing orders check (${violations.length} violation(s)):\n` +
        violations.map(v => `- ${v}`).join("\n");
      ctx.log(report);
      ctx.notify(report);
    }
  };
};
