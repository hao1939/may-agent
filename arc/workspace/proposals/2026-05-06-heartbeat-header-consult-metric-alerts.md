# Proposal: heartbeat header should consult `metric_alerts`, not just `current </> threshold`

**Filed:** 2026-05-06
**Author:** arc
**Severity:** P1
**Connects:** KE-770 (this proposal's evidence base), KE-765 (sibling lie at message level)

## Problem

`agents/shared/workflows/heartbeat-data.ts` builds every heartbeat's metrics block from `loadMetrics()`, which decides "breached" by `current </> threshold` only. Rate-mode alerts (counter metrics with `alert.mode = "rate"` in `metrics-snapshot.ts`) trip on rate stalls, not on threshold. Result: the heartbeat header reads "📊 All metrics healthy — no action needed" while three open `metric_alerts` rows sit a few lines below in the "Active Alerts" section.

100% of may heartbeats with rate-mode alerts open in the last 24h showed this contradicting prompt (7/30 sessions). Observed behavioral consequence (KE-770 §"Behavioral consequence"): may dismissed the alert as "misleading text" and finished without investigating the rate stall.

## Fix sketch (2 small edits in `agents/shared/workflows/heartbeat-data.ts`)

```ts
// loadMetrics, around line 67
const openAlert = db.prepare(
  "SELECT 1 FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1"
).get(r.id);
const thresholdBreached = r.threshold != null && r.current != null &&
  (r.alert_op === ">" || r.alert_op === "above" ? r.current > r.threshold : r.current < r.threshold);
const breached = thresholdBreached || !!openAlert;
let line = `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${breached ? "⚠️ BELOW TARGET" : "✅"}`;
if (breached && !thresholdBreached) {
  // rate-mode alert: surface the actual reason
  line += `\n  → Open alert (rate-mode): see Active Alerts section below for the rate-stall message.`;
}
```

That single change makes `formatMetricsBlock`'s `metrics.includes("⚠️ BELOW TARGET")` test return true when a rate alert is open, so the prompt header switches from "all healthy" to the existing "evaluate your metrics before anything else" branch. No new prompt template needed.

## Lane

`agents/shared/workflows/heartbeat-data.ts` — outside arc's edit lane (KE-450/451). Filing this proposal; needs human or may approval to land.

## Risk

- **Low**: only changes the heartbeat **summary**; the metric value, target, alert table and reactor logic are untouched.
- The "BELOW TARGET" branch already exists and is well-tested.
- One additional `SELECT 1 FROM metric_alerts` per metric per heartbeat tick (~14 metrics × 1 query); negligible.

## Falsifier of need (within 48h)

If `metric_alerts` empties out and stays empty (all rate alerts resolve naturally and don't recur) the contradiction stops appearing. Code-fix is still warranted because the next stall will reproduce it, but observational urgency drops.

## Related work

- This is upstream of KE-758's loadAlerts fix (alerts now surface; this proposal makes the surfacing consistent with the header).
- Pairs with KE-765 proposal (`agents/arc/workspace/proposals/2026-05-06-branch-aware-breach-message.md`) — same root cause (two breach predicates, one message), different surface. Either can land independently; both should.
