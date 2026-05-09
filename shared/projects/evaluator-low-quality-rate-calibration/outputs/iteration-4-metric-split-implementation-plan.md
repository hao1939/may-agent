# Iteration 4 — Metric split implementation plan (approach #1)

## Summary
The current metric `evaluator.low-quality-rate-24h` is **broad by definition**: it counts any evaluation that is `verdict in ('needs_improvement','low_quality')` OR has `quality < 0.4` OR `efficiency < 0.4`.

That makes it a combined signal of **substantive output failures + operational hygiene/pipeline issues** (because heuristic v2 tends to label hygiene issues as `needs_improvement`).

**Plan:** keep the broad metric unchanged for hygiene visibility, and introduce/standardize a second metric that isolates **substantive** evaluator failures, then pivot alerting/thresholding to the substantive metric.

---

## 1) Exact code changes proposed (`agents/may/handlers/metrics-snapshot.ts`)

### 1.1 Keep existing broad metric unchanged
**No change** to the logic at (currently) ~lines 374–391:

```ts
const total = count(
  "SELECT COUNT(*) as c FROM evaluations WHERE createdAt > ? AND agent NOT IN ('evaluator', 'judge')",
  twentyFourH,
);
const needsImprovementOrLowScore = count(
  `SELECT COUNT(*) as c
   FROM evaluations
   WHERE createdAt > ?
     AND agent NOT IN ('evaluator', 'judge')
     AND (verdict IN ('needs_improvement', 'low_quality') OR quality < 0.4 OR efficiency < 0.4)`,
  twentyFourH,
);
record("evaluator.low-quality-rate-24h", total > 0 ? parseFloat((needsImprovementOrLowScore / total).toFixed(4)) : 0, total);
```

**Doc/labeling only (optional but recommended):**
- keep metric id the same, but ensure its **name** clearly indicates it is “broad (includes hygiene/process penalties)”. It already is:
  - `"Broad needs-improvement/low-score evaluated sessions (24h)"`

### 1.2 Add / standardize substantive-only metric
This metric already exists in the registry (`ALL_METRICS`) and measurement section in the file, but the measurement logic currently uses `LIKE` on the serialized issues.

**Change requested by this iteration:** implement the substantive metric using **DB-joinable conditions** (no fragile serialized-string matching), i.e. rely on session terminal status + structured issues markers (or a robust issues table if present).

If the DB does not have a normalized issues table, keep a JSON-based joinable condition (see SQL below) and explicitly treat it as the best available “joinable” approach.

**Registry entry (if missing):**
```ts
{ id: "evaluator.substantive-low-quality-rate-24h",
  name: "Substantive evaluator quality failures (24h)",
  owner: "evaluator",
  type: "gauge",
  target: 0.10,
  threshold: 0.30,
  unit: "ratio",
  alert_op: ">",
  priority: "P2" },
```

**Measurement block (replace current block):** see SQL in section 2.

---

## 2) Exact SQL for the new metric (substantive-only)

### Definition
- **Denominator:** total evaluations in last 24h excluding evaluator/judge (`createdAt > :twentyFourH` and `agent NOT IN ('evaluator','judge')`).
- **Numerator:** evaluations in last 24h (same base filter) where either:
  1) `sessions.status IN ('error','interrupted')`, OR
  2) evaluation has at least one **substantive marker** issue: `tool hallucination`, `verification failure`, `blind overwrite`.

### Preferred SQL (JSON-aware, avoids brittle substring checks)
This assumes `evaluations.issues` is a JSON array of strings (as emitted by the evaluator).

```sql
SELECT COUNT(*) AS c
FROM evaluations e
LEFT JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > ?
  AND e.agent NOT IN ('evaluator', 'judge')
  AND (
    s.status IN ('error', 'interrupted')
    OR EXISTS (
      SELECT 1
      FROM json_each(COALESCE(e.issues, '[]')) je
      WHERE lower(je.value) IN (
        'tool hallucination',
        'verification failure',
        'blind overwrite'
      )
    )
  );
```

### Fallback SQL (if `evaluations.issues` is NOT valid JSON)
If `e.issues` is stored as a string blob (non-JSON), then a joinable approach is not possible without schema change. In that case, use the existing `lower(...) LIKE ...` approach and treat it as interim:

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

### Denominator SQL
```sql
SELECT COUNT(*) AS c
FROM evaluations
WHERE createdAt > ?
  AND agent NOT IN ('evaluator', 'judge');
```

---

## 3) Alerting recommendation (threshold/targets)

### Keep broad metric, but de-emphasize it
- `evaluator.low-quality-rate-24h` (broad: hygiene + substantive)
  - recommended **threshold**: keep at `0.30` only if it is not paging; otherwise raise threshold substantially or switch it to non-paging severity.
  - recommended **target**: `0.10` is OK as an aspirational target, but it is not realistic while heuristic v2 treats hygiene as NI.

### Pivot paging/primary alert to substantive metric
- `evaluator.substantive-low-quality-rate-24h` (substantive)
  - recommended **threshold**: `0.30` (keep), since >30% substantive failures is urgent.
  - recommended **target**: `0.10` (or lower once stable); earlier impact modeling suggests it is currently ~0.08–0.12.

**Operational intent:**
- Broad metric becomes “operational hygiene + quality pressure” (useful for process improvement).
- Substantive metric becomes “are we actually producing wrong/unsafe outputs?” (page-worthy).

---

## 4) Verification plan (run after implementation)

Run these two queries (same 24h window) and confirm they match the in-app metrics values.

### Query A: reproduce `evaluator.low-quality-rate-24h`
```sql
WITH totals AS (
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN (verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4) THEN 1 ELSE 0 END) AS flagged
  FROM evaluations
  WHERE createdAt > :twentyFourH
    AND agent NOT IN ('evaluator','judge')
)
SELECT
  total,
  flagged,
  ROUND(CAST(flagged AS REAL) / NULLIF(total, 0), 4) AS rate
FROM totals;
```

### Query B: reproduce `evaluator.substantive-low-quality-rate-24h`
(JSON-based preferred; use fallback if needed)

```sql
WITH totals AS (
  SELECT COUNT(*) AS total
  FROM evaluations
  WHERE createdAt > :twentyFourH
    AND agent NOT IN ('evaluator','judge')
),
substantive AS (
  SELECT COUNT(*) AS flagged
  FROM evaluations e
  LEFT JOIN sessions s ON s.sessionId = e.sessionId
  WHERE e.createdAt > :twentyFourH
    AND e.agent NOT IN ('evaluator','judge')
    AND (
      s.status IN ('error', 'interrupted')
      OR EXISTS (
        SELECT 1
        FROM json_each(COALESCE(e.issues, '[]')) je
        WHERE lower(je.value) IN (
          'tool hallucination',
          'verification failure',
          'blind overwrite'
        )
      )
    )
)
SELECT
  totals.total,
  substantive.flagged,
  ROUND(CAST(substantive.flagged AS REAL) / NULLIF(totals.total, 0), 4) AS rate
FROM totals, substantive;
```

**Expected outcome:**
- Broad rate remains high until hygiene drivers are addressed.
- Substantive rate is materially lower and should be the main breach/alert signal.
