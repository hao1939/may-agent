/**
 * system-dashboard.ts — Read-only CLI status summary for `--status`
 *
 * Queries `may.db` directly via a single read-only SQLite handle without
 * copying multi-GB database files into `/tmp`.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openReadOnlyDatabase } from "../db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function printSystemStatus(
  persistDir: string,
  _opts?: { includeProcessHealth?: boolean },
): string {
  const dbPath = join(persistDir, "may.db");
  const lines = ["may-agent status", "═".repeat(62)];

  if (!existsSync(dbPath)) {
    lines.push("  No runtime database found.", "");
    return lines.join("\n");
  }

  // When no active WAL sidecar exists, open with immutable=1 so a read-only
  // status probe never creates -wal/-shm sidecars in a settled state directory;
  // when a live daemon has -wal open, read directly without copying gigabytes.
  const target = existsSync(`${dbPath}-wal`) ? dbPath : `${pathToFileURL(dbPath).href}?immutable=1`;
  const db = openReadOnlyDatabase(target);
  try {
    const since = Date.now() - DAY_MS;

    // 1. Open App Tasks summary (attention / running / waiting / pending)
    try {
      const appRows = db
        .prepare(
          `SELECT app_id,
                  SUM(CASE WHEN json_extract(resource_json, '$.status.phase') IN ('attention', 'failed') THEN 1 ELSE 0 END) AS attention,
                  SUM(CASE WHEN json_extract(resource_json, '$.status.currentAttemptId') IS NOT NULL THEN 1 ELSE 0 END) AS running,
                  SUM(CASE WHEN json_extract(resource_json, '$.status.phase') = 'waiting' THEN 1 ELSE 0 END) AS waiting,
                  SUM(CASE WHEN json_extract(resource_json, '$.status.phase') = 'pending' THEN 1 ELSE 0 END) AS pending
           FROM app_tasks t
           WHERE NOT EXISTS (
             SELECT 1 FROM app_task_cancellations c
             WHERE c.app_id = t.app_id AND c.task_id = t.task_id
           )
           GROUP BY app_id
           ORDER BY app_id ASC`,
        )
        .all() as Array<{
        app_id: string;
        attention: number;
        running: number;
        waiting: number;
        pending: number;
      }>;
      if (appRows.length > 0) {
        lines.push("", "─".repeat(62), " APPS", "─".repeat(62));
        lines.push(
          `  ${"App".padEnd(22)} ${"Run".padStart(5)} ${"Pend".padStart(5)} ${"Wait".padStart(5)} ${"Attn".padStart(5)}`,
        );
        for (const r of appRows) {
          lines.push(
            `  ${String(r.app_id).padEnd(22)} ${String(r.running ?? 0).padStart(5)} ${String(r.pending ?? 0).padStart(5)} ${String(r.waiting ?? 0).padStart(5)} ${String(r.attention ?? 0).padStart(5)}`,
          );
        }
      }
    } catch {
      // Tolerate unmigrated fixture schemas
    }

    // 2. Agent session summary (last 24h)
    const agentRows = db
      .prepare(
        `SELECT agent,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed
         FROM sessions
         WHERE startedAt >= ?
         GROUP BY agent
         ORDER BY total DESC, agent ASC`,
      )
      .all(since) as Array<{
      agent: string;
      total: number;
      completed: number;
      failed: number;
    }>;

    lines.push("", "─".repeat(62), " AGENTS (last 24h)", "─".repeat(62));
    if (agentRows.length > 0) {
      lines.push(
        `  ${"Agent".padEnd(16)} ${"Sess".padStart(5)} ${"Done".padStart(5)} ${"Fail".padStart(5)} ${"Rate".padStart(6)}`,
      );
      for (const s of agentRows) {
        const total = Number(s.total ?? 0);
        const completed = Number(s.completed ?? 0);
        const failed = Number(s.failed ?? 0);
        const rate = total > 0 ? `${Math.round((completed / total) * 100)}%` : "—";
        lines.push(
          `  ${String(s.agent).padEnd(16)} ${String(total).padStart(5)} ${String(completed).padStart(5)} ${String(failed).padStart(5)} ${rate.padStart(6)}`,
        );
      }
    } else {
      lines.push("  No sessions in the last 24h.");
    }
  } finally {
    db.close();
  }

  lines.push("");
  return lines.join("\n");
}

export async function notifyStatus(persistDir: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);
  if (!token || chatIds.length === 0) {
    console.error("[status] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — cannot notify");
    return;
  }
  const status = printSystemStatus(persistDir).slice(0, 4000);
  for (const chatId of chatIds) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: status }),
      });
      if (!resp.ok) {
        console.error(`[status] Telegram send failed: ${resp.status} ${await resp.text()}`);
      }
    } catch (err) {
      console.error(`[status] Telegram send error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
