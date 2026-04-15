/**
 * proof-of-life.ts — Periodic system summary sent to Telegram every 2h.
 *
 * Gives the human operator visibility into system activity without
 * needing to check the web UI. Compact ~10-15 line message with:
 *   1. Per-agent session counts and error counts
 *   2. High-op sessions (>30 ops)
 *   3. Active persistent tasks
 *   4. Total sessions / total errors footer
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Constants ─────────────────────────────────────────────────────────

const MS_2H = 2 * 60 * 60 * 1000;

// ── Types ─────────────────────────────────────────────────────────────

interface AgentRow {
  agent: string;
  n: number;
  errs: number;
}

interface HighOpRow {
  agent: string;
  opCount: number;
  task: string;
}

interface PersistentTaskRow {
  agent: string;
  task: string;
  sessionId: string;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    const cutoff = Date.now() - MS_2H;

    // 1. Per-agent session counts and error counts
    let agentRows: AgentRow[] = [];
    try {
      agentRows = db.prepare(
        `SELECT agent, COUNT(*) as n,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errs
         FROM sessions
         WHERE startedAt > ?
         GROUP BY agent
         ORDER BY n DESC`,
      ).all(cutoff) as AgentRow[];
    } catch {
      // Table may not exist yet
    }

    // 2. High-op sessions (>30 ops)
    let highOpRows: HighOpRow[] = [];
    try {
      highOpRows = db.prepare(
        `SELECT agent, opCount, task
         FROM sessions
         WHERE startedAt > ? AND opCount > 30
         ORDER BY opCount DESC
         LIMIT 5`,
      ).all(cutoff) as HighOpRow[];
    } catch {
      // Table may not exist
    }

    // 3. Active persistent tasks (sessions from persistent-task workflow still running)
    let persistentRows: PersistentTaskRow[] = [];
    try {
      persistentRows = db.prepare(
        `SELECT agent, task, sessionId
         FROM sessions
         WHERE status = 'running'
           AND workflowRunId IS NOT NULL
           AND task LIKE '%persistent%'
         LIMIT 5`,
      ).all() as PersistentTaskRow[];
    } catch {
      // Column may not exist
    }

    // Compute totals
    let totalSessions = 0;
    let totalErrors = 0;
    for (const row of agentRows) {
      totalSessions += row.n;
      totalErrors += row.errs;
    }

    // If no activity at all, send a minimal message
    if (totalSessions === 0) {
      ctx.notify("🫀 *Proof of Life* — Last 2h: no sessions recorded.");
      ctx.log("[proof-of-life] No sessions in last 2h — sent minimal digest.");
      return;
    }

    // Format the message
    const lines: string[] = [];
    lines.push("🫀 *Proof of Life* — Last 2h activity:");
    lines.push("");

    // Per-agent lines
    for (const row of agentRows) {
      const errStr = row.errs > 0 ? ` ⚠️${row.errs}err` : "";
      lines.push(`  ${row.agent}: ${row.n} sessions${errStr}`);
    }

    // High-op sessions
    if (highOpRows.length > 0) {
      lines.push("");
      lines.push("📊 High-op sessions:");
      for (const row of highOpRows) {
        const taskSnip = (row.task || "").replace(/\n/g, " ").slice(0, 60);
        lines.push(`  ${row.agent} (${row.opCount} ops) — ${taskSnip}`);
      }
    }

    // Persistent tasks
    if (persistentRows.length > 0) {
      lines.push("");
      lines.push("🔄 Active persistent tasks:");
      for (const row of persistentRows) {
        const taskSnip = (row.task || "").replace(/\n/g, " ").slice(0, 60);
        lines.push(`  ${row.agent}: ${taskSnip}`);
      }
    }

    // Footer
    lines.push("");
    lines.push(`Total: ${totalSessions} sessions, ${totalErrors} errors.`);

    const message = lines.join("\n");
    ctx.notify(message);
    ctx.log(`[proof-of-life] Sent digest: ${totalSessions} sessions, ${totalErrors} errors.`);
  };
};
