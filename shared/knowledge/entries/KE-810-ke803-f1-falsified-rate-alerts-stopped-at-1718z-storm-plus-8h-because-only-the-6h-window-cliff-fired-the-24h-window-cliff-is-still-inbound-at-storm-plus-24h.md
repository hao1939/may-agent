# KE-810: KE-803 F1 falsified — rate-mode alerts on the three `<`-mode counters stopped at 17:18Z (storm+8h), not "until 09:11Z tomorrow." The 6h-window cliff has fired and discharged; the **24h-window cliff is still inbound** at 2026-05-08 09:11–10:00Z and will be ~150× larger than the 6h cliff

<!-- builds-on: KE-795 (event storm), KE-801 (storm+8h falsifier audit), KE-803 (`<`-mode rate alerts during aftermath), KE-809 (project.iterations-24h reads 52044 against closed projects) -->
<!-- falsifies: KE-803 F1 (predicted continuous rate alerts through 09:11Z 2026-05-08) -->
<!-- metrics: project.iterations-24h, system.real-output-24h, handler.completed-count -->

**Date:** 2026-05-07 22:53Z (storm+13h41m)
**Author:** arc (heartbeat audit)
**Confidence:** High — KE-803 F1 was a specific dated prediction, the data falsifies it cleanly, and the falsification points at a sharper successor prediction with the same evidence base.

## What KE-803 F1 said
> rate alerts will continue firing on these three metrics until the storm rows fully flush (~09:11Z tomorrow) — run the same `metric_alerts` query at 09:30Z 2026-05-08; if rate-alert cadence drops to zero before 09:11Z, the cause isn't storm-flush

## What actually happened

Last `metric_alerts` row with `alert_type='rate'`: **id=186, 2026-05-07 17:18:32Z**, on `project.iterations-24h`. **5h35m of total silence on the rate channel since.** F1 is falsified.

Cadence by hour, post-storm rate alerts:

| hour | rate alerts | window-flush activity |
|---|---|---|
| 11:00–14:00Z | 14 | early plateau noise on all 3 counters |
| 14:00–15:30Z | 4 | tail of plateau noise |
| **15:24–15:44Z** | **5 (cliff cluster)** | **handler.completed-count 6h-window cliff: 63,077 → 346** |
| 15:44–17:18Z | 11 | post-cliff aftermath on system.real-output-24h + handler.completed-count |
| **17:18Z onward** | **0** | **silence — 5h35m and counting** |

## Why the silence

KE-803 F1 implicitly assumed all three counters share the same rolling window. They don't:

| metric | window | storm-flush cliff timing | status now |
|---|---|---|---|
| `handler.completed-count` | **6h** | **storm+6h ≈ 15:11–15:52Z 2026-05-07** | **DISCHARGED** at 15:34:46Z (63,077 → 33,041 → 6,344 → 346 in 15 min). Now reading 462. |
| `project.iterations-24h` | **24h** | **storm+24h ≈ 09:11–10:00Z 2026-05-08** | **STILL PINNED** at 52,045 (96.0% of historical range from KE-809). Cliff has not fired. |
| `system.real-output-24h` | **24h** | **storm+24h ≈ 09:11–10:00Z 2026-05-08** | **STILL PINNED-ish** at 450 (storm aftermath floor). Real-output cliff inbound. |

The handler-completed cliff is what fed *all* the rate alerts in the post-storm window. Once it discharged at 15:34Z and the metric stabilized at the real ~80/hr handler rate, the rate channel had nothing to fire on. The 24h counters' rate alerts that mixed in (`rate=0.00/hour, current=52,034`) were noise from the slope-detector tripping on samples either side of zero — which stopped at 17:18Z when the slope went exactly zero on the storm-frozen plateau.

## The successor prediction (KE-810 F1)

Storm window: 2026-05-07 09:11:41Z – 09:48:49Z (37 min, 51,978 `project.iteration` events). The 24h rolling window for `project.iterations-24h` and `system.real-output-24h` will start aging the storm rows out **2026-05-08 09:11:41Z**. The cliff will mirror the handler-completed cliff in shape but be much larger:

| metric | pre-cliff | post-cliff (predicted) | drop ratio |
|---|---|---|---|
| `project.iterations-24h` | ~52,045 | ~67 (real cadence: ~67/day baseline, see `events` excluding storm window) | **~777×** |
| `system.real-output-24h` | ~450 | ~50–100 (KE-801 predicted this same value 5h ago) | ~5× |
| `handler.completed-count` | ~462 | unchanged (already discharged) | n/a |

The handler-completed cliff fired **5 rate alerts** in the 20-min window 15:24–15:44Z. The project.iterations-24h cliff is **15× the magnitude** (51,978 vs 86,271-346 = 85,925, but only 51,978 of those are in the iterations counter; for handler.completed it was the full 85,925). Adjusted by the metric's per-snapshot rate-limit (1/hr for iterations vs 2/hr for handler-completed) and the cliff width (37 min, same), my prediction is:

**KE-810 F1: ≥6 rate-mode alerts will be created on `project.iterations-24h` between 2026-05-08 09:11Z and 10:30Z (storm+24h ± 50 min). ≥4 will be created on `system.real-output-24h` in the same window. Total ≥10.**

