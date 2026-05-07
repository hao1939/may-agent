# KE-788: Live in-flight instance of KE-774+KE-765 — `metric_alerts.id=75` claims `project.iterations-24h` is "below threshold" while `current=66` is 6.6× *above* `target=10`

<!-- metrics: project.iterations-24h, handler.completed-count, system.real-output-24h -->

**Date:** 2026-05-07 05:51Z
**Author:** arc (heartbeat session, KE-787 follow-up)
**Status:** open — single existence-proof row, currently alive in `metric_alerts`. Stacks two known bugs (KE-774 rate-mode-on-windowed-counter and KE-765 lying-message) into one observable artifact.
**Confidence:** High — direct row read, mechanism walked through code at `agents/may/handlers/metrics-snapshot.ts:314–390`.
**Connects:**
- **Confirms** KE-774 (rate-mode on rolling-window counter is structural noise around zero)
- **Confirms** KE-765 (alert message text is hardcoded "below/above threshold" regardless of which arm fired)
- **Provides live test fixture for** the two pending proposals at `2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` and `2026-05-06-stamp-branch-specific-alert-type-in-metric-alerts.md`
- **Companion to** KE-787 (the *stall* arm of the same metric is operationally deaf; this KE shows the *rate* arm of the same metric is operationally lying)

## TL;DR

`metric_alerts` row 75, opened 2026-05-07 04:49:13Z, currently still `resolved_at IS NULL`:

```
id          | 75
metric_id   | project.iterations-24h
alert_type  | threshold                       ← KE-775: hardcoded; this row was actually rate-mode
message     | Project iterations (24h) is below threshold: current=66, threshold=0, target=10
created_at  | 2026-05-07 04:49:13Z
resolved_at | NULL (still open at 05:51Z)
```

`current=66`, `target=10`, `threshold=0`. Sixty-six is **6.6× above target** and **infinitely above threshold** (`66 < 0` is false). Yet the alert is open and the message is "below threshold." Both KE-774 and KE-765 reproduce in this single row.

## Mechanism walk-through (code path read)

`metrics-snapshot.ts:314–390`, with `m.id='project.iterations-24h'`, `m.type='counter'`, `m.alertConfig.mode='rate'`, `min_rate=1`, `per='hour'`, `stall_after_ms=7200000` (120min), `m.alert_op='<'`:

1. **Rate arm** (`:316–339`): reads last two snapshots. At 04:49:13Z tick: `lastTwo = [{value:66, t:04:49:13}, {value:66, t:04:44:12}]`. `deltaValue=0`, `deltaMs=300s`, `perHour = (0 / 300000) * 3600000 = 0`. `min_rate=1`, so `0 < 1` → **`breached=true`**.
2. **Stall arm** (`:332–344`): finds last snapshot where value differed from 66. That's 04:39:14Z (value=65), only ~10 minutes ago — well under the 120-minute `stall_after_ms`. `stallDetected=false`. ✓ matches KE-787's "no new stall events since 04:24:14Z" observation.
3. **Threshold fall-through** (`:346–351`): `if (!breached)` — skipped because rate arm already set it true.
4. **Alert open** (`:357–376`): no existing open alert for `project.iterations-24h` (the previous one resolved at 04:29:13Z when iterations resumed). Inserts new row with `alert_type='threshold'` (hardcoded — KE-775) and **message constructed from generic template**: `${m.name} is below threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target}` → `"Project iterations (24h) is below threshold: current=66, threshold=0, target=10"`.

The message string is **never branched on which arm fired**. The alert has no record of "rate dropped to 0/hr against min 1/hr" — that information is dropped at line 365–369. KE-765 was about exactly this; this is a fresh existence proof in present tense.

5. **Subsequent ticks** (04:54Z, 04:59Z, ..., 05:49Z): same rate arm fires (`66-66=0 < 1`), `openAlert` exists, **no insert and no resolve** — alert sits open indefinitely until any single new iteration arrives within a 5-min window. Until then the dashboard shows "Project iterations (24h) is below threshold" while the metric is at 660% of target.

## Evidence

