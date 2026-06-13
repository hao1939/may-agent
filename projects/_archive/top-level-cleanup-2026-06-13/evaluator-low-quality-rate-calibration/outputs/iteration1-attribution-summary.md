# evaluator.low-quality-rate-24h — iteration 1 attribution summary

## Snapshot
- Metric `evaluator.low-quality-rate-24h`: **0.5268** (target **0.1**, alert threshold **0.3**)
- Evaluation coverage in last 24h:
  - total evaluations: **448**
  - needs_improvement: **236** (rate **0.5268**)
  - evaluatedByHeuristic: **448** (100%)
  - skippedByJs: **0**

**Interpretation:** This does **not** look like an “LLM eval disabled/stalled” problem; the pipeline is actively writing heuristic evals for all sessions.

## Composition of low-quality
Quality buckets among last-24h evaluations:
- **good @ 0.85**: 212
- **needs_improvement @ 0.55** ("any detected issue" hygiene bucket): **199**
- **needs_improvement @ 0.2** (terminal failure bucket): **37**

So **199/236 = 84.3%** of NI is the *0.55 hygiene step* rather than hard failures.

## Top issue texts driving NI (by frequency)
From `evaluations.issues` (JSON array of strings), NI sessions show these most common triggers:
1. **finish blocked by uncommitted changes**: 137
2. **schema/query error in transcript** (`no such column|table`): 103
3. **broad may/shared commit during session**: 54
4. terminal status: interrupted: 27
5. error: Clean start (fresh): 24
6. committed generated runtime files: 21

(others are rare: review override, metric health claim w/o evidence, anti-shallow, live signal injection unavailable.)

**Interpretation:** The spike is primarily (a) **real “process hygiene” incidents** being scored as low-quality via the heuristic step function, not (c) pipeline drift.

## Counterfactual direction (not yet fully computed)
Given 200/236 NI sessions contain at least one of the top-2 hygiene triggers (uncommitted changes or schema/query error), exempting or down-weighting these triggers would likely reduce `evaluator.low-quality-rate-24h` substantially (potentially from ~0.53 toward ~0.08–0.15 depending on overlap/handling), but we still need a precise overlap/counterfactual calculation.

## Evidence links (DB queries used)
- Metric current value:
  - `SELECT current, target, threshold FROM metrics WHERE id='evaluator.low-quality-rate-24h'`
- 24h evaluation rate + heuristic coverage:
  - counted via `evaluations.createdAt` window; heuristic_n = 448, skipped_js_n = 0
- Quality bucket distribution:
  - grouped by `(quality, verdict)`
- Top issue texts:
  - `json_each(evaluations.issues)` grouped by `value`

## Notes on heuristic mechanism
In `agents/evaluator/workflows/evaluator-aftermath.ts` (HEURISTIC_VERSION=3), `classifyVerdict()` is essentially:
- terminal failure (`status in {error, interrupted}` or `session.error`) → **quality 0.2**, verdict NI
- else if **any issues detected** (incl. transcript hygiene detectors) → **quality 0.55**, verdict NI
- else → **quality 0.85**, verdict good