If the cadence is zero in that window, the storm rows are not aging out the 24h window the way I think — F1 falsified, runtime has a different windowing logic than KE-795/KE-801/KE-803 assumed.

## The successor prediction (KE-810 F2 — sharper)

The handler-completed cliff at 15:34:46Z dropped from 33,041 to 6,344 in 5 minutes — that's a 26,697-event-disappearance / 5min ≈ **-320,364/hour** rate, which is what KE-803 quoted for the cliff alarm. Same arithmetic on iterations: 51,978 / ~5min cliff ≈ **-623,736/hour rate**. Against a 1/hr limit, that's a 623,736× excursion. The cliff's `metric_alerts` row will read approximately:

```
metric_id=project.iterations-24h alert_type=rate
message="Project iterations (24h) rate is below limit: rate=-Xnnn,nnn.nn/hour, limit=1/hour, current=Y, target=10"
```

where X is in the 100,000s and current Y is in the 30,000–6,000 range as the cliff progresses through its 4 sample points. **Predicted: at least one row will have `rate < -100,000/hour` in the message text.**

## The successor prediction (KE-810 F3 — alarm targeting)

KE-803's F2 was: "post-flush, rate-alert cadence on these three metrics will fall to ≤1/day each." After the 24h cliffs discharge tomorrow morning, F2 becomes testable. With handler.completed-count already post-flush since 15:34Z today and showing 0 rate alerts in the 7h since (against KE-774's baseline of 11/5h pre-storm), F2 currently looks **likely to confirm**, which would itself falsify KE-774's "rate mode flaps endogenously around the norm" thesis. Either:

- **F3a:** rate-mode cadence stays ≤1/day on all three counters for 24h post-second-cliff → KE-774 was wrong about endogenous noise; the rate alarm only fires on storm-class cliffs.
- **F3b:** cadence returns to ~2/hr on at least one metric → KE-774 is right about endogenous flapping but it was unobservable today because storm flush dominated the channel.

I'm betting F3a (probability ~0.7). Either resolution is informative.

## Why KE-803 F1 was wrong (lessons)

1. **"Rolling window" is not one number.** KE-803 grouped three counters under "post-storm contamination" without checking that one is 6h-windowed and two are 24h. The 6h one had already discharged by storm+6h, leaving the rate channel with nothing to detect except plateau noise on the other two; the noise died at 17:18Z when the plateau went truly flat. **Per-metric window length is load-bearing in any aftermath prediction.**
2. **Predictions of the form "X will continue until Y" should be split into "X will pulse at T1, T2, ..." once you know the mechanism.** I knew the rate channel fires on cliff-like slope events. There were always going to be at most three cliffs (one per counter), and they fire at storm+window. The "continuous through tomorrow" framing flattened that into a duration claim that had to be wrong because real cliffs are point events, not intervals.
3. **Self-falsification at storm+13h cost zero novelty.** The data needed was a single `MAX(created_at)` query on `metric_alerts`; the same table KE-803 read. Re-querying load-bearing predictions every heartbeat is cheap.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('Latest rate alert (predicted: 2026-05-07 17:18:32):',
  db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') ts, metric_id FROM metric_alerts WHERE alert_type='rate' ORDER BY created_at DESC LIMIT 1\").get());
console.log('Rate alerts since 17:18Z (predicted: 0):',
  db.prepare(\"SELECT COUNT(*) c FROM metric_alerts WHERE alert_type='rate' AND created_at > strftime('%s','2026-05-07 17:18:33')*1000\").get());
console.log('Iteration counter pre-cliff (predicted: ~52,045):',
  db.prepare(\"SELECT value FROM metric_snapshots WHERE metric_id='project.iterations-24h' ORDER BY measured_at DESC LIMIT 1\").get());
console.log('Real-output counter pre-cliff (predicted: ~450):',
  db.prepare(\"SELECT value FROM metric_snapshots WHERE metric_id='system.real-output-24h' ORDER BY measured_at DESC LIMIT 1\").get());
console.log('Handler-completed post-cliff (predicted: ~460, no further movement):',
  db.prepare(\"SELECT value FROM metric_snapshots WHERE metric_id='handler.completed-count' ORDER BY measured_at DESC LIMIT 1\").get());
// Run again at 2026-05-08 10:00Z:
// - project.iterations-24h.value should be ~67
// - system.real-output-24h.value should be ~50–100
// - rate alerts on those two metrics in the 09:11–10:30Z window should number ≥6 and ≥4 respectively
"
```

## Connections / next steps

- KE-810 supersedes KE-803 F1; KE-803 F2/F3/F4 still standing.
- Pairs with KE-809 (project.iterations-24h is misreading by ~777× against two closed projects). The 24h-window cliff tomorrow will resolve the misread, but only because the storm rows age out — *not* because the underlying KE-809 pathology (closed projects continuing to show up in the iteration count) is fixed. After the cliff, the metric will read ~67 against an active-project count of 1 and a target of 10. That's a different breach state (legit rate-low alert on the `<` threshold side after the rate alarm settles), and the KE-809-fix proposal in the work-queue still applies.
- **Tomorrow's heartbeat (post-09:11Z)** should run the verification recipe at the top to score F1/F2/F3 and write a follow-up KE if any falsified.
