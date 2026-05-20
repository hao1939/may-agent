/**
 * session-aftermath-scan — 7-minute fallback for evaluator aftermath.
 *
 * Normal session completion is handled by the `session.completed` event. This
 * cron job is only the safety net: every 7 minutes it evaluates terminal
 * sessions that still have no evaluation and ended at least 7 minutes ago.
 */

import type { CronEntry, HandlerContext, HandlerModule } from "@may-agent/sdk";

type ScanConfig = {
  workflow?: string;
  agent?: string;
  backfillHours?: number;
  fallbackDelayMs?: number;
  limit?: number;
  maxConcurrent?: number;
  heuristicVersion?: number;
};

type Candidate = {
  sessionId: string;
  agent: string;
  status: string;
  opCount: number;
};

const DEFAULT_WORKFLOW = "evaluator-aftermath";
const DEFAULT_AGENT = "evaluator";
const DEFAULT_BACKFILL_HOURS = 3;
const DEFAULT_FALLBACK_DELAY_MS = 7 * 60_000;
const DEFAULT_LIMIT = 2;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_HEURISTIC_VERSION = 2;

function taskFor(candidate: Candidate): string {
  const trigger = {
    type: "session.completed.backfill",
    source: "timer",
    owner: "agent:evaluator",
    timestamp: Date.now(),
    data: {
      mode: "completed",
      sessionId: candidate.sessionId,
      agent: candidate.agent,
      status: candidate.status,
    },
  };

  return [
    `Run evaluator aftermath for session ${candidate.sessionId}.`,
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(trigger, null, 2),
    "```",
  ].join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig ?? {}) as ScanConfig;
  const workflow = config.workflow ?? DEFAULT_WORKFLOW;
  const agent = config.agent ?? DEFAULT_AGENT;
  const backfillHours = config.backfillHours ?? DEFAULT_BACKFILL_HOURS;
  const fallbackDelayMs = config.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS;
  const limit = config.limit ?? DEFAULT_LIMIT;
  const maxConcurrent = config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const heuristicVersion = config.heuristicVersion ?? DEFAULT_HEURISTIC_VERSION;

  return async () => {
    const now = Date.now();
    const cutoff = now - backfillHours * 60 * 60_000;
    const fallbackCutoff = now - fallbackDelayMs;

    const running = ctx.sdk.query.sql(
      `SELECT COUNT(*) AS c
       FROM workflow_runs
       WHERE workflow = ?
         AND status = 'running'`,
      [workflow],
      { limit: 1 },
    ).rows[0] as { c?: number } | undefined;
    if ((running?.c ?? 0) >= maxConcurrent) {
      ctx.sdk.log("info", `[session-aftermath-scan] Skipping: ${running?.c ?? 0} ${workflow} workflow(s) already running.`);
      return;
    }

    const candidates = ctx.sdk.query.sql(
      `SELECT s.sessionId, s.agent, s.status, COALESCE(s.opCount, 0) AS opCount
       FROM sessions s
       LEFT JOIN evaluations e ON e.sessionId = s.sessionId
       WHERE s.status IN ('done', 'error', 'interrupted')
         AND s.agent NOT IN ('evaluator', 'judge')
         AND COALESCE(s.endedAt, s.startedAt) >= ?
         AND COALESCE(s.endedAt, s.startedAt) <= ?
         AND (
           e.sessionId IS NULL
           OR (
             e.verdict = 'good'
             AND COALESCE(CAST(json_extract(e.overall, '$.heuristicVersion') AS INTEGER), 0) < ?
           )
       )
       ORDER BY COALESCE(s.endedAt, s.startedAt) DESC
       LIMIT ?`,
      [cutoff, fallbackCutoff, heuristicVersion, limit],
      { limit },
    ).rows as Candidate[];

    if (candidates.length === 0) {
      ctx.sdk.log("info", "[session-aftermath-scan] No unevaluated sessions older than fallback delay.");
      return;
    }

    ctx.sdk.log("info", `[session-aftermath-scan] Dispatching ${candidates.length} session(s).`);
    for (const candidate of candidates) {
      try {
        const result = await ctx.sdk.runWorkflow(workflow, taskFor(candidate), { source: agent });
        ctx.sdk.log("info", `[session-aftermath-scan] ${candidate.sessionId} -> ${result.status}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.sdk.log("info", `[session-aftermath-scan] ${candidate.sessionId} failed: ${msg.slice(0, 200)}`);
      }
    }
  };
};