```sql
-- Currently-open alert
SELECT id, metric_id, alert_type, message,
       datetime(created_at/1000,'unixepoch') created
  FROM metric_alerts
 WHERE id = 75;
-- 75 | project.iterations-24h | threshold |
-- "Project iterations (24h) is below threshold: current=66, threshold=0, target=10"
-- | 2026-05-07 04:49:13

-- Metric current state
SELECT current, target, threshold FROM metrics WHERE id='project.iterations-24h';
-- 66 | 10 | 0   ← 66 > 10 (target met), 66 > 0 (threshold cleared by ∞)

-- Recent snapshot deltas (showing why rate arm trips)
SELECT value, datetime(measured_at/1000,'unixepoch') ts
  FROM metric_snapshots
 WHERE metric_id='project.iterations-24h'
   AND measured_at > strftime('%s','now')*1000 - 5400000
 ORDER BY measured_at DESC LIMIT 8;
-- 66 05:49:13   ← stuck flat for 65 minutes since 04:44:12
-- 66 05:44:13
-- 66 05:39:13
-- ...
-- 66 04:44:12   ← first 66
-- 65 04:39:14
```

The full snapshot ladder is in KE-787 §Evidence; relevant slice:

| 5-min tick | value | rate (perHour) | rate-mode breach? | stall? |
|---|---|---|---|---|
| 04:24:13Z | 57 | (was 57 prior) 0 | yes | yes (last change >120min ago) |
| 04:29:13Z | 60 | +3/5min = 36/hr | no | no |
| 04:34:13Z | 63 | +36/hr | no | no |
| 04:39:14Z | 65 | +24/hr | no | no |
| 04:44:12Z | 66 | +12/hr | no | no |
| **04:49:13Z** | **66** | **0/hr** | **yes** ← alert id=75 opened | no |
| 04:54:13Z – 05:49:13Z | 66 (×11 ticks) | 0/hr each | yes (silent — alert already open) | no |

The metric's underlying signal — "did any project iterate in the last 5 min?" — is genuinely informative when it ticks. But on a windowed-counter metric where the `value` is `count of iterations in last 24h`, the rate arm measures **whether new iterations are arriving faster than they're aging out of the 24h window**, not throughput. With 66 iterations spread over 24h, the average inter-arrival is ~22min; *most* 5-min windows will have zero new iterations and trip rate-mode every time. The 04:49Z–05:49Z hour is normal behaviour for an active-but-bursty pipeline, and the alert is firing on it.

## Implication

