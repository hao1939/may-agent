# Finding: Coach Growth-Cycle Quality Gap

**Date**: 2026-03-30T04:10 UTC
**Scope**: Coach agent sessions, 48h window (Mar 28-30)
**Source**: evaluations DB cross-referenced with session data

## Summary

Coach growth-cycle workflow sessions have a dramatically lower quality rate than regular heartbeat sessions, while consuming 34% of total coach ops.

## Data

| Metric | Heartbeat | Growth-Cycle |
|--------|-----------|--------------|
| Sessions (48h) | 41 | 13 |
| Total ops | 598 | 303 |
| Avg ops/session | 14.6 | 23.3 |
| Good rate | 85% (35/41) | 23% (3/13) |
| Needs improvement | 0 | 4 |
| % of total ops | 66% | 34% |

## Failure Clusters

Growth-cycle failures cluster at two time points:
1. **Mar 28 09:06-09:10**: Sprint-plan (q:0.25) + Execute (q:0.25, 53 ops) — planning failed, execution had no plan to follow
2. **Mar 29 09:06-09:36**: Sprint-plan (q:0.35) + Diagnose x3 + Fork + Execute (q:0.35) — similar cascading failure

## Recurring Issues in Growth-Cycle Sessions

From evaluator analysis, the top failure modes are:
- **FM-2.1 (ENV_MISREAD)**: Invalid paths (`cd /root/project/...`, `cd /home/user`, `npm install`) — 7 occurrences
- **SCOPE_DRIFT**: Task asks for method selection, coach pivots to infra debugging — 2 occurrences  
- **C1.8_STATUS_MISMATCH**: Claims `status:"success"` despite missing deliverables — 2 occurrences
- **EVIDENCE_GAP**: Claims edits without showing tool output — 3 occurrences
- **FM-1.3 (AVOIDABLE_ERROR)**: `npm install` in npm-less environment, `bash({})` — 2 occurrences

## Root Cause Analysis

The growth-cycle is a multi-phase workflow (plan → diagnose → fork → execute). When Phase 1 (planning) fails:
1. Phase 2 (execute) receives broken/empty plan → cascading failure
2. Each phase is an independent LLM session with ~23 ops → total cost 90-130 ops per cycle
3. Failed cycles produce zero value (all work discarded)

The FM-2.1 pattern is especially damaging: coach guesses paths like `/root/project/agents/gym/...` instead of using discovery commands first, burning 3-5 ops per wrong guess.

## Impact

- **303 wasted ops in 48h** on low-quality growth-cycle sessions (~150/day)
- Coach is 2nd highest ops consumer in the system (543 ops/24h)
- Growth-cycle contributes 34% of coach ops at 23% quality → **~13% ops efficiency overall**

## Recommendations

### P1: Add early-exit to growth-cycle workflow
If Phase 1 (sprint-plan) quality < 0.5 or deliverable missing, abort remaining phases. Currently cascading failures run all 4+ phases even when the first one fails.

### P2: Add environment pre-check to coach growth-cycle task prompt
Include explicit environment facts: "Working directory is /app. npm is not available. Use bun. Paths under agents/ exist in /app/agents/." This would eliminate the FM-2.1 path-guessing waste.

### P3: Consider reducing growth-cycle frequency
With 85% good heartbeats, coach is very effective at regular work. Growth-cycle at current quality level may not be ROI-positive. Consider: only trigger when a specific agent has 3+ consecutive failures on the same FM category.

## Files
- This finding: `agents/optimizer/workspace/finding-coach-growth-cycle-quality-0330.md`
