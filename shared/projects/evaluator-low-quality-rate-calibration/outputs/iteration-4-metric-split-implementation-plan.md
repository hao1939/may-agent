# Iteration 4 — Metric split implementation plan (approach #1)

## Goal
Split the current broad metric (`evaluator.low-quality-rate-24h`) into:
1) **Broad (hygiene + substance)**: keep as-is so it continues to surface operational hygiene regressions.
2) **Substantive-only quality failures**: add `evaluator.substantive-low-quality-rate-24h` and **move the 0.3 alert threshold** to this new metric (or otherwise alert primarily on it).

This avoids a “definition/aggregation breach” where heuristic-v2 hygiene strings mechanically drive `needs_improvement`, inflating the broad rate.

---

## Proposed changes in `agents/may/handlers/metrics-snapshot.ts`

### 1) Keep existing metric definition (broad)
No logic change required; keep:
- `id`: `evaluator.low-quality-rate-24h`
- meaning: **“Broad needs-improvement/low-score evaluated sessions (24h)”** (already the name)

**Alerting/targets** (recommended):
- **Target**: keep `0.10` (or change to `0.20` if you want it to represent a hygiene+substance operational metric; optional)
- **Threshold**: raise to `0.30` or `0.40` if you want it non-paging; recommended to **de-emphasize alerting** here.

### 2) Add new metric ID (substantive-only)
Add (already present in the registry list in current file view, but still needs measurement logic below):
- `id`: `evaluator.substantive-low-quality-rate-24h`
- `name`: `Substantive evaluator quality failures (24h)`

**Alerting/targets** (recommended):
- **Target**: `0.10`
- **Threshold**: `0.30` (this is the threshold currently causing breach; it should apply to substantive-only)

Rationale: keep the existing alert semantics (“>0.3 is bad”) but apply it to the metric that tracks **real evaluator quality failures**, not hygiene-only NI.

---

## Exact SQL definition for the new metric

### Denominator: all evaluations in last 24h
We use `evaluations` as the base table and filter by evaluation creation time.

```sql
WITH base AS (
  SELECT
    e.session_id,
    e.issues,
    s.status AS session_status
  FROM evaluations e
  JOIN sessions s ON s.id = e.session_id
  WHERE e.created_at >= (strftime('%s','now') - 24*60*60) * 1000
)
SELECT COUNT(*) AS denom
FROM base;
```

### Numerator: substantive failure conditions (joinable + minimal string reliance)
Per requirement:
- numerator = evaluations in last 24h where:
  - `sessions.status IN ('error','interrupted')` **OR**
  - `issues` contains any *substantive markers*:
    - `tool hallucination`
    - `verification failure`
    - `blind overwrite`

Implementation note: `evaluations.issues` is stored as JSON (array). In SQLite we can treat it as text and match with `LIKE`, or (preferably) use `json_each` if JSON1 is enabled.

**Preferred (JSON1) numerator query:**

```sql
WITH base AS (
  SELECT
    e.session_id,
    e.issues,
    s.status AS session_status
  FROM evaluations e
  JOIN sessions s ON s.id = e.session_id
  WHERE e.created_at >= (strftime('%s','now') - 24*60*60) * 1000
),
substantive AS (
  SELECT DISTINCT b.session_id
  FROM base b
  LEFT JOIN json_each(b.issues) je
  WHERE
    b.session_status IN ('error','interrupted')
    OR (
      je.value LIKE '%tool hallucination%'
      OR je.value LIKE '%verification failure%'
      OR je.value LIKE '%blind overwrite%'
    )
)
SELECT COUNT(*) AS numer
FROM base b
WHERE b.session_id IN (SELECT session_id FROM substantive);
```

**Fallback (no JSON1) numerator query (less ideal, but still robust enough):**

