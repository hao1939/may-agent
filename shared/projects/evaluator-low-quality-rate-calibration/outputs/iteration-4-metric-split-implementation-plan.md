# Iteration 4 — Metric split implementation plan (approach #1)

## Goal
Keep the existing metric **unchanged** (it measures “needs-improvement or low scores,” i.e., hygiene + substantive) but add a second metric that isolates **substantive** failures. Then pivot alerting/threshold interpretation to the substantive metric.

## Proposed changes to `agents/may/handlers/metrics-snapshot.ts`

### 1) Keep existing metric unchanged
No logic change. Keep:
- **id**: `evaluator.low-quality-rate-24h`
- **current name**: `Needs-improvement/low-score evaluated sessions (24h)`

(Optionally *in a later PR* rename the human-facing `name` to make intent explicit, e.g. “Hygiene+substance low-quality rate (24h)”, but do **not** change semantics in this iteration.)

### 2) Add new built-in metric definition
Add a new entry to `ALL_METRICS` near the existing evaluator metrics:

- **id**: `evaluator.substantive-low-quality-rate-24h`
- **name**: `Substantive low-quality evaluated sessions (24h)`
- **owner**: `evaluator`
- **type**: `gauge`
- **unit**: `ratio`
- **alert_op**: `>`

**Target/threshold recommendation (see Alerting section):**
- **target**: `0.10`
- **threshold**: `0.30`
- **priority**: `P2` (or `P1` if you want this to page more aggressively than the hygiene metric)

### 3) Add a new `record(...)` computation for the substantive metric
In the metric computation section (later in this handler where it computes evaluator metrics via SQL `count(...)`), add:

- denominator = total evaluations in last 24h (same base filter as the current evaluator metric uses)
- numerator = those evaluations additionally flagged as **substantive** by:
  - `sessions.status IN ('error','interrupted')`, OR
  - `evaluations.issues` JSON array contains any of these substantive markers:
    - `tool hallucination`
    - `verification failure`
    - `blind overwrite`

## Exact SQL (PR-ready)

### Base denominator (total evaluated sessions, last 24h)
Use the same base filter as the current metric to avoid denominator drift:
- window: `evaluations.created_at >= datetime('now', '-24 hours')`
- exclude evaluator/judge agents (as current metric does)

**Denominator SQL:**
```sql
SELECT COUNT(*) AS c
FROM evaluations e
JOIN sessions s ON s.id = e.session_id
WHERE e.created_at >= datetime('now', '-24 hours')
  AND s.agent NOT IN ('evaluator', 'judge');
```

### Numerator (substantive low-quality)
**Important:** implement JSON membership checks using SQLite’s `json_each` so this remains DB-joinable and doesn’t depend on brittle substring checks.

**Numerator SQL:**
```sql
SELECT COUNT(*) AS c
FROM evaluations e
JOIN sessions s ON s.id = e.session_id
WHERE e.created_at >= datetime('now', '-24 hours')
  AND s.agent NOT IN ('evaluator', 'judge')
  AND (
    s.status IN ('error', 'interrupted')
    OR EXISTS (
      SELECT 1
      FROM json_each(e.issues)
      WHERE value IN (
        'tool hallucination',
        'verification failure',
        'blind overwrite'
      )
    )
  );
```

### Compute the substantive rate
Rate = numerator / denominator (guard denominator=0):
```ts
const denom = count(/* Denominator SQL above */);
const num = count(/* Numerator SQL above */);
const rate = denom > 0 ? num / denom : 0;
record('evaluator.substantive-low-quality-rate-24h', rate, denom);
```

## Alerting recommendation

### Keep the existing metric, but treat it as “hygiene + substance”
- `evaluator.low-quality-rate-24h`
  - **Meaning**: “NI/low-score rate” including hygiene/process verdict flips.
  - **Recommended target**: keep at `0.10` (aspirational).
  - **Recommended threshold**: *raise* to `0.50` (or disable alerting) if the org agrees it’s not the primary quality alert.
    - Rationale: current behavior is dominated by hygiene-triggered NI; threshold 0.30 will continue to alert even when substantive failures are low.

### Move the operational quality alert to the new substantive metric
- `evaluator.substantive-low-quality-rate-24h`
  - **Meaning**: “Substantive failures rate” (terminal-failed OR substantive evaluator markers).
  - **Recommended threshold**: `0.30` (alert above 0.30)
  - **Recommended target**: `0.10`

If you must keep **exactly one** metric at threshold 0.30 due to alerting constraints, it should be the **new substantive** metric; keep the old one as a dashboard signal only.

## Verification plan (post-implementation)
Run these two queries against the runtime DB after the code change lands and the handler runs at least once.

### Query 1 — Recompute both rates directly from DB (ground truth)
```sql
WITH base AS (
  SELECT
    e.id AS evaluation_id,
    e.session_id,
    e.created_at,
    e.issues,
    s.agent,
    s.status
  FROM evaluations e
  JOIN sessions s ON s.id = e.session_id
  WHERE e.created_at >= datetime('now', '-24 hours')
    AND s.agent NOT IN ('evaluator', 'judge')
),
substantive AS (
  SELECT *
  FROM base
  WHERE status IN ('error', 'interrupted')
     OR EXISTS (
       SELECT 1 FROM json_each(base.issues)
       WHERE value IN ('tool hallucination','verification failure','blind overwrite')
     )
),
ni_or_low AS (
  -- Mirrors existing metric logic only if you also paste its exact predicate here.
  -- If you don’t want to duplicate, skip this CTE and just verify the new metric.
  SELECT *
  FROM base
  WHERE 1=0
)
SELECT
  (SELECT COUNT(*) FROM base) AS denom_24h,
  (SELECT COUNT(*) FROM substantive) AS substantive_num,
  ROUND(1.0 * (SELECT COUNT(*) FROM substantive) / NULLIF((SELECT COUNT(*) FROM base), 0), 4) AS substantive_rate;
```

### Query 2 — Verify handler wrote the new metric snapshot
```sql
SELECT metric_id, value, sample_size, measured_at, measured_by
FROM metric_snapshots
WHERE metric_id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
)
ORDER BY measured_at DESC
LIMIT 20;
```

Expected outcome: the new `evaluator.substantive-low-quality-rate-24h` should approximate the previously modeled “substantive-only” rate (order-of-magnitude ~0.1, not ~0.39) once computed with the new DB-joinable predicate.
