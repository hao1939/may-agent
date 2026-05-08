# Heartbeat artifact — 2026-05-08

## Topic
Investigate repeated red metric: `evaluator.low-quality-rate-24h` (current ~0.34; target 0.1).

## Prior context (must-read)
This metric has prior storm-contamination history (see KE-799/800; broader storm pathology context in KE-801/809/812). Today’s value appears *not* to be a phantom/storm artifact but may still be threshold/calibration mismatch.

## Evidence (runtime DB)
From `evaluations` table over last 24h:

- Overall:
  - total=361
  - needs_improvement=125
  - fail=0
  - needs_improvement rate = 0.3463

- By evaluated session agent:
  - may: 60/195 = 0.3077
  - dev: 27/59 = 0.4576
  - scout: 17/58 = 0.2931
  - arc: 20/44 = 0.4545
  - tech-lead: 1/5 = 0.2

Interpretation: the breach is broad-based across agents (not isolated to one agent or to evaluator self-sessions), with dev+arc particularly high.

## Judgment
Operation chosen per metric-alerts manual: **investigate then calibrate/escalate**.

- This does *not* look like the earlier “phantom data” contamination pattern where the denominator is polluted by storm session-start rows; the evaluation counts are modest (361/day) and distributed across agents.
- The current alert threshold is 0.3; observed is ~0.346, only slightly above the alert threshold but far above long-term target 0.1.
- Most `needs_improvement` verdicts are likely legitimate given the recent run of guard/verification failures (schema-guessing, missing verification evidence) visible in today’s inbox events.

## Recommended next action (human/May)
1. Confirm whether the target 0.1 is realistic given current rubric strictness and workflow guard regime.
2. If rubric is intentionally strict, consider changing the alert threshold to avoid constant paging (e.g., raise threshold to 0.4 temporarily) **or** add sub-metrics by issue type (verification failures vs tool misuse vs planning) so the alert points to actionable causes.

## Queries used
(Recorded here so others can reproduce)

```sql
WITH w AS (
  SELECT sessionId, agent, verdict, createdAt
  FROM evaluations
  WHERE createdAt > (strftime('%s','now')-86400)*1000
)
SELECT 
  COUNT(*) AS total,
  SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) AS needs_improvement,
  SUM(CASE WHEN verdict='fail' THEN 1 ELSE 0 END) AS fail,
  ROUND(1.0*SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END)/COUNT(*), 4) AS ni_rate
FROM w;

SELECT agent,
  COUNT(*) total,
  SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) ni,
  ROUND(1.0*SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END)/COUNT(*),4) ni_rate
FROM evaluations
WHERE createdAt > (strftime('%s','now')-86400)*1000
GROUP BY agent
ORDER BY total DESC;
```
