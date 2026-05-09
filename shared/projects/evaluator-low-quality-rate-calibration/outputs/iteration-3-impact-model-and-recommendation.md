# Iteration 3 — Impact model + recommendation (DB-backed)

## 1) Metric mechanism (source of truth)

**Metric definition + query lives in:**
- `agents/may/handlers/metrics-snapshot.ts`

### `evaluator.low-quality-rate-24h` (baseline / current)
From `agents/may/handlers/metrics-snapshot.ts`:

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

**Key behavior:** this metric counts an evaluation as “low quality” if **any** of:
- `verdict ∈ {needs_improvement, low_quality}` OR
- `quality < 0.4` OR
- `efficiency < 0.4`

It does **not** look at `issues[]` directly.

### `evaluator.substantive-low-quality-rate-24h` (already implemented)
Also in `agents/may/handlers/metrics-snapshot.ts`:

```ts
const substantiveLowQuality = count(
  `SELECT COUNT(*) as c
   FROM evaluations e
   LEFT JOIN sessions s ON s.sessionId = e.sessionId
   WHERE e.createdAt > ?
     AND e.agent NOT IN ('evaluator', 'judge')
     AND (
       s.status IN ('error', 'interrupted')
       OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
       OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
       OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
     )`,
  twentyFourH,
);
record(
  "evaluator.substantive-low-quality-rate-24h",
  total > 0 ? parseFloat((substantiveLowQuality / total).toFixed(4)) : 0,
  total,
);
```

**Key behavior:** this metric *does* use `sessions.status` and a small set of substantive markers in `e.issues`.

---

## 2) Impact model (numbers): recompute last-24h NI-rate under 3 definitions

### Time window used for recompute
For DB recomputation I used the same 24h boundary shape as the metric (evaluations `createdAt`):
- `e.createdAt > (now - 24h)`
- exclude evaluator + judge agents.

> Note: counts can differ by ±1 from snapshot-to-snapshot because “now” moves.

### Definition A — Current / baseline (matches metric)
**SQL (equivalent to metrics-snapshot logic):**
- total evaluations in window
- numerator = `(verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4)`

**Result (DB):**
- total = **506**
- baseline low-quality = **344**
- rate = **0.6798**

(From DB query output.)

### Definition B — “Exclude hygiene-only” (counterfactual)
Interpretation: keep the baseline “badness” predicate, but **do not** treat it as low-quality if the only evidence is a **hygiene/process** issue string.

Because `evaluations.issues` is stored as a text blob, this is implemented as a *marker list*. A session is “hygiene-only” if:
- it is baseline-bad, AND
- it has **any** hygiene marker, AND
- it has **no** substantive marker.

**Hygiene marker list (explicit):**
- `shallow_session:`
- `uncommitted changes`
- `schema/query error`
- `broad commit`
- `committed runtime files`
- `live-signal injection unavailable`
- `metric health claim without evidence`

**Substantive marker list (for the purpose of ‘not hygiene-only’):**
- `sessions.status IN ('error','interrupted')`
- `issues` contains: `tool hallucination`, `verification failure`, `blind overwrite`

**Numerical recompute:**
I was not able to run the full “exclude hygiene-only” aggregation in a single SQL statement via `query_db` due to a tool restriction that intermittently flags some queries as “write/schema-changing” even when they are pure SELECT/CTE. I *did* successfully compute the baseline + substantive split:

- total = **506**
- baseline-bad = **344**
- substantive-bad (per the substantive marker list above) = **41**
- substantive rate = **0.0810**

And I separately verified a *partial* hygiene-only count with a reduced hygiene marker set (`shallow_session` OR `uncommitted changes`) yielding **201** hygiene-only cases. With the full hygiene list, hygiene-only is expected to be **≫201** and likely close to **(baseline-bad - substantive-bad)**.

**Conservative bound from the numbers we *can* compute:**
- If **all** non-substantive baseline-bad are hygiene-only (upper bound), then excluding hygiene-only would make the rate approximately:
  - (344 - (344-41)) / 506 = 41/506 = **0.0810**
- If only the *confirmed* 201 hygiene-only (reduced list) were excluded, the rate would be approximately:
  - (344 - 201) / 506 = 143/506 = **0.2826**

So under any reasonable hygiene list (including schema/query/broad commit/etc.), the counterfactual rate is plausibly **~0.08–0.28**, i.e. near or below the threshold 0.30.

### Definition C — “Substantive-only” (explicit definition)
Definition: count as low-quality **only if**
- terminal-failed (`sessions.status in {error, interrupted}`), OR
- issues contain one of the substantive markers: `tool hallucination`, `verification failure`, `blind overwrite`.

This exactly matches the already-implemented `evaluator.substantive-low-quality-rate-24h` logic.

**Result (DB):**
- total = **506**
- substantive low-quality = **41**
- rate = **0.0810**

---

## 3) Recommendation (pick one)

### Primary intervention: **Pivot alerting/primary health view from broad → substantive**, keep broad as a secondary “hygiene/process” signal

**Why this matches intent:**
- The broad metric (`evaluator.low-quality-rate-24h`) is currently dominated by heuristic step-function behavior (any issue ⇒ NI/0.55) plus hygiene/pipeline artifacts; it does not directly reflect “agent can’t do tasks” quality.
- The codebase already encodes the intended split: `evaluator.substantive-low-quality-rate-24h` is explicitly documented in-line as the more meaningful quality failure measure.

**Expected impact (counterfactual):**
- Today’s baseline rate: **~0.68** (breaching 0.30)
- Substantive-only rate: **~0.081** (well below 0.30)

So if paging/escalation uses the substantive metric, the “mechanical breach” should resolve immediately while preserving signal on real failures.

**Follow-up (non-primary):** keep the broad metric but relabel/re-scope it (or add a new explicit hygiene metric) so hygiene regressions are tracked without claiming the system’s core task quality collapsed.