```sql
WITH base AS (
  SELECT
    e.session_id,
    e.issues,
    s.status AS session_status
  FROM evaluations e
  JOIN sessions s ON s.id = e.session_id
  WHERE e.created_at >= (strftime('%s','now') - 24*60*60) * 1000
)
SELECT COUNT(*) AS numer
FROM base b
WHERE
  b.session_status IN ('error','interrupted')
  OR (
    CAST(b.issues AS TEXT) LIKE '%tool hallucination%'
    OR CAST(b.issues AS TEXT) LIKE '%verification failure%'
    OR CAST(b.issues AS TEXT) LIKE '%blind overwrite%'
  );
```

### Rate computation
`substantive_low_quality_rate_24h = numer / denom` (guard denom=0).

---

## Where/how to implement measurement in `metrics-snapshot.ts` (PR-ready patch outline)

1) Find the section where evaluator metrics are recorded (it will look like `record('evaluator.low-quality-rate-24h', ...)`).
2) Keep the current computation of `evaluator.low-quality-rate-24h` unchanged.
3) Add two new `count(...)` calls for numerator/denominator above and then:

```ts
const denom = count(/* denom SQL */);
const numer = count(/* numer SQL */);
record(
  "evaluator.substantive-low-quality-rate-24h",
  denom > 0 ? numer / denom : 0,
  denom,
);
```

4) If JSON1 is not guaranteed, either:
- attempt the JSON1 query and fall back to `LIKE` on error, **or**
- standardize on the fallback query.

---

## Alerting recommendation (what should page)

- **Primary pager metric (threshold 0.30):** `evaluator.substantive-low-quality-rate-24h`
  - This aligns alerting with “substantive output quality failures”.

- **Secondary hygiene/ops metric (target ~0.10, threshold ~0.30–0.40, non-paging):** `evaluator.low-quality-rate-24h`
  - Keep it visible on dashboards because it surfaces operational problems (interrupts, uncommitted changes, transcript parsing errors), but don’t let it dominate incident response about “quality”.

If you must keep both at P2, set the broad one to a less aggressive threshold and/or sustained alert mode.

---

## Verification plan (post-implementation queries)
Run these two queries against the runtime DB after the code change (they should reproduce both rates for the same 24h window):

### Query A — broad (existing) rate recomputation
(Exact definition must match the existing code; use this to sanity check after refactor. If the current code uses `verdict IN (...)` or `quality <= ...`, mirror it exactly.)

Template:
```sql
WITH base AS (
  SELECT e.*
  FROM evaluations e
  WHERE e.created_at >= (strftime('%s','now') - 24*60*60) * 1000
)
SELECT
  SUM(CASE WHEN verdict = 'needs_improvement' THEN 1 ELSE 0 END) AS numer,
  COUNT(*) AS denom,
  ROUND(1.0 * SUM(CASE WHEN verdict = 'needs_improvement' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 4) AS rate
FROM base;
```

### Query B — substantive-only rate recomputation (should match new metric)
```sql
WITH base AS (
  SELECT
    e.session_id,
    e.issues,
    s.status AS session_status
  FROM evaluations e
  JOIN sessions s ON s.id = e.session_id
  WHERE e.created_at >= (strftime('%s','now') - 24*60*60) * 1000
),
substantive AS (
  SELECT DISTINCT b.session_id
  FROM base b
  LEFT JOIN json_each(b.issues) je
  WHERE
    b.session_status IN ('error','interrupted')
    OR (
      je.value LIKE '%tool hallucination%'
      OR je.value LIKE '%verification failure%'
      OR je.value LIKE '%blind overwrite%'
    )
)
SELECT
  (SELECT COUNT(*) FROM substantive) AS numer,
  (SELECT COUNT(*) FROM base) AS denom,
  ROUND(1.0 * (SELECT COUNT(*) FROM substantive) / NULLIF((SELECT COUNT(*) FROM base),0), 4) AS rate;
```

Expected outcome after implementing the metric:
- `evaluator.low-quality-rate-24h` remains near the current ~0.39 (unless underlying hygiene improves).
- `evaluator.substantive-low-quality-rate-24h` lands closer to the substantive-only model (~0.1-ish), and the alert threshold of 0.3 should clear.
