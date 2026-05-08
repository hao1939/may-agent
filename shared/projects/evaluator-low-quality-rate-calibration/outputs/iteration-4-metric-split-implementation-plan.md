# Iteration 4 — Metric split implementation plan (PR-ready)

## Goal
Keep the existing `evaluator.low-quality-rate-24h` metric (hygiene + substance), but add a **substantive-only** sibling metric and pivot alerting/thresholds to reflect the intended meaning.

This plan is written to be directly implementable in `agents/may/handlers/metrics-snapshot.ts`.

---

## 1) Proposed metric registry change (`agents/may/handlers/metrics-snapshot.ts`)

### 1.1 Keep existing metric (unchanged computation)
Current metric definition in `ALL_METRICS` (keep ID unchanged):

- `id`: `evaluator.low-quality-rate-24h`
- `name`: currently `Needs-improvement/low-score evaluated sessions (24h)`
- `threshold`: `0.30`
- `target`: `0.10`

**Recommendation (doc-only / optional name clarification):**
Re-label the name string to reflect intent:

- **from**: `Needs-improvement/low-score evaluated sessions (24h)`
- **to**: `NI/low-score evaluated sessions (24h) — hygiene + substance`

No query/logic change required.

### 1.2 Add new metric definition
Add a new entry adjacent to the existing evaluator quality metric in `ALL_METRICS`:

```ts
{ id: "evaluator.substantive-low-quality-rate-24h", name: "Substantive low-quality evaluated sessions (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P1" },
```

Notes:
- Priority: recommend **P1** (this is the new alert pivot metric).
- Initial `threshold` and `target` above are defaults; see alerting recommendation section for final values.

---

## 2) Proposed measurement implementation (exact SQL)

### 2.1 Where to implement
In `agents/may/handlers/metrics-snapshot.ts`, in the existing `try { ... }` block that measures `evaluator.low-quality-rate-24h`, add a second `try { ... }` block immediately after, using the same `twentyFourH` window and the same evaluator exclusion (`agent NOT IN ('evaluator','judge')`).

### 2.2 Denominator (total evaluated sessions, last 24h)
This denominator matches the existing metric’s denominator to keep comparisons consistent.

**Exact SQL:**

```sql
SELECT COUNT(*) as c
FROM evaluations e
WHERE e.createdAt > ?
  AND e.agent NOT IN ('evaluator', 'judge')
```

### 2.3 Numerator (substantive-only low-quality, last 24h)
Definition required by the prompt:

Numerator = evaluations in last 24h where:
- **(session.status IN ('error','interrupted'))**
  OR
- **issues contains any substantive markers**: `tool hallucination`, `verification failure`, `blind overwrite`

This must be DB-joinable and avoid “subset of hygiene issues” logic.

Assumptions based on current schema usage in this repo:
- `evaluations.sessionId` joins to `sessions.sessionId`.
- `sessions.status` exists.
- `evaluations.issues` is stored as JSON (string) in many setups, but may also be plain text; we’ll use `LIKE` matching on the serialized form to be robust.

**Exact SQL (robust, using join + LIKE):**

```sql
SELECT COUNT(*) as c
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > ?
  AND e.agent NOT IN ('evaluator', 'judge')
  AND (
    s.status IN ('error', 'interrupted')
    OR LOWER(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
    OR LOWER(COALESCE(e.issues, '')) LIKE '%verification failure%'
    OR LOWER(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
  )
```

**Rationale for LIKE here:**
- The substantive markers are treated as **stable evaluator taxonomy labels** (not “hygiene strings”).
- This avoids brittle “hygiene subset” checks and does not depend on exact issue list equality.
- Using `LOWER(COALESCE(...))` is tolerant to casing and NULL.

If `e.issues` is a JSON array and the DB supports JSON1, an alternative more structured approach is possible, but the above query is “least assumptions” and already joinable to `sessions`.

### 2.4 Rate computation (TypeScript)
Implementation should mirror the existing `record()` usage:

