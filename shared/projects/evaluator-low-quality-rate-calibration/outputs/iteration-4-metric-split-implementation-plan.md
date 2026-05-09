# Iteration 4 — Metric split implementation plan (approach #1)

## Goal
Keep the current broad metric (which includes hygiene/process NI) for visibility, **but move paging/threshold attention to a new “substantive quality failure” metric** that better reflects real output correctness/safety.

This plan is PR-ready: it specifies exact edits to `agents/may/handlers/metrics-snapshot.ts`, exact SQL for the new metric, alerting targets, and post-change verification queries.

---

## 1) Proposed changes to `agents/may/handlers/metrics-snapshot.ts`

### 1.1 Keep existing metric unchanged (broad / hygiene+substance)
Keep:
- `id: "evaluator.low-quality-rate-24h"`
- existing semantics: **counts any** evaluated session in last 24h whose evaluation is `verdict = 'needs_improvement' OR score < 0.7` (or whatever the current implementation is in the measurement section).

Optional (doc-only) clarification: update the metric name/description in `ALL_METRICS` (registry) to explicitly say it is **broad** (hygiene + substantive), but do not change the metric id.

> Note: In the current file header snippet, the registry already labels it as:
> `"Broad needs-improvement/low-score evaluated sessions (24h)"`.

### 1.2 Add new metric id: `evaluator.substantive-low-quality-rate-24h`
Add (or keep, if already present) this metric in `ALL_METRICS`:

- `id: "evaluator.substantive-low-quality-rate-24h"`
- `name: "Substantive evaluator quality failures (24h)"`

**Important:** This metric should be **measured** in the measurement section of the handler (not just registered), using the SQL in section 2.

If the metric is already present in `ALL_METRICS` (it appears in the current snippet), the required code change is: **ensure it is actually recorded via `record("evaluator.substantive-low-quality-rate-24h", ...)` on every run**, with a stable sample size.

---

## 2) Exact SQL definition for the new metric (DB-joinable, no fragile hygiene subsets)

### 2.1 Time window and denominator
**Denominator** = all evaluations in the last 24 hours.

Assumptions based on prior iterations’ findings:
- `evaluations` table has at least: `sessionId`, `createdAt`, `issues` (TEXT), `verdict`/`score` (may exist but not required for this metric).
- `sessions` table has: `sessionId`, `status`.

Use `createdAt >= (strftime('%s','now') - 86400) * 1000` if `createdAt` is ms since epoch.

### 2.2 Numerator (“substantive failures”)
Count an evaluation as **substantive-low-quality** if **either**:

1) Terminal session failure:
- `sessions.status IN ('error', 'interrupted')`

OR

2) Substantive issue markers are present in `evaluations.issues`:
- contains any of:
  - `tool hallucination`
  - `verification failure`
  - `blind overwrite`

These are intentionally **not** hygiene/process markers; they are “core evaluation correctness/safety” markers.

### 2.3 Exact SQL (two-count approach)
Use two explicit `COUNT(*)` queries (or one query with a CTE). Below is a single-query form that returns numerator, denominator, and rate.

```sql
WITH
  window AS (
    SELECT
      e.sessionId,
      e.issues,
      s.status
    FROM evaluations e
    LEFT JOIN sessions s ON s.sessionId = e.sessionId
    WHERE e.createdAt >= (strftime('%s','now') - 86400) * 1000
  ),
  counts AS (
    SELECT
      COUNT(*) AS denom,
      SUM(
        CASE
          WHEN status IN ('error','interrupted') THEN 1
          WHEN issues IS NOT NULL AND (
            lower(issues) LIKE '%tool hallucination%'
            OR lower(issues) LIKE '%verification failure%'
            OR lower(issues) LIKE '%blind overwrite%'
          ) THEN 1
          ELSE 0
        END
      ) AS numer
    FROM window
  )
SELECT
  numer,
  denom,
  CASE WHEN denom = 0 THEN 0.0 ELSE (1.0 * numer) / denom END AS rate
FROM counts;
```

**Implementation note (SQLite):**
- This avoids `json_each()` because `evaluations.issues` may be TEXT and not guaranteed valid JSON (`json_valid()` ambiguity from prior findings).
- It relies on `sessions.status` join + lowercase substring checks only for *three* stable, evaluator-defined substantive marker strings.

