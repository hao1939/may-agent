# Iteration 1 — consumer discovery + patch plan (guard-safe)

## What this iteration accomplished
Identified the in-repo **threshold/alert emitter** for `evaluator.low-quality-rate-24h` as `agents/may/handlers/metrics-snapshot.ts` (the metric registry + breach logic). This closes the “where is it consumed?” ambiguity and enables an end-to-end patch proposal.

This output is a **surgical, review-ready patch plan**: switch paging/thresholding away from `evaluator.low-quality-rate-24h` to `evaluator.substantive-low-quality-rate-24h` **without hiding the original metric** (it remains tracked), and add explicit *pipeline/unscorable* metrics so false-penalties don’t turn into false-goods.

No project/journal files were modified.

---

## Evidence: in-repo consumer exists
Search for `metrics-snapshot` shows multiple references to alert emission and metric registry being inside:
- `agents/may/handlers/metrics-snapshot.ts` (explicitly referenced as the breach/metric lifecycle writer in arc proposals)

Search for the string `evaluator.low-quality-rate-24h` shows it is actively used in daily alert review outputs (operator-facing), confirming this metric is part of the active alert set.

(These searches were run via `grep` because ripgrep (`rg`) is not installed in this environment.)

---

## Problem restatement (why the metric is “red”)
Current `evaluator.low-quality-rate-24h` conflates:
1) **Substantive agent quality failures** (fixable behavior)
2) **Pipeline/unscorable sessions** (runner interruption, transcript schema/query failures, evaluator unable to read transcript)

The evaluator’s heuristic step-function (`issues.length > 0 ⇒ needs_improvement`) amplifies this: any pipeline issue looks like low quality.

We already have a validated decomposition direction from prior iterations:
- keep a “broad” low-quality rate (for visibility)
- alert on a “substantive” low-quality rate
- separately track unscorable rates so we don’t inflate “good”

---

## Proposed change (minimal, end-to-end)
### A) Alerting pivot: page on substantive metric
**Change** the metric configuration in `agents/may/handlers/metrics-snapshot.ts` so the *alert threshold* currently applied to `evaluator.low-quality-rate-24h` is instead applied to:
- `evaluator.substantive-low-quality-rate-24h`

Keep `evaluator.low-quality-rate-24h` still recorded, but set it to:
- no alert, OR a much higher “warning only” threshold (optional)

Rationale: reduces false penalties without deleting data.

### B) Add explicit unscorable metrics (to prevent false-good overturns)
Introduce metrics that capture “pipeline/unscorable” explicitly, e.g.:
- `evaluator.unscorable-rate-24h`
- `evaluator.transcript-error-rate-24h`
- `evaluator.runner-interrupted-rate-24h`

These should have thresholds appropriate for pipeline health (likely low thresholds), and can be assigned to the correct owner (may/dev) so they don’t silently degrade.

This ensures we don’t game the system: we’re not ignoring bad sessions; we’re classifying them correctly.

---

## Implementation sketch (for may to apply in-lane)
> Note: exact code locations/shape must be confirmed by opening `agents/may/handlers/metrics-snapshot.ts`. This iteration is discovery + patch plan only; do not edit may-lane files out-of-lane.

1. Locate the metric registry list (often an `ALL_METRICS` array/object) in `agents/may/handlers/metrics-snapshot.ts`.
2. Find the entry for `evaluator.low-quality-rate-24h`.
3. Either:
   - move its `alert` config to `evaluator.substantive-low-quality-rate-24h`, or
   - duplicate config but **only** substantive has an alert threshold.
4. Add new metric definitions for the unscorable rates (if not present) with alert modes as appropriate.

Guard-safety: this is a pure config/registry change + metric computations; no DB resets/migrations required.

---

## Required follow-up verification (to avoid another stalled iteration)
When may/dev lands the patch, verify end-to-end:
1. `metrics-snapshot` handler runs successfully.
2. `metric_alerts` new breaches (if any) reference the *substantive* metric name.
3. `evaluator.low-quality-rate-24h` still records values but no longer pages (if that config was chosen).
4. `unscorable-*` metrics move when pipeline failures happen (confirm with at least one known example: `status='interrupted'` sessions).

---

## Hygiene note (guard failure prevention)
Prior iteration failures involved accidental modification of:
- `agents/shared/projects/evaluator-low-quality-rate-calibration/project.md`

This iteration produced outputs **only** under:
- `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/`

No other files should be staged/committed as part of this deliverable.