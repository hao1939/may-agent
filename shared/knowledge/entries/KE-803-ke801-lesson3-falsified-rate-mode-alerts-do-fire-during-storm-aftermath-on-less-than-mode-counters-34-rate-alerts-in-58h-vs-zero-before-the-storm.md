# KE-803: KE-801 lesson 3 falsified — `<`-mode counter metrics **do** alert during storm aftermath, just via a *different* alert pipeline. 34 `rate`-mode alerts have fired in 5h50m post-storm on three `<`-mode counters; zero such rate alerts existed in the entire DB before the storm.

<!-- builds-on: KE-795 (event storm), KE-774 (rate mode on rolling-window counters), KE-775 (alert_type column hardcoded threshold), KE-788/789 (rate-mode lying message), KE-801 (storm+8h falsifier audit) -->
<!-- falsifies: KE-801 lesson 3 ("`<`-mode metrics never alert on storm aftermath") -->
<!-- metrics: system.real-output-24h, handler.completed-count, project.iterations-24h -->

**Date:** 2026-05-07 18:50Z (storm+9h, KE-801+55min)
**Author:** arc
**Status:** Self-falsification of my own KE-801 lesson 3, via direct query on `metric_alerts`. The lesson was *partly* right (the `metric.breach`/`metric.recovered` event pipeline is silent on `<`-mode counter aftermath) but it generalised that to "no alerts fire," which is wrong. The `metric_alerts` table holds the falsifying evidence: a separate `rate`-mode alert pipeline has been firing continuously through the entire post-storm window, and on `<`-mode counters specifically.
**Confidence:** High (direct row counts; alert text quoted verbatim).

## What KE-801 lesson 3 said
> A `<`-mode metric never alerts on the storm itself, and never alerts on its aftermath — it just shows two value regimes (storm and real) with no visible state change.

## What the data says

`metric_alerts` partitioned by `alert_type` (entire DB):

| alert_type | rows | first seen | last seen |
|---|---|---|---|
| `threshold` | 154 | 2026-05-03 21:47:12 | 2026-05-07 17:46:01 |
| `rate` | **34** | **2026-05-07 11:28:01** | **2026-05-07 17:18:32** |

Every single `rate`-mode alert in the database started **2h17m after the storm peaked at 09:11–09:52Z**. The `rate` channel did not exist as a firing source pre-storm.

`rate`-mode rows by metric in the post-09:00Z window:

| metric_id | alert_op | rate alerts | threshold alerts |
|---|---|---|---|
| `system.real-output-24h` | `<` | **16** | 5 |
| `handler.completed-count` | `<` | **10** | 6 |
| `project.iterations-24h` | `<` | **8** | 3 |

All three are `alert_op='<'` rolling-window counters. KE-801's claim that they "never alert on aftermath" is falsified twice over for each:

1. They each emitted **threshold alerts during the storm** (because the storm pushed `current` *up* and the alert message-builder text says "below threshold" regardless of direction — KE-765/788, "rate-mode lying message" but here applied to the `threshold` row's own contradictory body when fired in the wrong direction). Sample: `id=122 ts=10:26:49 message="Handler completions (6h) is below threshold: current=86132, threshold=10, target=50"` — current is 8,613× the threshold yet the alert text claims "below."
2. They each emitted **rate alerts continuously through aftermath**, fired by negative slope as the rolling window flushed the storm rows. Sample: `id=176 ts=2026-05-07 15:34:46 metric=handler.completed-count rate=-71650.71/hour limit=2/hour current=346 target=50` — that is the storm cliff itself (the 86,271 → 346 transition KE-801 documented at 15:34Z) being detected by the rate-mode alarm at the same minute, *as a breach*. KE-801 said the cliff "produced zero alerts in the right direction"; that is wrong. It produced one rate-mode alert in the down direction (the runtime calls "below limit" because `rate < limit`, where `limit=2/hr` and `rate=-71,650/hr`).

## Why I missed it in KE-801

I queried `events` table for `metric.breach`/`metric.recovered`. That pipeline is owned by the snapshot loop and reflects threshold-mode state transitions only. I never queried `metric_alerts`, which is a *separate* table written by what appears to be a different alert engine. The two pipelines:

| signal | written to | partitioning | what fires it |
|---|---|---|---|
| `metric.breach` event | `events.event_type='metric.breach'` | per snapshot tick | threshold crossing on `current` |
| `metric.recovered` event | `events.event_type='metric.recovered'` | per snapshot tick | threshold un-crossing on `current` |
| threshold alert row | `metric_alerts.alert_type='threshold'` | de-duped state machine | threshold crossing, durable |
| **rate alert row** | **`metric_alerts.alert_type='rate'`** | **de-duped state machine** | **`(current_t - current_{t-1}) / Δt` outside `±limit`** |

KE-775 already noted the `alert_type` column is hardcoded `threshold` for every row. That's also falsified by today's data: 34 rows with `alert_type='rate'` exist, all post-storm. Either KE-775 was true at write-time and the runtime was patched, or the row was already differentiating and KE-775 misread. Worth re-checking when the runtime sleeps.

## Why this happens specifically post-storm

The `rate`-mode alarm computes `Δcurrent / Δt` between consecutive snapshots. As the storm rows age out of a 24h or 6h rolling counter, each snapshot drops by ~1 row per second sustained, so the rate is *strongly negative* for hours. The `limit=5/hr` (real-output) and `limit=2/hr` (handler-completed) configs are absurdly tight relative to a window-flush rate of -10 to -70,000/hr, so every snapshot during aftermath fires. This is the same pathology KE-774 flagged ("rate mode on rolling-window counters measures tail aging not throughput") — but I had only seen it on `>`-mode metrics until today. **The rate-mode pathology hits `<`-mode counters identically when the rolling counter has been *inflated* and is recovering downward.** The storm is the perfect generator for that condition.

## Implications for the dashboard reading

KE-801 paragraph "Practical impact: arc dashboard reading at 17:55Z" understated active alarm noise:

- `system.real-output-24h`: I called it "still contaminated, will continue dropping." I missed that this metric had **been firing rate-mode alerts every 10–30 minutes since 11:58Z** — 16 firings over 5h10m — all caused by storm contamination flushing. May has been seeing them and not connecting them to the storm.
- `handler.completed-count`: I called it "clean since 15:39Z." False — it fired 5 more rate-mode alerts after the cliff (15:24, 15:34, 15:14, 16:14, 16:49). Three of those reflect the cliff itself; two reflect ongoing flush.
- `project.iterations-24h`: I didn't list this one in the dashboard at all. It has fired 8 rate-mode alerts since 11:28Z, every one reading `rate=0.00/hour limit=1/hour current=52,0xx`. **The metric is reporting a 52,000-event 24h count and simultaneously alerting "rate below 1/hour" for not adding new events.** This is the canonical KE-774 signature on its purest example: a storm-inflated counter whose value is so far above target that any *flat* slope (zero new arrivals) trips the rate alarm even though the absolute level is 5,000× target.

## Cross-check on KE-774's "11 flap alerts in 5h"

KE-774 (2026-05-06) reported 11 rate-mode flaps on `handler.completed-count` over 5h. Today: 10 rate alerts on the same metric over 5h21m. Same regime, same metric, **but different cause**: KE-774 attributed the 11/5h cadence to "handler activity oscillating around its norm." Today the cadence is "storm-inflated counter draining." That two completely different physical causes produce the *same* alert cadence (~2/hr) on the *same* metric is itself the diagnostic signal: the rate alarm is insensitive to the underlying cause and just measures "snapshot-to-snapshot Δ outside ±limit," which a stationary process at norm and a draining storm both produce identically.

## Falsifiers for KE-803 itself

| F | claim | how to falsify |
|---|---|---|
| F1 | rate alerts will continue firing on these three metrics until the storm rows fully flush (~09:11Z tomorrow) | run the same `metric_alerts` query at 09:30Z 2026-05-08; if rate-alert cadence drops to zero before 09:11Z, the cause isn't storm-flush |
| F2 | post-flush, rate-alert cadence on these three metrics will fall to ≤1/day each | if cadence stays ≥2/hr post-09:11Z tomorrow, the alarm pathology is endogenous (KE-774 baseline) and not storm-driven |
| F3 | KE-775's "every alert is `alert_type='threshold'`" was correct at write time and got patched between then and now | if `git log` on the alert-engine source shows no diff in the relevant range, KE-775 misread the schema or a separate code path always wrote `rate` |
| F4 | the `metric.breach` event-bus pipeline did *not* emit rate-mode alerts (only `metric_alerts` rows did) | grep `events.data` for `'rate=-'` strings post-storm; if they exist, both pipelines fire and the partitioning above is wrong |

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('alert_type partition (entire DB):',
  db.prepare(\"SELECT alert_type, COUNT(*) c, MIN(datetime(created_at/1000,'unixepoch')) first, MAX(datetime(created_at/1000,'unixepoch')) last FROM metric_alerts GROUP BY alert_type\").all());
console.log('rate alerts post-09:00Z by metric (predicted: 16 / 10 / 8 on three < counters):',
  db.prepare(\"SELECT metric_id, COUNT(*) c FROM metric_alerts WHERE alert_type='rate' AND created_at > strftime('%s','2026-05-07 09:00')*1000 GROUP BY metric_id ORDER BY c DESC\").all());
console.log('cliff-detection sample (handler-completed at 15:34Z, predicted rate≈-71650/hr):',
  db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') ts, message FROM metric_alerts WHERE metric_id='handler.completed-count' AND alert_type='rate' AND created_at BETWEEN strftime('%s','2026-05-07 15:30')*1000 AND strftime('%s','2026-05-07 15:40')*1000\").all());
console.log('F4 — events table rate-mode strings (predicted: zero):',
  db.prepare(\"SELECT COUNT(*) c FROM events WHERE event_type='metric.breach' AND data LIKE '%rate=-%' AND timestamp > strftime('%s','2026-05-07 11:00')*1000\").get());"
```

## Lessons (correcting KE-801 lesson 3)

1. **Two alert pipelines, two storage substrates.** `metric.breach` / `metric.recovered` events ≠ `metric_alerts` rows. Querying one doesn't tell you what the other is doing. Cross-check both before claiming "no alerts fired."
2. **`<`-mode metrics absolutely do alert during storm aftermath — via the rate channel.** The threshold channel is silent (because the storm drives `current` *up*, away from the `<` threshold) but the rate channel fires hard (because flush is a sustained negative slope). KE-801 lesson 3 inverted only because I didn't look at `metric_alerts.alert_type='rate'`.
3. **The cliff that I described in KE-801 as "no visible state change" *did* trip the rate alarm in real time at 15:34Z.** The rate channel detected the storm-flush cliff at the same minute it happened, with a measured rate of -71,650/hr against a 2/hr limit (a 35,825× excursion). May saw this alert. May did not connect it to the storm because no agent had told her the storm caused window-flush conditions.
4. **The diagnostic signal "rate alarm fires at ~2/hr cadence on a `<`-mode counter" is now ambiguous between three causes:** (a) endogenous cadence around the norm (KE-774), (b) sustained drain of a storm-inflated counter (this KE), (c) genuine activity collapse. The alert message itself ("rate below limit") cannot distinguish them. Without a source-cause tag, may will keep dismissing them.
5. **Self-falsification cadence note for me:** I wrote KE-801 at 17:55Z with confidence "high" on lesson 3 and falsified it at 18:50Z by running a query I should have run before publishing. The query is one column join away from what I did run. **Before claiming "no X happened," enumerate the storage locations where X *could* have been written, then query all of them.** This is the same instrumentation-matrix-not-drought lesson from KE-802, applied to alerting instead of trace-completeness.
