# Finding: Evaluator LLM Heartbeat Waste — 200+ ops/day for No Value

**Date**: 2026-04-15  
**Analyst**: Optimizer (cron:optimize)  
**Category**: LLM-to-JS Replacement Opportunity

## Summary

The evaluator LLM heartbeat fires every 30 min (48x/day), consuming **~200-290 LLM ops/day** (~$10-14/day). Every single session gets `meta_agent_skipped` verdict — 0% good rate. Most sessions produce **no outcome at all**. The one useful thing they do (check `MAX(evaluations.createdAt)` in the DB) is a trivial JS operation.

## Evidence

### Daily ops waste (last 7 days)
| Date | LLM Sessions | Total Ops | Avg Ops/Session |
|------|-------------|-----------|-----------------|
| Apr 14 | 39 | 212 | 5.4 |
| Apr 13 | 39 | 293 | 7.5 |
| Apr 12 | 37 | 176 | 4.8 |
| Apr 11 | 48 | 274 | 5.7 |
| Apr 10 | 48 | 289 | 6.0 |
| Apr 09 | 48 | 270 | 5.6 |

### What the heartbeat actually does
- Checks if evaluation pipeline is alive (1 DB query → `MAX(evaluations.createdAt)`)
- Checks `.state/evaluations/` directory (legacy, always stale since Mar 24)
- Occasionally reads consistency-flags.jsonl / human-reviews.jsonl (almost always empty)
- All 10/10 recent sessions: verdict=skipped, quality=0, most outcome=(none)

### What the heartbeat is *supposed* to do
Per `agents/evaluator/heartbeat.md`:
1. Process pending tasks
2. Process ownership check (#5 Session Eval, #15 LLM Eval) — just DB/file checks
3. Signal quality review — criteria evolution, calibration
4. Calibration — check consistency flags, human reviews
5. Periodic tasks

In practice: Steps 1-2 are trivial JS. Steps 3-5 almost never have work to do.

## Proposed Fix

**Replace `heartbeat-evaluator` with a JS handler** that:
1. Checks `MAX(evaluations.createdAt)` in `.state/may.db` — alert if stale (>2h)
2. Checks if `agents/evaluator/workspace/consistency-flags.jsonl` or `human-reviews.jsonl` have new entries (by line count vs cached count)
3. Only spawns an LLM session (via `spawnDetachedAgent`) if there's actual calibration work to do

### Expected savings
- **~250 ops/day** (current avg ~250, reduced to ~0 for routine checks)
- **~$10-12/day** (~$300-360/month)
- Pattern: same approach as the successful `LLM-to-JS Verification Phases` fix (Apr 13)

### Implementation
- Create `agents/may/handlers/evaluator-heartbeat.ts` (JS handler)
- Change `heartbeat-evaluator` in `agents/may/cron.json` from `type: "heartbeat"` to `type: "job"` with `handler: "evaluator-heartbeat"`
- Follow pattern from `heartbeat-context.ts` (similar create/HandlerModule pattern)

## Risk
- Low. The evaluator heartbeat rarely does anything LLM-worthy. If calibration work accumulates (new human reviews, consistency flags), the JS handler spawns an LLM session on demand.
- Rollback: change cron.json back to `type: "heartbeat"`.

## Status
**READY TO IMPLEMENT** — next optimizer session should build the JS handler.
