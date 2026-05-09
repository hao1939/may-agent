# Iteration 1 deliverable — consumer discovery + patch snippet

## What we needed to learn
Where `evaluator.low-quality-rate-24h` is *consumed* for thresholding / paging.

## Finding (in-repo)
Alert emission is **in-repo** and happens in **`agents/may/handlers/metrics-snapshot.ts`**:

- `ALL_METRICS` registry defines `evaluator.low-quality-rate-24h` and `evaluator.substantive-low-quality-rate-24h` (both `threshold: 0.30`, `alert_op: ">"`, priority `P2`).
  - Evidence: `agents/may/handlers/metrics-snapshot.ts` lines ~50–90.
- This same handler later runs an alert lifecycle pass and emits:
  - `metric.breach`
  - `metric.recovered`
  - `metric.stalled`
  - Evidence: `agents/may/handlers/metrics-snapshot.ts` around lines ~856–882.

Then `metric.breach` is consumed by **`agents/may/handlers/metric-alert-reactor.ts`**, which:
- forks a triage session for the metric owner (P0 immediate; P1/P2 after grace period),
- dedups based on recent owner sessions,
- persists the loop until a `metric.alert_judged` event is emitted.

So: **we *can* repoint paging by changing the metric registry priority/threshold (or by changing alert emission eligibility).**

## Why this explains the stall
`evaluator.low-quality-rate-24h` is `priority: P2` so it generates `metric.breach` events, which triggers the metric-alert-reactor triage loop. If the broad metric is dominated by hygiene/pipeline “NI” markers, paging will stay noisy even if substantive quality is fine.

## Minimal patch options (surgical)
The goal is: page/triage on **substantive failures** (agent-controlled) and track hygiene/pipeline issues separately without constant triage churn.

### Option A (one-line change): downgrade the broad metric priority
**Change** in `agents/may/handlers/metrics-snapshot.ts` registry:

```ts
{ id: "evaluator.low-quality-rate-24h", ... priority: "P3" },
{ id: "evaluator.substantive-low-quality-rate-24h", ... priority: "P2" },
```

Rationale:
- Keeps the broad metric visible in dashboards/metric context.
- Prevents metric-alert-reactor from forking repeated triage (it ignores non-P0/P1/P2).
- Maintains a “real” quality regression page signal (`substantive-*`).

**Risk/Tradeoff**: if you still want *some* alerting on broad hygiene regressions, P3 means “no explicit owner triage sessions” by default.

### Option B: keep broad metric P2 but raise its threshold
If the broad metric is expected to stay high while heuristic dominates, you can reduce churn by increasing its threshold (e.g. 0.7) until heuristic/pipeline issues are addressed.

**Not recommended** vs Option A because it still conflates hygiene with quality, just at a different level.

### Option C: prevent alerts for "unscorable" slices (future)
Once we add an explicit `unscorable` verdict/flag and compute an `evaluator.unscorable-rate-24h`, we can change broad rate definition or alert emission rules to exclude it. This is higher-touch than Option A.

## Suggested verification queries (read-only)
To confirm registry is applied to DB on next snapshot run:

```sql
SELECT id, threshold, alert_op, priority
FROM metrics
WHERE id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
);
```

To confirm which alerts exist:

```sql
SELECT ma.id, ma.metric_id, ma.created_at, ma.resolved_at
FROM metric_alerts ma
WHERE ma.metric_id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
)
ORDER BY ma.created_at DESC;
```

## Recommendation for this goal
Implement **Option A**: switch paging/triage attention from broad -> substantive by **downgrading** `evaluator.low-quality-rate-24h` to **P3**, while keeping `evaluator.substantive-low-quality-rate-24h` at **P2**.

This directly addresses: “separate fixable agent behavior failures from pipeline/guard false-penalties” without changing scoring logic yet.
