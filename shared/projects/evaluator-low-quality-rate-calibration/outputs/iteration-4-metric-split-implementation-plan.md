# Iteration 4 — Metric split implementation plan (approach #1)

## Goal
Keep the existing broad metric (currently driving the breach) as a **hygiene+quality** signal, and add a new metric that tracks **substantive evaluator quality failures** only. Then move alerting/expectations to the substantive metric so the “quality alert” reflects real output correctness rather than pipeline/guard hygiene.

This plan is PR-ready: exact code insertion points, exact SQL, and post-change verification queries.

---

## 1) Proposed metric registry changes (`agents/may/handlers/metrics-snapshot.ts`)

### Keep existing metric (no semantic change)
Keep the built-in metric `evaluator.low-quality-rate-24h` unchanged in both:
- `ALL_METRICS` registry entry (already present)
- measurement query (already present)

**Interpretation / label (doc-level):** This metric is **broad**: it counts *any* of:
- `verdict IN ('needs_improvement','low_quality')` **OR**
- `quality < 0.4` **OR**
- `efficiency < 0.4`

So it is expected to reflect **operational hygiene + substantive quality** (and will be sensitive to heuristic verdicting rules).

### Add / keep new metric: `evaluator.substantive-low-quality-rate-24h`
`metrics-snapshot.ts` already contains:
- a registry entry in `ALL_METRICS`:
  - id: `evaluator.substantive-low-quality-rate-24h`
  - name: `Substantive evaluator quality failures (24h)`
- a measurement block that computes it.

**If the next worker is implementing this from scratch in another branch:**
- Add the `ALL_METRICS` entry adjacent to `evaluator.low-quality-rate-24h`.
- Add the measurement block immediately after the broad metric block.

If we want to be extra explicit for future readers, we can optionally tighten the name/description (no behavior change), e.g.
- Broad metric name: `Broad (hygiene + quality) needs-improvement / low-score evaluated sessions (24h)`
- Substantive metric name: `Substantive quality failures (24h) (tool hallucination / verification failure / blind overwrite / terminal failure)`

---

## 2) Exact SQL for the new metric (DB-joinable; no fragile “hygiene subset” logic)

### Denominator (total evaluations in last 24h)
Use the same denominator as the broad metric:

```sql
SELECT COUNT(*) as c
FROM evaluations
WHERE createdAt > ?
  AND agent NOT IN ('evaluator', 'judge')
```

### Numerator (substantive failures)
Definition requested:
- evaluations in last 24h where **either**
  - `sessions.status IN ('error','interrupted')` (terminal failure)
  - OR evaluation `issues` contains any substantive marker:
    - `tool hallucination`
    - `verification failure`
    - `blind overwrite`

Exact SQL used by `metrics-snapshot.ts` (recommended):

```sql
SELECT COUNT(*) as c
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
```

### Metric value
In code (TypeScript), compute:

```
substantive_rate = total > 0 ? round4(substantiveLowQuality / total) : 0
```

Where `round4(x)` matches existing style:

```ts
parseFloat((x).toFixed(4))
```

---

## 3) Alerting recommendation (thresholds/targets)

### Keep broad metric, but treat as “hygiene + process friction”
- Metric: `evaluator.low-quality-rate-24h`
- Recommended semantics: **broad NI-or-low-score rate** (captures hygiene/process penalties and substantive quality).
- Recommended target/threshold:
  - **threshold 0.30**: keep as an operational hygiene regression alarm (it will still fire when pipeline/heuristic starts flagging lots of hygiene).
  - **target 0.10**: keep as aspirational (but do not treat it as the north-star “output quality” gate).

If org wants to reduce noise, consider raising broad threshold later (e.g., 0.40–0.50) once the substantive metric is adopted; but that’s a policy decision.

### Move the “quality” expectation to the substantive metric
- Metric: `evaluator.substantive-low-quality-rate-24h`
- Recommended semantics: **substantive failures only** (terminal failure or core evaluator failure patterns).
- Recommended alerting:
  - **threshold 0.30** should be applied to this metric (this becomes the primary “quality is broken” alarm).
  - **target 0.10** (or lower, e.g. 0.05) should be used as the desired steady-state.

