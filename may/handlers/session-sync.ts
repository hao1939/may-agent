/**
 * session-sync — Syncs session metadata from filesystem into may.db.
 *
 * Problem: The sessions table in may.db goes stale because new sessions
 * are tracked on the filesystem (.state/sessions/<id>/meta.json) but not
 * written to the DB table. All monitoring queries that agents use to check
 * system health return stale data (sometimes weeks old).
 *
 * Solution: This handler runs every 5 minutes and upserts session metadata
 * from the filesystem into the sessions table.
 *
 * NOTE: Uses its own Database connection instead of ctx.getDb() because
 * the shared connection's WAL data doesn't persist between handler calls.
 * See: agents/optimizer/workspace/findings/2026-04-10-session-sync-persistence-bug.md
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Usage in cron.json:
 *   {
 *     "name": "session-sync",
 *     "type": "handler",
 *     "handler": "session-sync",
 *     "intervalMs": 300000,
 *     "enabled": true,
 *     "description": "Sync session metadata from filesystem into may.db sessions table. 5min interval."
 *   }
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

interface SessionMeta {
  agent?: string;
  task?: string;
  status?: string;
  kind?: string;
  source?: string;
  parentSessionId?: string;
  requestId?: string;
  workflowRunId?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  outcome?: string;
  opCount?: number;
}

function collectMetaFiles(sessionsDir: string): Array<{ sessionId: string; path: string }> {
  const results: Array<{ sessionId: string; path: string }> = [];
  const historyDir = join(sessionsDir, "history");

  // Active sessions: .state/sessions/s_* and .state/sessions/cron_*
  if (existsSync(sessionsDir)) {
    try {
      for (const entry of readdirSync(sessionsDir)) {
        if (!entry.startsWith("s_") && !entry.startsWith("cron_")) continue;
        const metaPath = join(sessionsDir, entry, "meta.json");
        if (existsSync(metaPath)) {
          results.push({ sessionId: entry, path: metaPath });
        }
      }
    } catch { /* ignore read errors */ }
  }

  // History sessions: .state/sessions/history/s_* and cron_*
  if (existsSync(historyDir)) {
    try {
      for (const entry of readdirSync(historyDir)) {
        if (!entry.startsWith("s_") && !entry.startsWith("cron_")) continue;
        const metaPath = join(historyDir, entry, "meta.json");
        if (existsSync(metaPath)) {
          results.push({ sessionId: entry, path: metaPath });
        }
      }
    } catch { /* ignore read errors */ }
  }

  return results;
}

function parseMeta(filePath: string): SessionMeta | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const sessionsDir = join(ctx.projectRoot, ".state", "sessions");
    const dbPath = join(ctx.projectRoot, ".state", "may.db");

    // Use our own connection instead of ctx.getDb() — the shared connection's
    // WAL data doesn't persist between handler calls (see findings doc).
    const db = new Database(dbPath);

    try {
      const upsert = db.prepare(`
        INSERT OR REPLACE INTO sessions
          (sessionId, agent, task, status, kind, source,
           parentSessionId, requestId, workflowRunId,
           startedAt, endedAt, error, outcome, opCount)
        VALUES
          (?, ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?, ?)
      `);

      const metaFiles = collectMetaFiles(sessionsDir);

      let synced = 0;
      let skipped = 0;

      const transaction = db.transaction(() => {
        for (const { sessionId, path } of metaFiles) {
          const meta = parseMeta(path);
          if (!meta || !meta.agent || !meta.startedAt) {
            skipped++;
            continue;
          }

          upsert.run(
            sessionId,
            meta.agent,
            meta.task ?? "",
            meta.status ?? "running",
            meta.kind ?? null,
            meta.source ?? null,
            meta.parentSessionId ?? null,
            meta.requestId ?? null,
            meta.workflowRunId ?? null,
            meta.startedAt,
            meta.endedAt ?? null,
            meta.error ?? null,
            meta.outcome ?? null,
            meta.opCount ?? 0,
          );
          synced++;
        }
      });

      transaction();

      ctx.log(`[session-sync] Synced ${synced} sessions (${skipped} skipped)`);

      ctx.emit({
        type: "session_sync",
        synced,
        skipped,
        total: metaFiles.length,
      });
    } finally {
      // Ensure the connection is closed and WAL is checkpointed
      db.close();
    }
  };
};
