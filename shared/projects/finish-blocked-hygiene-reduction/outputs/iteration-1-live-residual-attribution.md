# Iteration 1 Live Residual Attribution

## Purpose

This note captures the live state after the first iteration's prompt-path and evaluator-classification patches, so the next session can distinguish unresolved dirty-exit risk from stale/generic evaluator attribution.

## Fresh 24h measurement

Query:

```sql
SELECT COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId=e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%';
```

Result: **234** evaluations still carry the finish/uncommitted issue string in the last 24h.

Top source buckets from the same window:

| Source | Agent | Count |
| --- | --- | ---: |
| workflow:scout-heartbeat | scout | 56 |
| closed-loop-steward | may | 37 |
| workflow:may-heartbeat | may | 34 |
| workflow:dev-heartbeat | dev | 23 |
| workflow:metric-alert-triage | may | 23 |
| workflow:project | may | 21 |
| workflow:orchestrator | may | 16 |
| workflow:arc-heartbeat | arc | 8 |
| workflow:goal-driver | scout | 5 |
| workflow:metric-alert-triage | scout | 3 |
| socket | may | 2 |
| workflow:project | dev | 2 |
| (null) | master | 1 |
| workflow:project | arc | 1 |
| workflow:scout-explore | scout | 1 |
| workflow:worker | may | 1 |

## Key attribution split

Latest digest outcome split for those same 234 evaluations:

| Latest digest outcome | Session status | Session outcome | Count |
| --- | --- | --- | ---: |
| success | done | done | 227 |
| in_progress | interrupted | (null) | 3 |
| partial | done | done | 3 |
| failure | interrupted | interrupted | 1 |

This confirms the main current bucket is not a set of unresolved dirty worktrees. **227/234** are completed sessions whose latest digest says `success`, while only **4/234** are interrupted sessions. The finish/uncommitted issue remains useful as a friction signal, but using it alone as a broad low-quality classifier overstates live unresolved failure.

## Interpretation

The iteration-1 prompt patches target the high-volume source paths directly. The remaining high 24h count is expected to decay only as old evaluations age out and as heuristic-v6 aftermath evaluations replace earlier generic classifications.

For iteration 2, prioritize one of these concrete checks before adding more prompt text:

1. Measure only evaluations created after the evaluator heuristic-v6 patch landed, grouped by lane/verdict and source.
2. Sample the small unresolved subset (`status='interrupted'`) to identify whether they share a single missing prompt path or a guard error.
3. Verify the new evaluator classification preserves the issue string for friction tracking while routing self-repaired finish-only sessions to `success_candidate` instead of `needs_triage`.

## Residual low-volume paths

After direct patches to heartbeat, closed-loop-steward, metric-alert-triage, project, orchestrator, and goal-driver paths, the remaining low-volume unpatched sources are `socket`, `workflow:scout-explore`, `workflow:worker`, and null/master. These should not be patched blindly until post-v6 measurement shows they are still producing unrepaired dirty exits.
