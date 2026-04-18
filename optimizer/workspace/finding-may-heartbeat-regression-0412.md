# Finding: May Heartbeat "Regression" — Measurement Error, Not Real

**Date**: 2026-04-12 ~10:25 UTC  
**Investigator**: Optimizer  
**Status**: Resolved — false alarm

## Summary

The reported regression (May heartbeat avg ~25 ops in 6h window despite budget caps) is a **measurement error**, not a real regression. The budget caps are working exactly as intended.

## What Happened

1. Budget caps were deployed to `agents/may/heartbeat.md` at 08:29 UTC Apr 12
2. The initial 3 post-deploy heartbeat readings were: **[4, 5, 6] — avg 5.0 ops** ✅
3. A 6h snapshot query reported May avg 24.6 ops — triggering a "regression" investigation

## Root Cause: Mixed Session Types in Aggregate Query

The 6h aggregate query (`AVG(opCount) WHERE agent='may'`) computed the average across **all May session types**, not just heartbeats:

| Type | n | Avg Ops | Ops List |
|------|---|---------|----------|
| Heartbeats | 12 | 21.6 | 42,20,42,22,45,17,30,26,4,5,6,0 |
| Work Sessions | 8 | 32.6 | 26,17,49,51,20,44,28,26 |
| Other (dispatch) | 2 | 5.5 | 8,3 |

The 21.6 avg for heartbeats is further inflated by **9 pre-deploy heartbeats** (avg 28.0 ops) mixed with 3 post-deploy heartbeats (avg 5.0 ops).

### Additionally: False Positives from Task Text Matching

An earlier analysis using `task LIKE '%heartbeat%'` accidentally matched work sessions whose task descriptions mentioned the word "heartbeat" in a different context (e.g., "Check coder's heartbeat.md"). This made it appear that high-op work sessions were heartbeats.

Correct filter: `task LIKE '[heartbeat]%'` (starts with the tag)

## Actual Post-Deploy Performance

**True post-deploy heartbeat-only data:**

| Hours Post-Deploy | Ops | Status |
|-------------------|-----|--------|
| +0.43h | 4 | done |
| +0.93h | 5 | done |
| +1.43h | 6 | done |
| +1.93h | 0 | running (in-progress) |

**Post-deploy heartbeat avg: 5.0 ops (n=3 completed)** — 78% reduction from baseline 28.0

## Budget Cap Status

The budget caps in `agents/may/heartbeat.md` are **fully intact**:
- ≤12 op budget target: ✅ present
- Per-step budget annotations: ✅ present  
- Combined snapshot query: ✅ present
- No-peek rule: ✅ present
- No-git-commit rule: ✅ present
- Quick reference op budget table: ✅ present

Git log confirms the last modification was the deploy commit `faf6115b` at 08:29 UTC. No subsequent changes.

## Lessons for Future Measurement

1. **Always filter by session type** — `task LIKE '[heartbeat]%'` not `task LIKE '%heartbeat%'`
2. **Separate pre/post deploy windows** — 6h aggregates mix old and new behavior
3. **Agent-level averages are meaningless** — May forks work sessions that run under May's agent name; these are expected to be 20-50 ops and should not be counted as heartbeat cost
4. **Need a `kind` column in sessions table** — currently sessions only have `job/call/chat`, no `heartbeat` vs `work_session` distinction. Evaluator session kind tagging spec has been dispatched (session `s_1775987668509_2028`).

## Recommendation

No action needed — the budget caps are working. Continue monitoring with correct methodology:

```sql
-- Correct May heartbeat query
SELECT opCount, startedAt, status
FROM sessions 
WHERE agent='may' 
  AND task LIKE '[heartbeat]%'
  AND startedAt > <deploy_timestamp>
ORDER BY startedAt DESC;
```
