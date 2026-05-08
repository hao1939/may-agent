# Iteration 4 — Metric split implementation plan (approach #1)

## Summary
We will **keep** the existing metric `evaluator.low-quality-rate-24h` as the **broad “NI-or-low-score” rate** (includes hygiene/process + substantive failures) and **add** a new metric `evaluator.substantive-low-quality-rate-24h` meant to represent **substantive quality failures**.

The key operational change is to **move paging/threshold focus** from the broad metric to the new substantive metric, so hygiene/process spikes don’t look like a reasoning collapse.


## Proposed metric additions/changes (PR-ready)

### File to change
- `agents/may/handlers/metrics-snapshot.ts`

### 1) Keep existing metric unchanged (broad)
Leave this computation as-is:

- **Metric id:** `evaluator.low-quality-rate-24h`
- **Meaning (doc/label):** Broad needs-improvement/low-score evaluated sessions (24h)
- **Current logic:**
  - Denominator: `COUNT(*)` of `evaluations` created in last 24h, excluding `agent IN ('evaluator','judge')`
  - Numerator: those evaluations where **any** is true:
    - `verdict IN ('needs_improvement','low_quality')`
    - `quality < 0.4`
    - `efficiency < 0.4`

This should remain the “hygiene + substantive” catch-all.

### 2) Add new metric (substantive)
Add a new metric definition in `ALL_METRICS` (if not already present) and add a measurement block similar to the broad metric, but with substantive-only numerator.

- **Metric id:** `evaluator.substantive-low-quality-rate-24h`
- **Meaning:** Substantive evaluator quality failures (24h)

#### Proposed thresholds/targets (recommended)
- `evaluator.low-quality-rate-24h`
  - **Threshold:** keep at `0.30` (informational / hygiene+substance)
  - **Target:** keep `0.10` (directional)
- `evaluator.substantive-low-quality-rate-24h`
  - **Threshold (page-worthy):** `0.30`
  - **Target (north-star):** `0.10` (and ideally ratchet lower later)

If you must pick one metric to page on, page on **substantive**.


## Exact SQL for the new metric (DB-joinable; minimal string fragility)

### Denominator (total evaluations in last 24h)
```sql
SELECT COUNT(*) AS c
FROM evaluations
WHERE createdAt > ?
  AND agent NOT IN ('evaluator', 'judge');
```

### Numerator (substantive low-quality)
Definition required by this iteration:
- numerator = evaluations in last 24h where:
  - `session.status IN ('error','interrupted')`
  - OR issues contains any substantive marker:
    - `tool hallucination`
    - `verification failure`
    - `blind overwrite`

Exact query:
```sql
SELECT COUNT(*) AS c
FROM evaluations e
LEFT JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > ?
  AND e.agent NOT IN ('evaluator', 'judge')
  AND (
    s.status IN ('error', 'interrupted')
    OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
    OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
    OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
  );
```

### Rate
In code, compute:
- `rate = substantive_numerator / total_denominator`
- record with `sampleSize = total_denominator`


## Alerting recommendation

### Intent alignment
- `evaluator.low-quality-rate-24h` is currently **dominated by hygiene/process NI** (heuristic v2 step-function), so it’s useful as an *ops hygiene* signal, but is a noisy proxy for “model output quality”.
- `evaluator.substantive-low-quality-rate-24h` is the better candidate for “substantive output quality degradation”.

### Recommendation (what to page on)
- **Page/primary breach:** `evaluator.substantive-low-quality-rate-24h` with threshold `> 0.30`
- **Secondary / informational:** `evaluator.low-quality-rate-24h`
  - Keep threshold `> 0.30` but treat as “hygiene + substantive”; consider lowering priority to P3 if it is still too chatty.

### Targets
- Substantive metric should target ~`0.10` (or lower once stable)
- Broad metric target can remain `0.10`, but should not be treated as the sole quality north star.


## Verification plan (run-after-implementation)

Run the following DB query to reproduce both rates (should match the code logic):

```sql
WITH total AS (
  SELECT COUNT(*) AS denom
  FROM evaluations
  WHERE createdAt > (strftime('%s','now')*1000 - 24*60*60*1000)
    AND agent NOT IN ('evaluator','judge')
), broad AS (
  SELECT COUNT(*) AS num
  FROM evaluations
  WHERE createdAt > (strftime('%s','now')*1000 - 24*60*60*1000)
    AND agent NOT IN ('evaluator','judge')
    AND (verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4)
), substantive AS (
  SELECT COUNT(*) AS num
  FROM evaluations e
  LEFT JOIN sessions s ON s.sessionId = e.sessionId
  WHERE e.createdAt > (strftime('%s','now')*1000 - 24*60*60*1000)
    AND e.agent NOT IN ('evaluator','judge')
    AND (
      s.status IN ('error','interrupted')
      OR lower(COALESCE(e.issues,'')) LIKE '%tool hallucination%'
      OR lower(COALESCE(e.issues,'')) LIKE '%verification failure%'
      OR lower(COALESCE(e.issues,'')) LIKE '%blind overwrite%'
    )
)
SELECT
  total.denom AS total,
  broad.num AS broad_num,
  ROUND(CAST(broad.num AS REAL)/NULLIF(total.denom,0), 4) AS broad_rate,
  substantive.num AS substantive_num,
  ROUND(CAST(substantive.num AS REAL)/NULLIF(total.denom,0), 4) AS substantive_rate
FROM total, broad, substantive;
```

Expected shape (example from current DB):
- `broad_rate` is currently high (~0.61)
- `substantive_rate` is much lower (~0.084)

If the code implementation is correct, the metric snapshot values for the two metric ids should match these rates (to 4 decimals) shortly after the next `metrics-snapshot` run.
