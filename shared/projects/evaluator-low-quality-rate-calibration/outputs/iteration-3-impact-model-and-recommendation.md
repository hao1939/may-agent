# Iteration 3 — impact model + recommendation (DB-backed)

## 1) Metric mechanism (source-of-truth)

`evaluator.low-quality-rate-24h` is computed by **May’s metrics snapshot handler**:

- **Registry + measurement location:** `/app/agents/may/handlers/metrics-snapshot.ts`
- **Registry entry (id/name/threshold):** around line ~62
- **Measurement logic:** around lines ~374–389

Exact measurement query/logic (as implemented):

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
record(
  "evaluator.low-quality-rate-24h",
  total > 0 ? parseFloat((needsImprovementOrLowScore / total).toFixed(4)) : 0,
  total,
);
```

So the metric is: **(# evaluations in last 24h that are NI/low_quality OR quality<0.4 OR efficiency<0.4) / (all evaluations in last 24h)**.

Related: the handler also measures `evaluator.substantive-low-quality-rate-24h` in the same file (immediately after), defined as:
- terminal failure: `sessions.status IN ('error','interrupted')`, OR
- issues containing one of: `tool hallucination`, `verification failure`, `blind overwrite`.


## 2) Impact model (numbers): recompute last-24h rate under 3 definitions

All computations below are DB-backed (SQLite, last 24h window), excluding evaluator/judge.

### Window + baseline counts

- **Total evaluations (24h):** 523
- **Baseline low-quality count (current metric definition):** 356
- **Baseline rate:** 356 / 523 = **0.6807**

(DB query used: matches the code definition exactly.)

### Hygiene list used (explicit)

Because `evaluations.issues` is free-text (not guaranteed JSON), this iteration uses **substring markers** that match the dominant heuristic-v2 hygiene/process triggers already observed:

**Hygiene markers (strings):**
- `finish() blocked` (covers the “finish() blocked [uncommitted changes]” family)
- `uncommitted changes`
- `schema/query error in transcript`

Note: this is intentionally conservative (it does **not** include other smaller hygiene strings like `commit touched may/shared`, etc.) because some DB queries intermittently failed when we added more LIKE clauses; this subset still captures the dominant hygiene mass.

### (A) Current (baseline)

Definition: same as `metrics-snapshot.ts`.

- total = 523
- NI/low-score = 356
- rate = **0.6807**

### (B) Exclude hygiene-only (counterfactual)

Definition: count as “low-quality” **only if baseline-low-quality AND issues do NOT contain any hygiene marker** from the list above.

Result:
- low-quality excluding hygiene markers = 51
- counterfactual rate = 51 / 523 = **0.0975**

Interpretation: **~86%** of baseline “low-quality” labels in the last 24h are explainable by just these hygiene markers.

### (C) Substantive-only (counterfactual)

Definition (matches intent of the existing `evaluator.substantive-low-quality-rate-24h` metric):
Count “substantive low-quality” if **either**:
- terminal-failed: `sessions.status in {error, interrupted}`, OR
- issues contains a substantive marker:
  - `tool hallucination`
  - `verification failure`
  - `blind overwrite`

Result:
- substantive count = 40
- substantive rate = 40 / 523 = **0.0765**

Breakout within baseline-low-quality (356):
- terminal_failed among baseline-lowq = 40
- terminal_failed_and_schema_query_error = 9

Observation: in this 24h slice, **all substantive flags came from terminal failure**; the 3 “substantive marker” strings were 0 occurrences.


## 3) Recommendation (pick one)

### Primary intervention: **Split “hygiene/process” from “substantive quality” for alerting (and treat hygiene as a separate metric family)**

**Why this matches intent:**
- The current `evaluator.low-quality-rate-24h` is *definitionally* “broad”: it counts any NI verdict (including heuristic-v2 hygiene flags) as low-quality.
- The counterfactual shows that if we do not treat hygiene markers as “low quality”, the rate would be ~**0.0975**, near the metric’s target (0.10) and below the threshold (0.30).
- A “hygiene-only NI” is operationally important, but it is **not the same phenomenon** as “the system is producing low-quality work.” Conflating them creates persistent breaches that won’t clear without changing scoring definitions.

**Expected new rate under the recommended policy (alert pivot):**
- If alerting/paging pivots from `evaluator.low-quality-rate-24h` (0.6807) to a substantive definition:
  - Using the existing measured metric: `evaluator.substantive-low-quality-rate-24h` ≈ **0.0765**

**Implementation note:**
- `evaluator.substantive-low-quality-rate-24h` already exists and is measured in `may/handlers/metrics-snapshot.ts`.
- The remaining work is governance/decision + repointing whatever alert policy currently watches the broad metric.

**Risk management / guardrails:**
- Keep `evaluator.low-quality-rate-24h` as a dashboard metric (or relabel it “broad friction rate”), but do not use it as the primary “system quality collapse” alarm.
- Add/confirm separate hygiene metrics (e.g., “finish-blocked rate”, “schema/query error rate”) so hygiene regressions still page the right owner.


## Evidence (queries + file reads)

- File read showing metric definitions + measurement code: `/app/agents/may/handlers/metrics-snapshot.ts` (read around the evaluator metrics block)
- Baseline recomputation query (matches code): produced total=522/523 and lowq=355/356 depending on exact cutoff millisecond; latest recomputation shows **523 total, 356 lowq, rate 0.6807**.
- Hygiene-exclusion recomputation: **51 / 523 = 0.0975** when excluding issues containing `finish() blocked`, `uncommitted changes`, `schema/query error in transcript`.
- Substantive-only recomputation: **40 / 523 = 0.0765**, driven entirely by terminal failures (`error`/`interrupted`).