### 2.4 Sample size
Use `denom` as the metric snapshot `sample_size` (so alerts have context).

---

## 3) Alerting recommendation (threshold/targets)

### 3.1 Keep broad metric as hygiene+substance (lower priority)
- `evaluator.low-quality-rate-24h`
  - Keep collecting and graphing.
  - **Recommendation:** loosen alerting pressure here (either raise threshold or downgrade priority) because it conflates hygiene/unscorable with substantive failures.
  - Suggested target/threshold:
    - Target: **0.10** (unchanged or informational)
    - Threshold: **0.30** (can remain, but ideally not used for paging)

### 3.2 Make substantive metric the paging metric
- `evaluator.substantive-low-quality-rate-24h`
  - This should be the metric that gets the **0.30 paging threshold** (or stronger), because it maps to “real output quality/safety failures”.
  - Suggested targets:
    - Target: **0.10** (steady-state expectation)
    - Threshold: **0.30** (page/alert boundary)

If you want both:
- Keep `evaluator.low-quality-rate-24h` as a **hygiene + process health** dashboard metric (non-paging or higher threshold), and enforce serious attention via the substantive metric.

---

## 4) Verification plan (post-implementation)

Run these queries directly against the runtime DB after the handler change is deployed (or locally if you can point at the same DB connection).

### 4.1 Reproduce BOTH rates in one query (broad + substantive)
This query computes:
- broad: “verdict=needs_improvement OR score < 0.7” (adjust column names if needed)
- substantive: per the new definition

```sql
WITH
  window AS (
    SELECT
      e.sessionId,
      e.issues,
      e.verdict,
      e.score,
      s.status
    FROM evaluations e
    LEFT JOIN sessions s ON s.sessionId = e.sessionId
    WHERE e.createdAt >= (strftime('%s','now') - 86400) * 1000
  )
SELECT
  COUNT(*) AS denom,
  SUM(CASE WHEN verdict = 'needs_improvement' OR (score IS NOT NULL AND score < 0.7) THEN 1 ELSE 0 END) AS broad_numer,
  (1.0 * SUM(CASE WHEN verdict = 'needs_improvement' OR (score IS NOT NULL AND score < 0.7) THEN 1 ELSE 0 END)) / NULLIF(COUNT(*),0) AS broad_rate,

  SUM(
    CASE
      WHEN status IN ('error','interrupted') THEN 1
      WHEN issues IS NOT NULL AND (
        lower(issues) LIKE '%tool hallucination%'
        OR lower(issues) LIKE '%verification failure%'
        OR lower(issues) LIKE '%blind overwrite%'
      ) THEN 1
      ELSE 0
    END
  ) AS substantive_numer,
  (1.0 * SUM(
    CASE
      WHEN status IN ('error','interrupted') THEN 1
      WHEN issues IS NOT NULL AND (
        lower(issues) LIKE '%tool hallucination%'
        OR lower(issues) LIKE '%verification failure%'
        OR lower(issues) LIKE '%blind overwrite%'
      ) THEN 1
      ELSE 0
    END
  )) / NULLIF(COUNT(*),0) AS substantive_rate
FROM window;
```

### 4.2 Confirm the handler is emitting the new metric into `metrics.current`
After one handler run, verify both exist:

```sql
SELECT id, current, threshold, target, updated_at
FROM metrics
WHERE id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
);
```

Expected:
- Broad rate remains high (current breach driver).
- Substantive rate is materially lower (per the impact model; previously ~0.08–0.12).

---

## 5) Patch sketch (where to insert in code)

In `agents/may/handlers/metrics-snapshot.ts`, locate the existing evaluator metric measurements (near where `record('evaluator.low-quality-rate-24h', ...)` is called). Add:

- compute `denom` and `numer` using the SQL in §2.3 via `count()` or `db.prepare().get()`.
- compute `rate = denom === 0 ? 0 : numer/denom`.
- call:
  - `record('evaluator.substantive-low-quality-rate-24h', rate, denom)`

This is intentionally parallel to how `evaluator.low-quality-rate-24h` is recorded.

---

## 6) Notes / constraints
- This plan avoids rewriting heuristic scoring and avoids JSON parsing brittleness.
- It is designed to be stable even if `issues` is plain TEXT.
- It does **not** reduce `evaluator.low-quality-rate-24h`; it makes paging/attention align with substantive failures.
