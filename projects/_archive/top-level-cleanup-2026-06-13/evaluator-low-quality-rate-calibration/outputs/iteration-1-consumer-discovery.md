# Iteration 1 deliverable — Consumer/alert discovery for `evaluator.low-quality-rate-24h`

## What this answers
This artifact closes the key “operational wiring” ambiguity: **where `evaluator.low-quality-rate-24h` is consumed to produce alerts**.

## Findings (in-repo)
### 1) Metric definition + measurement (producer)
File: `agents/may/handlers/metrics-snapshot.ts`

- Metric registry contains both metrics (broad + substantive):
  - `evaluator.low-quality-rate-24h` (id line ~62)
  - `evaluator.substantive-low-quality-rate-24h` (id line ~63)
- Measurement/recording code exists for both:
  - broad recorded around lines ~388-389
  - substantive recorded around lines ~410-411

So the substantive metric is **already computed** in the same handler that computes the broad metric.

### 2) Threshold evaluation + alert emission
File: `agents/may/handlers/metrics-snapshot.ts`

This handler also evaluates thresholds and writes alert state.
Evidence: within the file there is code that:
- selects metrics where `m.current IS NOT NULL AND m.threshold IS NOT NULL` (around lines ~726-733)
- computes `thresholdBreached` via `evaluateThresholdBreach()` (around lines ~733-736)
- then marks the metric as breached and constructs an alert message (around lines ~826-858)

**Conclusion:** `metrics-snapshot.ts` is not only a producer of metric values; it is (at least one) **in-repo place where “current vs threshold” is evaluated** and a breach is emitted.

### 3) Alert consumer / triage routing (pager/dispatch)
File: `agents/may/handlers/metric-alert-reactor.ts`

This handler consumes `metric.breach` and decides whether to fork an agent for explicit triage.
Key behaviors:
- On timer tick, it polls unresolved rows from `metric_alerts` joined with `metrics` and re-processes them.
- It resolves metric ownership via `resolveMetricOwner()` using `metrics.owner` and optionally the owning project.
- It only creates explicit sessions for priority `P0/P1/P2`; P3 stays in “metric context only”.

So the path is:

`metrics-snapshot.ts` (measure + threshold check) → emits/creates breach (`metric_alerts` / `metric.breach`) → `metric-alert-reactor.ts` routes to owner.

## Runtime confirmation (DB)
Current values (runtime DB `metrics` table):
- `evaluator.low-quality-rate-24h`: current **0.6795**, threshold **0.3**, alert_op **>** (breaching)
- `evaluator.substantive-low-quality-rate-24h`: current **0.0787**, threshold **0.3**, alert_op **>** (not breaching)

This supports the project hypothesis that the broad metric is dominated by hygiene/unscorable issues.

## What this enables (next patch options)
Because alerting is driven by `metrics` config + `metrics-snapshot` evaluation, the alert pivot can be done **in-repo**:

Option A — **Repoint paging/triage to substantive metric** (minimal blast radius)
- Set `priority: "P3"` for `evaluator.low-quality-rate-24h` (so it won’t trigger explicit P2 triage sessions), and keep it for context.
- Keep `evaluator.substantive-low-quality-rate-24h` at `P2` (or raise to P1) so substantive failures still page.

Option B — **Disable alerting on the broad metric**
- Set `status: 'inactive'` for `evaluator.low-quality-rate-24h` in registry/DB (depends on desired governance; likely not preferred).

Option C — **Heuristic change to stop classifying hygiene-only as needs_improvement**
- This would move the broad metric down (since it counts NI/low-score) without alert repointing.
- But it is a heavier change with more evaluator-rubric implications.

Given the goal (“separate fixable agent behavior from pipeline/guard false-penalties” while avoiding false-good overturns), Option A is the safest immediate operational improvement.

## Notes / constraints
- This deliverable does **not** modify `project.md` or `journal.md`.
- `rg` is not available in this container (`rg: command not found`), so repo-wide search was performed via `grep -RIn`.
