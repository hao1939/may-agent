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

      // Backfill workflowRunId from .state/workflows/*.json for sessions missing it
      let backfilled = 0;
      try {
        const workflowsDir = join(ctx.projectRoot, ".state", "workflows");
        if (existsSync(workflowsDir)) {
          const cutoff = Date.now() - 90 * 86400 * 1000; // backfill up to 90 days
          const updateWfId = db.prepare(
            `UPDATE sessions SET workflowRunId = ?, source = COALESCE(source, 'workflow')
             WHERE sessionId = ? AND workflowRunId IS NULL`,
          );
          const wfFiles = readdirSync(workflowsDir)
            .filter((f) => f.startsWith("wr_") && f.endsWith(".json"))
            .sort()
            .reverse()
            .slice(0, 2000); // scan recent workflow runs for backfill

          const backfillTxn = db.transaction(() => {
            for (const file of wfFiles) {
              try {
                const raw = readFileSync(join(workflowsDir, file), "utf-8");
                const run = JSON.parse(raw) as {
                  runId: string;
                  startedAt?: number;
                  parentSessionId?: string;
                  steps?: Array<{ sessionId: string }>;
                };
                if (run.startedAt && run.startedAt < cutoff) continue;

                // Tag step sessions
                for (const step of run.steps ?? []) {
                  if (step.sessionId) {
                    const changes = updateWfId.run(run.runId, step.sessionId);
                    if (changes.changes > 0) backfilled++;
                  }
                }

                // Tag parent session (the cron_ session that spawned the workflow)
                if (run.parentSessionId) {
                  const changes = updateWfId.run(run.runId, run.parentSessionId);
                  if (changes.changes > 0) backfilled++;
                }
              } catch {
                // skip broken workflow files
              }
            }
          });
          backfillTxn();
        }
      } catch (err) {
        ctx.log(`[session-sync] Workflow backfill error: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (backfilled > 0) {
        ctx.log(`[session-sync] Backfilled workflowRunId for ${backfilled} sessions from workflow runs`);
      }

      // Propagate workflowRunId from parent sessions to children missing it
      let propagated = 0;
      try {
        const propagateStmt = db.prepare(`
          UPDATE sessions SET
            workflowRunId = (SELECT p.workflowRunId FROM sessions p WHERE p.sessionId = sessions.parentSessionId),
            source = COALESCE(source, 'workflow')
          WHERE workflowRunId IS NULL
            AND parentSessionId IS NOT NULL
            AND EXISTS (SELECT 1 FROM sessions p WHERE p.sessionId = sessions.parentSessionId AND p.workflowRunId IS NOT NULL)
        `);
        // Run multiple rounds to propagate through deep call chains
        let totalPropagated = 0;
        for (let round = 0; round < 5; round++) {
          const result = propagateStmt.run();
          totalPropagated += result.changes;
          if (result.changes === 0) break;
        }
        propagated = totalPropagated;
        if (propagated > 0) {
          ctx.log(`[session-sync] Propagated workflowRunId to ${propagated} child sessions`);
        }
      } catch (err) {
        ctx.log(`[session-sync] Propagation error: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Tag evaluator sessions that were spawned by evaluator-heartbeat handler
      // These sessions have task patterns like "# Task Tree Evaluation" or "# Session Digest Request"
      // but no workflowRunId because agents.fork doesn't propagate it
      let evalTagged = 0;
      try {
        const tagEvalStmt = db.prepare(`
          UPDATE sessions SET
            source = 'evaluator-heartbeat'
          WHERE agent = 'evaluator'
            AND source IS NULL
            AND (task LIKE '# Task Tree Evaluation%' OR task LIKE '# Session Digest Request%')
        `);
        const result = tagEvalStmt.run();
        evalTagged = result.changes;
        if (evalTagged > 0) {
          ctx.log(`[session-sync] Tagged ${evalTagged} evaluator sessions with source=evaluator-heartbeat`);
        }
      } catch (err) {
        ctx.log(`[session-sync] Evaluator tagging error: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Tag sessions by task patterns to improve source attribution
      let patternTagged = 0;
      try {
        // Tag cron-originated sessions by task pattern
        const tagCron = db.prepare(`
          UPDATE sessions SET source = 'cron-task'
          WHERE source IS NULL
            AND (task LIKE '[cron:%' OR task LIKE '%[cron:%' OR task LIKE '[heartbeat]%')
        `);
        patternTagged += tagCron.run().changes;

        // Tag persistent-task workflow sessions
        const tagPersistent = db.prepare(`
          UPDATE sessions SET source = 'persistent-task'
          WHERE source IS NULL
            AND (task LIKE 'You are working on iteration%'
              OR task LIKE '[EVALUATION%'
              OR task LIKE '[REVIEW ONLY%'
              OR task LIKE '%## Goal%## Milestones%')
        `);
        patternTagged += tagPersistent.run().changes;

        // Tag agents.fork evaluator sessions
        const tagFork = db.prepare(`
          UPDATE sessions SET source = 'agents.fork'
          WHERE source IS NULL
            AND (task LIKE '# Task Tree Evaluation%' OR task LIKE '# Session Digest%')
        `);
        patternTagged += tagFork.run().changes;

        if (patternTagged > 0) {
          ctx.log(`[session-sync] Pattern-tagged ${patternTagged} sessions with source attribution`);
        }
      } catch (err) {
        ctx.log(`[session-sync] Pattern tagging error: ${err instanceof Error ? err.message : String(err)}`);
      }

      ctx.emit({
        type: "session_sync",
        synced,
        skipped,
        backfilled,
        total: metaFiles.length,
      });
    } finally {
      // Ensure the connection is closed and WAL is checkpointed
      db.close();
    }
  };
};
