# Iteration 4 — Metric split implementation plan (approach #1)

## Summary
We should **keep** the existing `evaluator.low-quality-rate-24h` metric as the broad “NI-or-low-score” health/hygiene+quality aggregate, and **add/use** a second metric, `evaluator.substantive-low-quality-rate-24h`, for “substantive output quality failures”. Then **move alerting/threshold expectations** to the substantive metric (or at least interpret breaches accordingly).

This directly addresses the observed breach mechanism: heuristic v2 produces many `needs_improvement` verdicts for hygiene/process issues; the current broad metric treats any `needs_improvement` as numerator.

---

## Proposed metric registry changes (`agents/may/handlers/metrics-snapshot.ts`)

### 1) Keep current metric unchanged, but clarify intent (doc-string / name)
**No change to computation.** It should remain:
- **id:** `evaluator.low-quality-rate-24h`
- **meaning:** broad “needs-improvement OR low score” rate (includes hygiene/process violations and substantive failures)

Current definition (already in file):
- total: `COUNT(*) FROM evaluations WHERE createdAt > ? AND agent NOT IN ('evaluator','judge')`
- numerator: `verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4`

**Optional (non-functional) rename recommendation** (if you want to reduce confusion in dashboards):
- from: `Broad needs-improvement/low-score evaluated sessions (24h)`
- to: `Broad needs-improvement/low-score (hygiene+quality) (24h)`

### 2) Add (or ensure present) substantive-only metric
**id:** `evaluator.substantive-low-quality-rate-24h`

This metric already exists in `ALL_METRICS` and is already measured later in the file (as of current repo state). If it did not exist in a target branch, add it exactly as below:

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

---

## Exact SQL for `evaluator.substantive-low-quality-rate-24h`

Constraint from instructions: numerator should be **DB-joinable** and avoid fragile “subset-of-hygiene strings” logic.

### Denominator (total evaluations, 24h)
```sql
SELECT COUNT(*) AS total
FROM evaluations e
WHERE e.createdAt > ?
  AND e.agent NOT IN ('evaluator', 'judge');
```

### Numerator (substantive low quality, 24h)
Definition:
- session terminal failure: `sessions.status IN ('error','interrupted')` (join on sessionId)
- OR evaluation issues contain one of the substantive markers:
  - `tool hallucination`
  - `verification failure`
  - `blind overwrite`

```sql
SELECT COUNT(*) AS numerator
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
```text
rate = numerator / total
```

Implementation note (matches existing code style in `metrics-snapshot.ts`): compute counts separately with the helper `count()` and then `record(id, parseFloat((numerator/total).toFixed(4)), total)`.

---

## Alerting recommendation (what should page)

### Keep broad metric, but do NOT page at 0.30 unless you explicitly want “hygiene+quality” paging
- **Metric:** `evaluator.low-quality-rate-24h`
- **Interpretation:** operational hygiene + rubric strictness + substantive failures
- **Suggested thresholding:**
  - If kept as an alert at all, raise threshold (or use sustained mode) because it is expected to be noisy under heuristic v2.
  - Otherwise treat it as a *dashboard / trending* signal.

### Page on substantive metric instead
- **Metric:** `evaluator.substantive-low-quality-rate-24h`
- **This should carry the “0.30 breach” paging semantics** if the intent is “system is producing substantively bad outputs”.

Concrete recommendation:
- `evaluator.substantive-low-quality-rate-24h`: **threshold 0.30**, long-term target **0.10** (north star)
- `evaluator.low-quality-rate-24h`: keep target **0.10** (aspirational), but alert threshold should be **higher** than 0.30 *or* be changed to non-paging / sustained-only.

If you must keep *both* alertable, then:
- broad metric threshold: **0.50** (or sustained breach only), target 0.20
- substantive metric threshold: **0.30**, target 0.10

(Exact alert wiring location may be outside this file; see “Verification plan” below to support the PR that repoints the alert.)

---

## Verification plan (run-after implementation)

Run these queries against the runtime DB to verify both rates match `metrics-snapshot` output.

### Query 1 — Compute both rates side-by-side (single query)
```sql
WITH base AS (
  SELECT
    COUNT(*) AS total,
    SUM(
      CASE WHEN (
        e.verdict IN ('needs_improvement', 'low_quality')
        OR e.quality < 0.4
        OR e.efficiency < 0.4
      ) THEN 1 ELSE 0 END
    ) AS broad_bad,
    SUM(
      CASE WHEN (
        s.status IN ('error', 'interrupted')
        OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
        OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
        OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
      ) THEN 1 ELSE 0 END
    ) AS substantive_bad
  FROM evaluations e
  LEFT JOIN sessions s ON s.sessionId = e.sessionId
  WHERE e.createdAt > ?
    AND e.agent NOT IN ('evaluator', 'judge')
)
SELECT
  total,
  broad_bad,
  ROUND(CAST(broad_bad AS REAL) / NULLIF(total, 0), 4) AS evaluator_low_quality_rate_24h,
  substantive_bad,
  ROUND(CAST(substantive_bad AS REAL) / NULLIF(total, 0), 4) AS evaluator_substantive_low_quality_rate_24h
FROM base;
```

Bind parameter: `? = (Date.now() - 24h)` expressed in the same timestamp units as `evaluations.createdAt` (ms epoch in this codebase).

### Query 2 (optional) — sanity check numerator composition
This helps confirm substantive numerator is being driven by the intended joinable conditions.
```sql
SELECT
  s.status,
  SUM(CASE WHEN lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%' THEN 1 ELSE 0 END) AS tool_hallucination,
  SUM(CASE WHEN lower(COALESCE(e.issues, '')) LIKE '%verification failure%' THEN 1 ELSE 0 END) AS verification_failure,
  SUM(CASE WHEN lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%' THEN 1 ELSE 0 END) AS blind_overwrite,
  COUNT(*) AS c
FROM evaluations e
LEFT JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > ?
  AND e.agent NOT IN ('evaluator', 'judge')
  AND (
    s.status IN ('error', 'interrupted')
    OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
    OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
    OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
  )
GROUP BY s.status
ORDER BY c DESC;
```

---

## PR notes / handoff checklist
1) Confirm `evaluator.substantive-low-quality-rate-24h` exists in `ALL_METRICS` and is `record()`ed (in current repo state: it already is).
2) If alerting is controlled elsewhere, do a repo search for `evaluator.low-quality-rate-24h` and update the consumer to page on `evaluator.substantive-low-quality-rate-24h`.
3) After deployment, run Query 1 and confirm the two computed rates match the values recorded in `metrics.current` for those ids.
