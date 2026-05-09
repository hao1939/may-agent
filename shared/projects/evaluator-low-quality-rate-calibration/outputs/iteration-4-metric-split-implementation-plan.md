# Iteration 4 — Metric split implementation plan (PR-ready)

## Goal
Keep the existing broad metric (`evaluator.low-quality-rate-24h`) for operational hygiene + quality, but add a new **substantive-only** metric (`evaluator.substantive-low-quality-rate-24h`) and repoint alerting/threshold expectations to the substantive metric.

This addresses the observed breach mechanism: the current broad metric counts **any** `needs_improvement` (including hygiene/process/runner/transcript problems) and therefore can be high even when *substantive output* quality is stable.

---

## 1) Exact proposed code changes (`agents/may/handlers/metrics-snapshot.ts`)

### 1.1 Keep existing metric (no behavior change)
**Keep** `evaluator.low-quality-rate-24h` exactly as-is in both:
- registry (`ALL_METRICS`) entry
- measurement SQL

Optionally (non-functional): ensure the registry `name` makes the intent explicit (it already does):
- `"Broad needs-improvement/low-score evaluated sessions (24h)"`

### 1.2 Add new metric to registry (if not already present)
Add this `ALL_METRICS` entry adjacent to the current broad metric:

```ts
{ id: "evaluator.substantive-low-quality-rate-24h", name: "Substantive evaluator quality failures (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
```

Notes:
- This metric already appears in the file header registry in the current snapshot (so no-op if already merged); confirm measurement logic exists below in the “Built-in Metric Measurements” section.

---

## 2) Exact SQL for the new metric (DB-joinable; no fragile hygiene subset logic)

### 2.1 Metric definition
**Denominator**: all non-evaluator/non-judge evaluations in the last 24h (same population as the broad metric).

**Numerator**: last-24h non-evaluator/non-judge evaluations where **either**:
1) the associated session is terminal-failed: `sessions.status IN ('error','interrupted')`, **OR**
2) the evaluation has any **substantive** issue marker present in `evaluations.issues` (JSON array):
   - `tool hallucination`
   - `verification failure`
   - `blind overwrite`

This is intentionally *not* a hygiene filter; it’s a direct positive classifier for “substantive failure signal.”

### 2.2 SQL (two counts + ratio)
Use these exact queries with the existing helper `count()` pattern in `metrics-snapshot.ts`.

**Denominator** (total non-evaluator/non-judge evals last 24h):
```sql
SELECT COUNT(*) AS c
FROM evaluations e
WHERE e.createdAt > (strftime('%s','now') - 24*60*60) * 1000
  AND e.agent NOT IN ('evaluator', 'judge')
```

**Numerator** (substantive low-quality last 24h):
```sql
SELECT COUNT(*) AS c
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (strftime('%s','now') - 24*60*60) * 1000
  AND e.agent NOT IN ('evaluator', 'judge')
  AND (
    s.status IN ('error','interrupted')
    OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
    OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
    OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
  )
```

**Rate computation** (TypeScript):
```ts
const denom = count(`...denominator query...`);
const numer = count(`...numerator query...`);
const rate = denom === 0 ? 0 : numer / denom;
record("evaluator.substantive-low-quality-rate-24h", rate, denom);
```

Compatibility notes:
- The live `sessions` table primary key is `sessionId` (not `id`), so join on `s.sessionId = e.sessionId`.
- This uses positive substantive marker checks via `LIKE`, matching the current `metrics-snapshot.ts` implementation style and avoiding any “subset-of-hygiene-strings” logic.

---

## 3) Alerting recommendation (thresholds/targets)

### 3.1 Keep broad metric, but relax expectations
- **Metric**: `evaluator.low-quality-rate-24h`
- **Interpretation**: “hygiene + quality + pipeline interruptions” rate
- **Recommended threshold/target**:
  - threshold: **0.30** can remain if the intent is to catch any hygiene regressions; however it is currently noisy.
  - recommended long-term: treat as **hygiene/operational KPI** with a higher threshold (e.g. 0.40–0.50) or lower priority.

### 3.2 Use substantive metric for paging / primary alert
- **Metric**: `evaluator.substantive-low-quality-rate-24h`
- **Interpretation**: substantive failure signals (terminal failure or substantive issue markers)
- **Recommended thresholds**:
  - paging threshold: **0.30** (keep current paging semantics here)
  - target: **0.10** (this is the “healthy” bar)

This matches the impact model: broad ~0.392 vs substantive-only materially lower; the alert should align to the substantive signal to avoid hygiene-driven false pages.

---

## 4) Verification plan (post-implementation)

Run these two queries against the runtime DB (or via the existing metrics recomputation harness) to reproduce both rates and confirm they match the values recorded into `metric_snapshots`.

### 4.1 Verify broad low-quality rate (current metric)
(Use the exact query currently used in `metrics-snapshot.ts` for `evaluator.low-quality-rate-24h`.)

If you need a standalone query that matches the common definition:
```sql
WITH denom AS (
  SELECT COUNT(*) AS n
  FROM evaluations e
  WHERE e.createdAt > (strftime('%s','now') - 24*60*60) * 1000
    AND e.agent NOT IN ('evaluator', 'judge')
),
num AS (
  SELECT COUNT(*) AS n
  FROM evaluations e
  WHERE e.createdAt > (strftime('%s','now') - 24*60*60) * 1000
    AND e.agent NOT IN ('evaluator', 'judge')
    AND (e.verdict IN ('needs_improvement','low_quality') OR e.quality < 0.4 OR e.efficiency < 0.4)
)
SELECT
  num.n AS numerator,
  denom.n AS denominator,
  CASE WHEN denom.n=0 THEN 0 ELSE CAST(num.n AS REAL)/denom.n END AS rate
FROM num, denom;
```

### 4.2 Verify substantive low-quality rate (new metric)
```sql
WITH denom AS (
  SELECT COUNT(*) AS n
  FROM evaluations e
  WHERE e.createdAt > (strftime('%s','now') - 24*60*60) * 1000
    AND e.agent NOT IN ('evaluator', 'judge')
),
num AS (
  SELECT COUNT(*) AS n
  FROM evaluations e
  JOIN sessions s ON s.sessionId = e.sessionId
  WHERE e.createdAt > (strftime('%s','now') - 24*60*60) * 1000
    AND e.agent NOT IN ('evaluator', 'judge')
    AND (
      s.status IN ('error','interrupted')
      OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
      OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
      OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
    )
)
SELECT
  num.n AS numerator,
  denom.n AS denominator,
  CASE WHEN denom.n=0 THEN 0 ELSE CAST(num.n AS REAL)/denom.n END AS rate
FROM num, denom;
```

### 4.3 Snapshot cross-check
Confirm that the computed rates are being written:
```sql
SELECT metric_id, value, sample_size, measured_at
FROM metric_snapshots
WHERE metric_id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
)
ORDER BY measured_at DESC
LIMIT 20;
```

---

## 5) Implementation handoff notes
- The registry entry for `evaluator.substantive-low-quality-rate-24h` already exists near the top of `metrics-snapshot.ts` in the current file view; the remaining work (if not yet implemented) is the measurement block below.
- The alerting/paging consumer may be in-repo (metric evaluator) or external; if in-repo, search for alert routing keyed by `metric.id` and repoint from `evaluator.low-quality-rate-24h` to `evaluator.substantive-low-quality-rate-24h`.
