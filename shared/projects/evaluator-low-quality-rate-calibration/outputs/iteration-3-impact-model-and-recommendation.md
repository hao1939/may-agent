# Iteration 3 — Impact model + recommendation for `evaluator.low-quality-rate-24h`

## 1) Metric mechanism (source-of-truth)

### Where it is defined
The metric `evaluator.low-quality-rate-24h` is defined and computed in:

- **File:** `agents/may/handlers/metrics-snapshot.ts`
- **Registry entry:** around line ~62
- **Computation:** around lines ~376–390

### Exact computation logic
In `agents/may/handlers/metrics-snapshot.ts`, the handler computes the last-24h rate over the **`evaluations`** table (not `metrics`), excluding `agent in ('evaluator','judge')`.

**Denominator** (`total`):
```sql
SELECT COUNT(*) as c
FROM evaluations
WHERE createdAt > ?
  AND agent NOT IN ('evaluator', 'judge')
```

**Numerator** (`needsImprovementOrLowScore`):
```sql
SELECT COUNT(*) as c
FROM evaluations
WHERE createdAt > ?
  AND agent NOT IN ('evaluator', 'judge')
  AND (
    verdict IN ('needs_improvement', 'low_quality')
    OR quality < 0.4
    OR efficiency < 0.4
  )
```

Then it records:

`needsImprovementOrLowScore / total` (rounded to 4 decimals) into metric id `evaluator.low-quality-rate-24h`.

This explains why “hygiene-only” `needs_improvement` labels (e.g., from heuristic v2’s `issues.length > 0 => needs_improvement`) directly inflate the metric.


## 2) Impact model (numbers): last-24h recomputation under 3 definitions

### Window + population
All recomputations below use the same window/pool:
- **Window:** `evaluations.createdAt > (now - 24h)`
- **Exclude:** `evaluations.agent IN ('evaluator','judge')`
- Joined `sessions` only to use `sessions.status` for the “substantive-only” definition.

**Observed total evaluated sessions (24h):** `490`

(These are live DB numbers at time of query.)


### (A) Current (baseline): as currently computed
Definition: exactly the current production query:

`verdict in ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4`

**Counts**
- Total: **490**
- Needs-improvement-or-low-score: **334**

**Rate:** **334/490 = 0.6816** (~**0.681**)


### Hygiene-only exclusion model
We need an explicit hygiene list. For this iteration, I treated an evaluation as **“hygiene-only NI”** if:

- It meets the baseline NI predicate, AND
- Its issues contain **any** of the following hygiene markers (substring match, case-insensitive), AND
- It contains **no** substantive markers (below), AND
- The session did **not** terminal-fail (`sessions.status NOT IN ('error','interrupted')`).

**Hygiene marker list used** (subset of common dominant triggers):
- `finish blocked by uncommitted changes`
- `schema/query error in transcript`
- `broad commit in may or shared`
- `committed runtime files`
- `live-signal injection unavailable`
- `metric health claim without evidence`
- `shallow_session`

**Substantive marker list used** (same as metric already shipping):
- `tool hallucination`
- `verification failure`
- `blind overwrite`

#### (B) Exclude hygiene-only
Definition: count as “low-quality” only if it meets baseline NI predicate **and is NOT hygiene-only** (as defined above).

**Counts**
- Baseline NI: **334**
- Hygiene-only NI (per above rules): **274**
- NI after excluding hygiene-only: **60**

**Rate:** **60/490 = 0.1224** (~**0.122**)

Interpretation: about **82%** of baseline “low-quality” flags in the last 24h are hygiene-only by this operational definition.


### (C) Substantive-only
Definition: NI iff
- terminal-failed: `sessions.status IN ('error','interrupted')`, OR
- issues include at least one substantive marker: (`tool hallucination` OR `verification failure` OR `blind overwrite`).

(This is intentionally aligned with the already-implemented `evaluator.substantive-low-quality-rate-24h` logic in `metrics-snapshot.ts`.)

**Counts**
- Substantive-only NI: **42**

**Rate:** **42/490 = 0.0857** (~**0.086**)


## 3) Recommendation (pick one)

### Primary intervention: **split alerting / paging away from the broad metric; treat broad metric as hygiene/process KPI**

Rationale:
- The current metric is **mechanically dominated** by heuristic-v2 “any issue => NI” + hygiene-string triggers.
- Under two reasonable counterfactuals:
  - Excluding hygiene-only NI gives ~**0.122** (still above target 0.10, but below 0.30 threshold)
  - Substantive-only gives ~**0.086** (below both target 0.10 and threshold 0.30)
- This suggests the alert is largely acting as a **hygiene/process failure detector**, not a “core output quality collapse” detector.

Concretely:
- Keep `evaluator.low-quality-rate-24h` as a broad “quality + hygiene” health KPI.
- Use `evaluator.substantive-low-quality-rate-24h` as the **primary paging/thresholded quality alert** (it already exists and is computed in the same handler).

### Expected new rate (if alert repointed)
If the consumer (pager/alert routing) switches from `evaluator.low-quality-rate-24h` → `evaluator.substantive-low-quality-rate-24h`, then based on the last-24h recomputation here:

- Alerted rate would drop from ~**0.681** to ~**0.086**.

This matches the likely policy intent: page on substantive evaluator failures (tool hallucination / verification failure / blind overwrite / terminal failure), while tracking hygiene failures separately so they can be improved without generating constant “false crisis” alerts.


## Appendix — Evidence pointers
- Metric definition + computation: `agents/may/handlers/metrics-snapshot.ts` (registry line ~62; computation block starting near the `try { const total = count(...` for evaluator.low-quality-rate-24h)
- DB schema used:
  - `evaluations`: columns `verdict`, `quality`, `efficiency`, `issues`, `createdAt`
  - `sessions`: column `status`