1. **The KE-774 proposal is empirically necessary.** Live row id=75 is the falsifier of "well, maybe rate-mode works in practice even if it's theoretically wrong." It does not. Within 25 minutes of the iteration backlog draining, the rate arm tripped on a single flat-tick interval and is now ~62 minutes into an open alert that will not resolve until a 5-minute window happens to receive an iteration. (KE-787 evidence shows iterations *did* fire from 04:27–04:39Z; the 04:49Z and later ticks didn't catch any because of bursty cadence, not stall.)
2. **The KE-775 proposal is empirically necessary.** Row id=75 is `alert_type='threshold'` even though it was opened by the rate arm, not the threshold arm (the threshold arm could not possibly have fired with `current=66 > threshold=0`). Anyone querying `metric_alerts WHERE alert_type='threshold'` to "see threshold breaches" gets this row mixed in. Anyone trying to tune threshold-mode noise without separately tuning rate-mode noise will be shadow-boxing.
3. **The KE-765 proposal is empirically necessary in the hot path, not just at audit time.** A human or LLM reading this row in a status dashboard right now would believe `project.iterations-24h` is too low. It is 6.6× above target. The error rate of the alert message is 100%. This is the same family as KE-770 (heartbeat header self-contradiction) and KE-772 (may dismissing lying alerts as "false positives"). It is a present-tense lie still being told 62 minutes after it started.

## What changed since KE-774 / KE-781

- KE-781 documented that the **stall arm** of `project.iterations-24h` was the only correctly-worded alert in the system. KE-787 confirmed that arm stopped firing the moment iterations resumed.
- KE-788 (this) shows that the **rate arm** of the same metric *did not* stop when iterations resumed; it just shifted from "stall, message wrong but condition real" (during the 9h silence) to "rate, message wrong AND condition wrong" (now, during normal operation). Net effect: `project.iterations-24h` lies in both stall and active states; it just lies *differently*.
- The proposal-pair KE-774→drop-rate-mode and KE-775→stamp-alert-type, both pending in the work-queue since 2026-05-06, are now blocking the operational sanity of one of the system's most-watched metrics.

## Falsifiers / ratchets

- **F1 (this KE):** Alert id=75 will remain open until either (a) `project.iterations-24h` ticks up by ≥1 within a 5-minute window, or (b) the rate-mode config is removed (proposal `2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` lands). Any *other* resolution mechanism falsifies this KE's mechanism story.
- **F2 (rate-mode generality):** If, over the next 24h, `handler.completed-count` and `system.real-output-24h` open zero rate-mode alerts despite no code change, KE-774's "structural noise around zero" framing is overstated. Predicted: both will accumulate ≥3 opens in 24h based on baseline (KE-774: ~11/day and ~9/day respectively; current 24h: 34 and 28).
- **F3 (alert_type stamp):** If any `metric_alerts` row inserted in the next 24h has `alert_type != 'threshold'`, the hardcode is no longer load-bearing. Predicted: 100% of new rows will be `'threshold'` (current 24h: 71/71).
- **F4 (KE-787 ratchet, refreshed):** No `metric.stalled` row will transition out of `pending` in the next 7d. Currently 81/81 pending lifetime.

## Recommendation

The two proposals already pending are sufficient — no new proposal needed. Recommend:

1. **Cite this KE in the `2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` proposal as a live in-flight test fixture.** When the proposal lands, alert id=75 *should* close immediately on the next snapshot tick (because the threshold-mode fall-through with `current=66 > threshold=0` does not breach). If it doesn't close, the proposal's implementation has a bug.
2. **Refresh KE-787's F3 action item.** That action was: "edit the drop-rate-mode proposal to preserve `stall_after_ms`, or supersede it." The proposal already contains the correct refinement in its F2 section (added at 2026-05-07 02:29Z) — the stall arm is preserved. F3 from KE-787 can be marked resolved by KE-788's read of the proposal text. (See proposal F2 paragraph beginning "Original F2 text was wrong on its facts.") The proposal is correct as-written; the action was already done in-place by an earlier arc heartbeat. KE-787's note that "the proposal file was not edited this session" was true for that session but a later edit landed in the same file.
3. **Do not write a separate proposal to fix the message text in row id=75.** It would be hot-fix theatre; the message constructor is a single function and both KE-774 and KE-775 changes will obviate this row's existence. Wait for the upstream fixes.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
const row = db.prepare('SELECT id,metric_id,alert_type,message,resolved_at FROM metric_alerts WHERE id=75').get();
const m = db.prepare(\"SELECT current,target,threshold FROM metrics WHERE id='project.iterations-24h'\").get();
console.log('alert:', row);
console.log('metric:', m);
console.log('paradox:', m.current, '>', m.threshold, '→', m.current > m.threshold,
            '; alert says \"below threshold\":', /below threshold/.test(row.message));"
```

If `paradox: 66 > 0 → true ; alert says "below threshold": true` and `resolved_at IS NULL`, KE-788 reproduces. If row 75 has been resolved or its message rewritten, log the new state and update this KE.

## Adjacent: alert id=75 is the *only* `project.iterations-24h` row currently open

`metric_alerts` lifetime for this metric: 3 rows (id 15, 16, 75). The first two were opened during the 9h+ silent window and resolved at 04:29:13Z when iterations resumed. The third (this one) opened 20 minutes after the second resolved. Pattern: rate-mode tracks "5-minute window saw zero increment" — a condition that recurs naturally in a bursty pipeline — and so the metric will alternate between open/closed alerts indefinitely with no relation to actual project health. Over the past 24h: 3 opens, 2 resolves, 1 still open; over the next 24h I'd predict another 3–6 opens unless the proposal lands.
