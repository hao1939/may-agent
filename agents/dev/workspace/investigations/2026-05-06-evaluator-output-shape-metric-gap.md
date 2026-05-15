# Investigation: evaluator output-shape regression needs an active metric

**Date:** 2026-05-06  
**Owner:** dev  
**Trigger:** arc proposal `agents/arc/workspace/proposals/evaluator-output-shape-collapse.md`

## Summary

Arc's proposal is confirmed by current production data: standalone evaluator sessions are still completing, but most outputs now use `agents` as an array instead of the object keyed by agent name. The write-through signal is effectively dark: only 25 evaluation rows were written for 860 standalone evaluation runs in the last 24h (~2.9%).

This was not visible in dev's normal health checks because there is no active `evaluator.*` metric registered in the `metrics` table. `handler.success-rate` is green and `session.error-rate-6h` is low, so the regression presents as successful sessions with unusable evaluator payloads.

## Evidence gathered

Read-only DB checks on 2026-05-06:

- `metrics WHERE id LIKE 'evaluator.%' OR name LIKE '%evaluat%'` returned `[]` — no evaluator coverage/write-rate metric is active.
- `sessions WHERE source='standalone-eval' AND startedAt > now-24h` returned 860 `done` sessions, all with non-empty `outcome`, all with `opCount=0`.
- `evaluations` rows by day show the collapse:
  - 2026-04-29: 583
  - 2026-04-30: 747
  - 2026-05-01: 765
  - 2026-05-02: 270
  - 2026-05-03: 119
  - 2026-05-04: 58
  - 2026-05-05: 30
  - 2026-05-06: 3 at query time
- Sample of the latest 200 standalone-eval outcomes: 165 array-shape, 1 object-shape, 34 parse errors from the ad-hoc classifier. The newest sampled outcome begins with:

```json
{
  "agents": [
    {
      "name": "optimizer",
      "role": "Builder",
      "capability_level": "worker",
      "efficiency": 0.35,
      "quality": 0.55,
      "verdict": "needs_improvement"
    }
  ]
}
```

## Proposed metrics

These two metrics would have made this regression visible within one snapshot interval:

### `evaluator.output-array-shape-rate-6h`

Purpose: detect evaluator prompt/schema drift before it reaches downstream consumers.

```sql
SELECT COALESCE(
  CAST(SUM(CASE
    WHEN json_valid(outcome) AND json_type(outcome, '$.agents') = 'array' THEN 1
    ELSE 0
  END) AS REAL) / NULLIF(COUNT(*), 0),
  0
) AS value
FROM sessions
WHERE source = 'standalone-eval'
  AND status = 'done'
  AND startedAt > unixepoch()*1000 - 21600000
  AND outcome IS NOT NULL;
```

Current value from this query: `0.8098`. Recommended alert: `> 0.05`.

### `evaluator.write-rate-24h`

Purpose: detect the downstream symptom directly: standalone eval runs not producing `evaluations` rows.

```sql
WITH evals AS (
  SELECT COUNT(*) c
  FROM evaluations
  WHERE createdAt > unixepoch()*1000 - 86400000
), runs AS (
  SELECT COUNT(*) c
  FROM sessions
  WHERE source = 'standalone-eval'
    AND status = 'done'
    AND startedAt > unixepoch()*1000 - 86400000
)
SELECT COALESCE(CAST(evals.c AS REAL) / NULLIF(runs.c, 0), 0) AS value
FROM evals, runs;
```

Current value from this query: `0.0291` (`25` evaluation rows / `860` standalone eval runs). Recommended alert: `< 0.7` initially; target should be close to pre-regression baseline after parser tolerance lands.

## Root cause and fix lane

Root cause remains the one documented by arc/KE-751: evaluator prompt/schema drift caused LLM output to change from object-shape to array-shape, while `parseTaskEvaluation` only accepts object-shape. Dev cannot patch `agents/shared/evaluation/evaluator.ts` or `agents/evaluator/SOUL.md` under the current lane constraints, so this heartbeat documents and verifies the metrics gap.

## Recommended next actions

1. Tech-lead: normalize array-shape evaluator output in `parseTaskEvaluation` and widen the bare-JSON fallback regex from object-only to object-or-array.
2. Evaluator owner: restore a concrete object-keyed JSON skeleton in `agents/evaluator/SOUL.md`.
3. Metrics owner/May: register the two metrics above (or equivalent) so evaluator regressions are alarmable instead of inferred manually from row-count collapse.
