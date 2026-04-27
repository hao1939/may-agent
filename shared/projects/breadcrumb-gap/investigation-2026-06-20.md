# Breadcrumb Action Rate Investigation — 2026-06-20

## Current Metric: 19.6% → 50.0% after fix (target ≥80%)

## Root Cause: Denominator inflation in measurement script

The metric is wrong — not the G-pattern integration.

### The Mismatch

**What agents actually see** (`loadMetrics` in `*-heartbeat.ts`):
```js
const breached = r.threshold != null && r.current != null &&
  (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);
```
Only shows "⚠️ BELOW TARGET" + breadcrumb when **threshold is non-null AND breached**.

**What measurement script counts** (`measure-breadcrumb-action-rate.sh`):
```js
const target = m.threshold ?? m.target;  // Falls back to target!
const isBelow = m.direction === "lower_is_better" 
  ? latest.value > target 
  : latest.value < target;
```
Uses `threshold ?? target` — when threshold is null, it falls back to `target` (aspirational goal), counting sessions where the agent **never saw any breadcrumb**.

### Impact

- **8 of 21 active metrics** have no threshold (null): `bob.hypotheses-resolved`, `tech-lead.meaningful-changes`, `tech-lead.codebase-weight`, `tech-lead.delegation-quality`, `scout.hypotheses-generated`, `scout.findings-used`, `optimizer.waste-reduction`, `optimizer.workflow-coverage`
- These metrics routinely fall below their aspirational `target` values
- The measurement script counts every heartbeat for those agents as "had breadcrumbs" → massive denominator inflation
- Agents in those sessions never saw ⚠️ or any breadcrumb → counted as failures

### Numbers

| Category | Count |
|----------|-------|
| Total heartbeats (7d) | 2,071 |
| Sessions measurement says "had breadcrumbs" | 775 |
| Sessions that actually had "BELOW TARGET" in task | 20 |
| Sessions with G-pattern question in task | 3 |
| **Inflation factor** | **~39x** |

### Verification

Only 2 metrics currently breach their threshold in `loadMetrics`:
- `evaluator.coverage`: current=3, threshold=80 (breached) — but evaluator has no heartbeat workflow in the list
- `coach.breadcrumb-action-rate`: current=0.1961, threshold=0.5 (breached)

So the denominator should be ~20 sessions (from historical breaches), not 775.

### Secondary Issues

1. **G-pattern barely fires**: Only 3 sessions in 7 days had the G-pattern question injected. Most agents' metrics are healthy enough that `threshold` is never breached.

2. **Agents that DO see breadcrumbs act on them**: By-agent rates for agents with real breaches are likely much higher than 19.6%, but drowned out by the 755 false-positive denominator entries.

## Proposed Fixes

### Fix 1 (Applied): Null threshold guard
**File**: `agents/coach/scripts/measure-breadcrumb-action-rate.sh`

Changed `hadBelowTargetMetric` to skip metrics with null threshold, matching `loadMetrics` logic. Reduces denominator from 775 → 491. But still inflated because:

### Root issue: snapshot ≠ runtime `current`

`loadMetrics` reads `metrics.current` (a single mutable column) at runtime. The measurement script reconstructs from `metric_snapshots` history. These diverge heavily:
- `bob.experiment-completion` has 47 snapshots at value=0 (below threshold 0.75), but `current` is 0.94 — the metric was broken historically
- `qa.review-coverage` has 86 snapshots at 0, but `current` is 314

The snapshot proxy systematically overcounts because it attributes old metric failures to current session times.

### Fix 2 (Recommended): Log G-pattern activation in heartbeat workflows

Add a session tag or DB entry when the G-pattern block is injected. Each `*-heartbeat.ts` already computes `hasRedMetrics`. Add:

```ts
// In each *-heartbeat.ts, after computing hasRedMetrics:
if (hasRedMetrics) {
  ctx.emit({ type: "tag", tag: "breadcrumb-shown" });
}
```

Then the measurement script queries:
```sql
SELECT sessionId FROM session_events WHERE tag = 'breadcrumb-shown'
```

This is ground truth — no reconstruction needed.

### Fix 3 (Interim, if runtime can't be changed): Use task text search

For workflow-based heartbeats, the prompt isn't stored in `sessions.task`. But we could add a lightweight marker to the task field:

```ts
const task = `[heartbeat] ${agent} heartbeat via per-agent workflow.${hasRedMetrics ? " [breadcrumbs]" : ""}`;
```

Then measurement simply: `WHERE task LIKE '%[breadcrumbs]%'`

## Results After Fix

Applied Fix 1 + rewrote the script (v3) to use ground truth — checking `sessions.task` for "BELOW TARGET" + "waking up for your heartbeat":

| Metric | Before (v2) | After (v3) |
|--------|-------------|------------|
| Denominator (sessions with breadcrumbs) | 775 | 8 |
| Numerator (acted) | 152 | 4 |
| **Rate** | **19.6%** | **50.0%** |

The 19.6% was never real — agents were being judged on breadcrumbs they never saw. With accurate measurement:
- 8 sessions in 7 days actually received BELOW TARGET breadcrumbs
- 4 of those (50%) took metric-related action
- The remaining 4 need investigation: are they ignoring the G-pattern, or is the action-detection regex too strict?

## Remaining Gap (50% → 80%)

With only 8 sessions, n is too small for confidence. The 50% rate may improve with more data. Key next steps:
1. Monitor v3 metric over next week with larger n
2. Investigate the 4 non-acting sessions — are they false negatives (agent acted but digest didn't match regex)?
3. Consider broadening action patterns if agents investigate but use different terminology