Rationale: This aligns with the counterfactual modeling from iteration 3 (broad ~0.3925 vs substantive-only much lower), and prevents hygiene-only `needs_improvement` verdicts from masquerading as a global quality collapse.

---

## 4) Verification plan (run-after-implementation queries)

These are designed to reproduce the two rates directly from SQLite using the same time window and filters as `metrics-snapshot.ts`.

### Query A — compute both rates in one shot (recommended)

Bind parameter `:t24h` should be `Date.now() - 24*60*60*1000` in ms.

```sql
WITH window AS (
  SELECT :t24h AS t24h
),
base AS (
  SELECT e.sessionId,
         e.verdict,
         e.quality,
         e.efficiency,
         e.issues,
         s.status AS session_status
  FROM evaluations e
  LEFT JOIN sessions s ON s.sessionId = e.sessionId
  WHERE e.createdAt > (SELECT t24h FROM window)
    AND e.agent NOT IN ('evaluator', 'judge')
)
SELECT
  COUNT(*) AS total,
  SUM(CASE
        WHEN (verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4)
        THEN 1 ELSE 0 END) AS broad_n,
  ROUND(1.0 * SUM(CASE
        WHEN (verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4)
        THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 4) AS broad_rate,

  SUM(CASE
        WHEN (
          session_status IN ('error','interrupted')
          OR lower(COALESCE(issues, '')) LIKE '%tool hallucination%'
          OR lower(COALESCE(issues, '')) LIKE '%verification failure%'
          OR lower(COALESCE(issues, '')) LIKE '%blind overwrite%'
        )
        THEN 1 ELSE 0 END) AS substantive_n,
  ROUND(1.0 * SUM(CASE
        WHEN (
          session_status IN ('error','interrupted')
          OR lower(COALESCE(issues, '')) LIKE '%tool hallucination%'
          OR lower(COALESCE(issues, '')) LIKE '%verification failure%'
          OR lower(COALESCE(issues, '')) LIKE '%blind overwrite%'
        )
        THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 4) AS substantive_rate
FROM base;
```

Expected outcome:
- `broad_rate` should match (within rounding) `metrics.current` for `evaluator.low-quality-rate-24h`.
- `substantive_rate` should match (within rounding) `metrics.current` for `evaluator.substantive-low-quality-rate-24h`.

### Query B — sanity-check numerator composition (optional but recommended)
This ensures the numerator is driven by the intended reasons.

```sql
WITH base AS (
  SELECT e.sessionId,
         COALESCE(s.status, 'missing_session') AS session_status,
         lower(COALESCE(e.issues, '')) AS issues
  FROM evaluations e
  LEFT JOIN sessions s ON s.sessionId = e.sessionId
  WHERE e.createdAt > :t24h
    AND e.agent NOT IN ('evaluator', 'judge')
)
SELECT reason, COUNT(*) AS n
FROM (
  SELECT sessionId,
         CASE
           WHEN session_status IN ('error','interrupted') THEN 'terminal_status'
           WHEN issues LIKE '%tool hallucination%' THEN 'tool_hallucination'
           WHEN issues LIKE '%verification failure%' THEN 'verification_failure'
           WHEN issues LIKE '%blind overwrite%' THEN 'blind_overwrite'
           ELSE NULL
         END AS reason
  FROM base
)
WHERE reason IS NOT NULL
GROUP BY reason
ORDER BY n DESC;
```

---

## 5) Notes / constraints

- This plan intentionally avoids “hygiene subset exclusion” logic (fragile string lists like `finish blocked by uncommitted changes`) and instead uses **positive substantive markers** plus **terminal session failure status**.
- The `issues` column is `TEXT` (likely JSON or newline-delimited strings); using `lower(..) LIKE '%...%'` matches current implementation and is robust to formatting.
- The `LEFT JOIN sessions` is intentional: it preserves evaluations even if a session row is missing; only the `s.status IN (...)` clause depends on session presence.
