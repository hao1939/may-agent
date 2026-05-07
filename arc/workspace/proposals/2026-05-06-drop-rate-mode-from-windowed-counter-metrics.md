# Drop rate-mode alert from rolling-window counter metrics

**Proposed:** 2026-05-06
**Author:** arc
**Priority:** P1 (compounds noise but is independent of P0 alert-pipeline fixes)
**KE:** KE-774
**Lane:** `agents/may/handlers/metrics-snapshot.ts` (out of arc's edit lane → proposal)

## Problem (one paragraph)

Three "counter"-typed metrics — `handler.completed-count` (6h window),
`system.real-output-24h` (24h window), `project.iterations-24h` (24h window) —
record the **count of events in a rolling window**, not a monotonic cumulative
total. Their `config.alert.mode = "rate"` arm computes per-step delta and
compares to `min_rate`, which on a windowed gauge is structurally noise around
zero. Result: `handler.completed-count` opened/closed 11 alerts in 5h on
2026-05-06 (avg lifetime 14 min), `system.real-output-24h` opened/closed 9
alerts the same day, every breach false. KE-774 has the full mechanism.

## Change

Drop `config.alert` (or set `alert.mode` to omitted) for these three metrics in
`agents/may/handlers/metrics-snapshot.ts:39–58`:

```ts
// Before
{ id: "handler.completed-count", ..., type: "counter", target: 50, threshold: 10,
  ..., alert_op: "<",
  config: { alert: { mode: "rate", min_rate: 2, per: "hour", stall_after_ms: 3600000 } } },
{ id: "system.real-output-24h", ..., type: "counter", target: 100, threshold: 30,
  ..., alert_op: "<",
  config: { alert: { mode: "rate", min_rate: 5, per: "hour", stall_after_ms: 7200000 } } },
{ id: "project.iterations-24h", ..., type: "counter", target: 10, threshold: 0,
  ..., alert_op: "<",
  config: { alert: { mode: "rate", min_rate: 1, per: "hour", stall_after_ms: 7200000 } } },

// After (drop the rate config; let the existing fall-through threshold check
// at metrics-snapshot.ts:347 handle alerting)
{ id: "handler.completed-count", ..., type: "counter", target: 50, threshold: 10,
  ..., alert_op: "<" },
{ id: "system.real-output-24h", ..., type: "counter", target: 100, threshold: 30,
  ..., alert_op: "<" },
{ id: "project.iterations-24h", ..., type: "counter", target: 10, threshold: 0,
  ..., alert_op: "<" },
```

`handler.failed-count` keeps its rate-mode config (`max_rate=3/hr`) — that one
is also a windowed counter but the algorithm's failure mode there is
*under-alerting* (max_rate noise can't be exceeded by negative deltas), which
is acceptable for now and is a separate question.

## Why this is safe

The fall-through in `metrics-snapshot.ts:346–350` already implements the
correct gauge-style alert for these:

```ts
if (!breached) {
  breached = m.alert_op === ">" || m.alert_op === "above"
    ? m.current > m.threshold
    : m.current < m.threshold;
}
```

For `handler.completed-count` with `threshold=10`, this means "alert when
fewer than 10 handler completions in the last 6h" — which is the actual
intended health check. Today's value range was 151–203; threshold 10 is
~15× clear.

After this change, `min_rate * window_size` is the equivalent of the
threshold-mode alert anyway:
- `min_rate=2/hr × 6h = 12` — already covered by `threshold=10` (close, slightly more lenient by design).
- `min_rate=5/hr × 24h = 120` — `threshold=30` is more lenient, intentionally generous.
- `min_rate=1/hr × 24h = 24` — `threshold=0` is degenerate; this metric breaches only on literal zero, which is also the meaningful condition.

The single currently-open `project.iterations-24h` alert (created
2026-05-06 17:24Z, current value 57) will close immediately when this change
lands, because the threshold-mode check (`57 < 0` = false) doesn't breach.
This is the *right* outcome — the underlying condition ("project pipeline
quiet") deserves a separate, correctly-typed metric (see KE-771); the current
alert is firing for the wrong reason.

## Predicted effect (24h after merge)

- `handler.completed-count`: alerts opened = 0 (vs. 11/day baseline).
- `system.real-output-24h`: alerts opened = 0 (vs. 9/day baseline).
- `project.iterations-24h`: 1 currently-open alert resolves; 0 new opens.
- Total `metric_alerts` insert rate drops by ~80% across all metrics.

If after 24h any of these still flap, the diagnosis is wrong and we need to
look at the threshold-mode arm too.

## Falsifiers

- **F1:** If `handler.completed-count` opens **any** alert in the 24h after merge while value > 10, the threshold check itself has a bug. (Predicted: 0 opens.)
- **F2:** If removing rate-mode breaks the existing `metric.stalled` event emission for these metrics, the stall arm at `:332–344` shares the rate-config dependency and needs separate handling. **(Original F2 text was wrong on its facts — see KE-781. Stall events DO fire: 55 in last 24h for `project.iterations-24h`, ~12/hour cron cadence, all 55 `pending` because no handler subscribes. The stall arm is the only correct breach signal for these metrics — rate-mode is noisy (KE-774) and threshold-mode lies (KE-765); only the stall message ("stalled: no change for 120min") is correctly worded. Therefore: dropping the stall arm is NOT acceptable. Implementation MUST preserve `alertConfig.stall_after_ms` checks. The minimal way: keep the `lastTwo` query and the stall block at `:332–344`, drop only the rate-mode `min_rate`/`max_rate` checks and the `breached` fall-through reordering. Validate post-merge that `event_type='metric.stalled'` continues to fire for `project.iterations-24h` whenever the underlying counter is flat.)**

## Risk

Low. The fall-through threshold-mode is the same code path that's already
correctly alerting on the gauge-typed metrics in the same registry
(`handler.heartbeat-coverage`, `project.active-count`, etc.). No new code
introduced.

## Out of scope

- Renaming `type: "counter"` → `type: "windowed-gauge"`. Cosmetic; the
  registry-level type is no longer load-bearing once the rate config is
  removed.
- Generalising: detecting non-monotonic counters at runtime and warning. Worth
  doing as a follow-up but not required to fix today's flap.
- The KE-765 lying-message branch. That's a separate proposal already queued
  (P1); after this lands, the lying-message bug becomes invisible by default
  for these three metrics because the rate-mode message path won't be reached.

## Verification after merge

```sql
-- Should return 0 for these three metric_ids over the next 24h:
SELECT metric_id, COUNT(*) FROM metric_alerts
WHERE created_at > <merge_timestamp>
  AND metric_id IN ('handler.completed-count','system.real-output-24h','project.iterations-24h')
GROUP BY metric_id;
```
