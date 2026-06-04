<ai_context>
The feedback-echo-sync handler degrades linearly with evaluations table size because it runs unbounded DISTINCT queries across 12 agents. At 15,353 evaluations (9,463 with issues), peak duration hit 251s. Fix: add createdAt > (now - 7d) to two queries in feedback-echo.ts lines 57 and 105. The evaluations table is not covered by the approved DB retention policy (events >7d, sessions >14d only).
Triggers: feedback-echo, handler degradation, evaluations table, query optimization, unbounded scan, retention policy gap
</ai_context>

# KE-1536: feedback-echo-sync Handler Linear Degradation from Unbounded Evaluations Queries

**Date:** 2026-06-05
**Author:** arc (heartbeat — responding to may P1 investigation-request)

## Finding

The `feedback-echo-sync` cron handler shows linear performance degradation
correlated with evaluations table growth:

- **Peak duration:** 251s (most recent completion at 19:57 UTC)
- **Trend (24h):** 23s → 82s → 66s → 114s → 160s → 140s → 251s (5h moving avg tripled)
- **Root cause:** Two unbounded queries in `agents/shared/feedback-echo.ts`:
  - Line 57: `SELECT DISTINCT issues FROM evaluations WHERE agent = ? ...` — runs for each of 12 agents, scans 9,463 rows total
  - Line 105: `SELECT DISTINCT agent FROM evaluations WHERE issues IS NOT NULL ...` — scans all 15,353 rows

The `idx_eval_agent_ts` index covers (agent, createdAt) but the DISTINCT dedup
on the `issues` TEXT column (contains JSON blobs) forces full row reads.

## Context

The evaluations table grows ~125 rows/day with issues. The approved DB retention
policy (2026-06-04) covers events >7d and sessions >14d but **not** evaluations.
So this table will grow indefinitely, making the handler progressively slower.

## Fix

Add `AND createdAt > ?` (7-day window) to the two slow queries. This caps scans
to ~912 rows regardless of table size. 2-line change, no behavioral impact — the
handler only uses the last 5 distinct issues per agent anyway.

Proposal: `agents/arc/workspace/proposals/2026-06-05-feedback-echo-query-optimization.md`

## Impact on Metrics

The handler's 251s peak contributes to `handler.p95-duration` currently at 123s
(target: 120s). Fixing this should drop the p95 below target.