```ts
const total = count(
  "SELECT COUNT(*) as c FROM evaluations e WHERE e.createdAt > ? AND e.agent NOT IN ('evaluator', 'judge')",
  twentyFourH,
);
const substantiveLow = count(
  `SELECT COUNT(*) as c
   FROM evaluations e
   JOIN sessions s ON s.sessionId = e.sessionId
   WHERE e.createdAt > ?
     AND e.agent NOT IN ('evaluator', 'judge')
     AND (
       s.status IN ('error', 'interrupted')
       OR LOWER(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
       OR LOWER(COALESCE(e.issues, '')) LIKE '%verification failure%'
       OR LOWER(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
     )`,
  twentyFourH,
);
record(
  "evaluator.substantive-low-quality-rate-24h",
  total > 0 ? parseFloat((substantiveLow / total).toFixed(4)) : 0,
  total,
);
```

---

## 3) Alerting recommendation (thresholds / targets)

### 3.1 Keep existing metric as hygiene + substance (do not page on it)
- Metric: `evaluator.low-quality-rate-24h`
- Recommended purpose: **broad operational-hygiene + quality “noise” indicator** (useful for dashboards, investigations, workflow hygiene tracking).
- **Threshold:** keep at **0.30** (or raise slightly if it remains noisy), but **downgrade priority** to P2/P3 if paging is undesirable.
- **Target:** keep at **0.10** as an aspirational long-term goal, but treat as non-paging.

### 3.2 Pivot paging/alerting to substantive-only
- Metric: `evaluator.substantive-low-quality-rate-24h`
- Recommended purpose: **substantive output quality + real failures** (tool hallucination / verification failure / blind overwrite / terminal session failure).
- **Threshold (paging): 0.30**
- **Target: 0.10**

This aligns with the observed impact model from iteration 3 (~0.115 substantive-only baseline), meaning:
- We are near target already, so alerts become meaningful.
- A true quality collapse would still breach 0.30 quickly.

If the org wants this to be stricter, set substantive threshold to **0.20**; but per prompt, specify 0.3 vs 0.1 split:
- **0.30 threshold belongs on `evaluator.substantive-low-quality-rate-24h`.**
- **0.10 target belongs on `evaluator.substantive-low-quality-rate-24h`.**

---

## 4) Verification plan (run-after-implementation queries)

Run these directly against the runtime DB (same logic as the handler), substituting `:twentyFourH` with `strftime('%s','now')*1000 - 24*3600*1000` if needed, or pass the numeric cutoff used by the handler.

### 4.1 Query A — reproduce existing metric rate

```sql
WITH
  total AS (
    SELECT COUNT(*) AS n
    FROM evaluations
    WHERE createdAt > ?
      AND agent NOT IN ('evaluator', 'judge')
  ),
  low AS (
    SELECT COUNT(*) AS n
    FROM evaluations
    WHERE createdAt > ?
      AND agent NOT IN ('evaluator', 'judge')
      AND (verdict IN ('needs_improvement', 'low_quality') OR quality < 0.4 OR efficiency < 0.4)
  )
SELECT
  low.n AS numerator,
  total.n AS denominator,
  CASE WHEN total.n > 0 THEN ROUND(1.0 * low.n / total.n, 4) ELSE 0 END AS low_quality_rate_24h
FROM low, total;
```

### 4.2 Query B — compute new substantive-only rate

```sql
WITH
  total AS (
    SELECT COUNT(*) AS n
    FROM evaluations e
    WHERE e.createdAt > ?
      AND e.agent NOT IN ('evaluator', 'judge')
  ),
  substantive AS (
    SELECT COUNT(*) AS n
    FROM evaluations e
    JOIN sessions s ON s.sessionId = e.sessionId
    WHERE e.createdAt > ?
      AND e.agent NOT IN ('evaluator', 'judge')
      AND (
        s.status IN ('error', 'interrupted')
        OR LOWER(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
        OR LOWER(COALESCE(e.issues, '')) LIKE '%verification failure%'
        OR LOWER(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
      )
  )
SELECT
  substantive.n AS numerator,
  total.n AS denominator,
  CASE WHEN total.n > 0 THEN ROUND(1.0 * substantive.n / total.n, 4) ELSE 0 END AS substantive_low_quality_rate_24h
FROM substantive, total;
```

**Acceptance check:**
- Query A should match `metrics.current` for `evaluator.low-quality-rate-24h` after the next metrics-snapshot run.
- Query B should match `metrics.current` for `evaluator.substantive-low-quality-rate-24h` after the next metrics-snapshot run.

---

## 5) Implementation notes / edge cases

- The numerator includes **all** `sessions.status IN ('error','interrupted')` regardless of `Clean start (fresh)`; if you want to exclude clean-start interruptions as non-substantive, add:
  - `AND NOT (s.status='interrupted' AND COALESCE(s.error,'')='Clean start (fresh)')`
  This was **not** requested in the prompt, so treat it as an optional follow-up.

- If `evaluations.sessionId` can be NULL (rare), the join will drop those rows from the numerator; denominator still counts them. If this matters, switch to `LEFT JOIN` and treat missing sessions as non-substantive (or decide explicitly).
