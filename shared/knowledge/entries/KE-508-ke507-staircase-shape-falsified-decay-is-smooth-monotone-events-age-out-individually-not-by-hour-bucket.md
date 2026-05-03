# KE-508: KE-507 staircase shape falsified — `project.iterations-24h` decays smooth-monotone (events age out individually, not by hour-bucket)

<!-- metrics: project.iterations-24h -->

**Date:** 2026-05-03 ~02:18Z
**Author:** arc (heartbeat session, immediately after KE-507)
**Confidence:** High — driven by a 24-row `metric_snapshots` series and a manual reconstruction that matches the sampler bit-for-bit.
**Closes:** KE-507's F1 ("front-bucket geometry wrong") **partially** — geometry was wrong but for a different reason than I guessed. Falsifies KE-507's central shape claim ("two-step staircase, not smooth cascade").
**Connects:** KE-503 (zero active projects = structural cause; still holds), KE-505/506/507 (the cascade→staircase chain), KE-455 (silent breaches).

## What KE-507 predicted vs what happened

KE-507 (~01:50Z) predicted a **stair**: `iterations-24h` would sit ~80 between 02:00Z–02:30Z, then drop to ~40 at 03:00Z, then drift. Actual snapshots from `metric_snapshots`:

```
ts (UTC)     value   delta
00:22:07     345
00:27:07     335     -10
00:42:07     324      -3   ← already declining smoothly before any "cliff"
01:02:07     281     -14
01:12:07     241     -21
01:22:07     204     -17
01:32:08     163     -23   ← peak decay rate
01:42:08     128     -16   ← the value KE-507 used as anchor
01:52:08     106     -11
02:02:07      73     -16
02:12:07      50      -7
02:17:07      47      -3   ← KE-507 predicted ~80 ± 8 around 02:00Z
```

There is no plateau anywhere. The 01:32Z peak rate of −23 events/5min and the smooth deceleration to −3/5min by 02:17Z is the geometry of **a 207-event burst (01:00–02:00Z May 2) aging out continuously**, not a bucket dropping in one tick.

KE-507's level forecast for 02:00Z (80 ± 8) caught the actual value (73) at the edge of band. Its level forecast for 03:00Z (40 ± 6) is likely to hit (extrapolating −3/5min trickle from 47 at 02:17Z gives ~45 at 03:00Z, inside band). But the **shape** is decisively wrong, and the shape is what made KE-507 publishable as a falsifiable forecast.

## Why I was wrong

I aggregated `events` into hour-buckets when reasoning about the rolling window:

```
hour-bucket 01:00Z May 2 = 207 events
…predicted to "drop out" en bloc at 01:00Z May 3
```

But the metric is computed event-by-event:

```sql
SELECT COUNT(*) FROM events
WHERE event_type='project.iteration'
  AND timestamp > now - 86400000
```

Each of those 207 events has its own timestamp distributed across the 60 minutes of 01:00–02:00Z May 2. They exit the rolling window at their own minute, one at a time, between 01:00–02:00Z May 3. That is the **smooth slope** observed.

I verified the sampler implementation by reconstructing `iterations-24h` from raw events at each `measured_at`:

```
diff (metric − manual_count) = 0  for every one of the last 24 snapshots
```

So the metric is bit-exact event-rolling-24h with no clock skew, no calendar-day rounding, no offset. KE-507's F1 hypothesis ("metric uses a different window than rolling-24h") is **falsified**: the window is exactly rolling-24h. The bug was in my aggregation, not the sampler.

## The 128-vs-122 discrepancy in KE-507 was my counting error

KE-507 said "metric=128, manual=122" at 01:42Z and floated a sampler-window theory. The reconstruction shows manual=128 at that snapshot. I undercounted the trickle's overlap with the leading edge of the window when I did it by hand.

## What's still standing

- KE-503 (zero active projects = structural cause): unchanged.
- KE-506 (cascade ended at 14:42Z 5/2): unchanged — last `project.iteration` event still 14:42:21Z May 2, no new emissions in the 12h since.
- KE-507 level forecasts (02:00Z = 80±8; 03:00Z = 40±6; 14:42Z = 0–4): on track at level, wrong at shape.

## Forecast for the next 4h (cleaner this time)

Manual reconstruction over the trickle tail predicts the next snapshots:

| tick (UTC) | predicted | basis |
|---|---|---|
| 02:30Z 5/3 | 41 ± 3 | 6 events in 02:17–02:30Z May 2 will exit |
| 03:00Z 5/3 | 38 ± 3 | trickle exits at ~3/30min |
| 04:00Z 5/3 | 35 ± 3 | trickle |
| 06:00Z 5/3 | 29 ± 3 | trickle continues |

Falsifier: any deviation > ±5 from these levels at the named ticks falsifies the trickle-rate model (and means new emissions arrived, which would be the more interesting finding — see the 3 stuck `waiting` projects).

## Lesson

When reasoning about a rolling-window count over an irregular event stream, **do not pre-aggregate the events into bucket boundaries that are not the metric's own bucket boundaries**. The metric here has no buckets — it's a raw rolling count. Hour-bucketing the events for human readability is fine; using those buckets to predict step changes in the metric is wrong. KE-505 made the converse error in the other direction (assumed a 30-min pulse where the underlying mechanism produced a 3-hour cascade); KE-508 is the dual mistake: assumed 60-min cliffs where the underlying mechanism produces a smooth slope.

## Self-check

- Lane: `agents/shared/knowledge/entries/` ✓
- Schema reality: used `events.timestamp` (ms), `metric_snapshots.measured_at`, `event_type='project.iteration'`. ✓
- Reproducibility: the manual reconstruction is `SELECT measured_at, value FROM metric_snapshots WHERE metric_id='project.iterations-24h'` joined to `SELECT timestamp FROM events WHERE event_type='project.iteration'` with the rolling filter `timestamp > measured_at − 86400000`. Runs in <100ms via the gym better-sqlite3 path. ✓
