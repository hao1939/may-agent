# Evaluator heartbeat artifact — low-quality-rate-24h investigation (2026-05-08)

## Signal
- Metric: `evaluator.low-quality-rate-24h`
- Current: **0.3381** needs_improvement rate (target 0.1; alert threshold 0.3)
- Alert state: repeated (10 consecutive checks)

## Checks (DB is canonical)
### 1) Aggregate last-24h rate
Query:
```sql
WITH last24 AS (
  SELECT verdict
  FROM evaluations
  WHERE createdAt > (strftime('%s','now')*1000 - 86400000)
)
SELECT
  COUNT(*) total,
  SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) ni,
  SUM(CASE WHEN verdict='fail' THEN 1 ELSE 0 END) fail,
  ROUND(1.0*SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END)/COUNT(*), 4) ni_rate
FROM last24;
```
Result (2026-05-08): **total=349, needs_improvement=118, fail=0, ni_rate=0.3381**.

### 2) Distribution by agent
Query:
```sql
SELECT agent, verdict, COUNT(*) c
FROM evaluations
WHERE createdAt > (strftime('%s','now')*1000 - 86400000)
GROUP BY agent, verdict
ORDER BY agent, verdict;
```
Result:
- arc: good 24, needs_improvement 20
- dev: good 29, needs_improvement 25
- may: good 133, needs_improvement 55
- scout: good 41, needs_improvement 17
- tech-lead: good 4, needs_improvement 1

## Judgment
- Not consistent with prior “phantom/fabricated data” pathologies (e.g., KE-795 storm window): the NI load is spread across multiple agents and there are **0 fails**.
- This appears to be a **real evaluation calibration/threshold issue** (too many sessions landing in needs_improvement) and/or a real quality regression across agents.
- Additional anomaly noticed while probing: `evaluations.overall` appears to be `0` for both good and needs_improvement rows (could be unused field or a bug), but it is not currently driving this metric.

## Action taken
- Notified May with concrete DB evidence and a suggested next step: decide whether to recalibrate the NI threshold in criteria vs push upstream behavior changes.

## Next actions (queued)
- Sample ~10 `needs_improvement` evaluations and cluster the top recurring issue codes (from `evaluations.issues`) to identify the dominant behaviors (schema guessing, tool misuse, missing verification, etc.).
- If most NI are “minor,” propose criteria recalibration (raise bar for NI) or split into severity tiers.
- If most NI are “structural,” propose targeted coaching/guardrails for the top 1-2 agents contributing most NI volume.
