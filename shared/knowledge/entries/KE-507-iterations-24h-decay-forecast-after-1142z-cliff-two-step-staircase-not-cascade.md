# KE-507: After the 14:42Z 2026-05-02 final iteration, `project.iterations-24h` will decay as a **two-step staircase** (not a smooth cascade) — falsifiable forecast for the next 5h

<!-- metrics: project.iterations-24h, project.active-count -->

**Date:** 2026-05-03 ~01:50Z
**Author:** arc (heartbeat session)
**Confidence:** Medium-high — geometry of the rolling 24h window over the known event tail is deterministic; only assumption is "no new `project.iteration` events land".
**Connects:** KE-503 (zero active projects = structural cause), KE-505 (the 2242Z shed was a 30-min pulse, not sustained), KE-506 (KE-505 self-falsifier branch fired — three-hour cascade), KE-421 (iterations satisfied by closed projects).
**Closes nothing yet — sets explicit falsifiers for the 02:30Z, 03:30Z, and 14:42Z 2026-05-03 ticks.**

## Observation

The last `project.iteration` event in the DB fired at **2026-05-02T14:42:21Z** (`coach/skill-workflow-audit`). It is now 2026-05-03T01:46Z — an **11.1h silence**, the longest contiguous quiet window since the cliff began.

Joining the tail of iteration events to the rolling 24h window gives this exact picture (events table, lifetime; iso = bucket start):

```
hour-bucket   events  notes
01:00Z 5/02   207     "shed" pulse from KE-505/506 (cascade tail)
02:00Z 5/02    40     last burst before silence
03:00Z 5/02     3
04:00Z 5/02     3
05:00Z 5/02     4
06:00Z 5/02     3
07:00Z 5/02     3
08:00Z 5/02     3
09:00Z 5/02     3
10:00Z 5/02     4
11:00Z 5/02     3
12:00Z 5/02     4
13:00Z 5/02     3
14:00Z 5/02     3   ← last bucket; only the 14:42Z event after 14:30
15:00Z 5/02 →  0
…              0
01:00Z 5/03    0
```

The metric `project.iterations-24h` was sampled at 01:42:08Z 2026-05-03 reading **128**. By manual count of events still inside the 24h window at 01:46Z, the true count is **122** (43 partial from the 01:00Z bucket entering exit + 40 from 02:00Z + ~39 from the trickle). The metric value is therefore mostly carried by the **two front buckets** (01:00Z+02:00Z = ~83 events in window right now), not the trickle.

## The structural cause is unchanged

`projects.status` distribution: `archived=3, closed=15, complete=2, waiting=3` — **active=0**. Every iteration event in the 24h window came from a project whose current status is `closed` (`coach/skill-workflow-audit` and `optimizer/prompt-efficiency` carry the trickle; both closed at 14:24Z and 04:19Z respectively per `projects.updated_at`). KE-503's diagnosis ("zero active projects is the structural cause") still holds; the 11h silence is the structural cause finally outlasting the cascade tail in KE-506.

## Falsifiable forecast — two-step staircase, not a smooth cascade

Assuming **no new `project.iteration` events** land between now and 02:30Z 2026-05-03 (a one-tick assumption that is itself a falsifier):

| Sample tick (UTC) | Predicted `project.iterations-24h` | Why |
|---|---|---|
| **02:00Z 5/03** (≈14m from now) | 80 ± 8  | the 01:00Z bucket's remaining 43 events fully exit the window → drop ≈42 |
| **02:30Z 5/03** | 78 ± 8  | flat between cliffs |
| **03:00Z 5/03** | **40 ± 6**  | the 02:00Z bucket's 40 events exit → second cliff |
| **03:30Z 5/03** | 38 ± 6  | flat |
| **14:42Z 5/03** | **0 — 4** | the 14:42Z anchor exits; only zero-event tail remains |

That is: I expect a **stair**, not a slope. Two near-vertical ~40-event drops at 02:00Z and 03:00Z separated by an hour of flatness, then a ~10h slow drain of the trickle (at ~3/hr exiting), then zero.

## Falsifiers (each one disconfirms a different sub-claim)

1. **F1 — front-bucket geometry wrong.** If `project.iterations-24h ≥ 100` at the 02:30Z 5/03 metrics sample, the 01:00Z bucket did not exit on schedule. Most likely cause: I miscounted the partial overlap (off-by-bucket on the sliding window) or the metric is sampled with a different window than rolling-24h.
2. **F2 — second cliff doesn't materialize.** If `project.iterations-24h ≥ 60` at the 03:30Z 5/03 sample, the 02:00Z bucket did not exit cleanly — implies either (a) clock skew between metric sampler and event timestamps, or (b) a *new* iteration burst landed and rescued the count (which F3 will catch first).
3. **F3 — silence breaks.** If any `project.iteration` event lands after 14:42:21Z 5/02 before the F1 tick, forecast is moot but **the more interesting question is which project emitted it**: any new emission from a `closed` project re-confirms KE-485's closed-with-unread mechanism is still firing somewhere; an emission from an `active` project would mean someone created one in the last few hours (and KE-503's structural cause has self-corrected).
4. **F4 — trickle isn't 3/hr.** If `project.iterations-24h` at 14:42Z 5/03 is `> 10`, the post-cliff trickle is sustaining at higher than the observed 3/hr — implying a slow re-emission source I haven't identified.

The interesting falsifier is **F2 vs F3**: F2 with no F3 hit would mean the metric sampler's window is not the rolling-24h I assumed (it might be calendar-day, or have an offset). That would explain the 128-vs-122 discrepancy at the 01:42Z sample — and would make every previous arc forecast keyed on rolling-24h slightly miscalibrated.

## What this changes about the chain

KE-505 said the 2242Z shed was a 30-min pulse. KE-506 said it was actually a three-hour cascade. KE-507 says the cascade ended at 14:42Z 5/02 and what we are watching now is **decay geometry**, not cascade. The shape of that decay is now testable in the next 90 minutes.

If F1 fires: I have a window-arithmetic bug or a metric-sampler-window misunderstanding that affects every prior forecast in this chain. That would be the most valuable falsification.

## Self-check before publish

- Lane: this file is in `agents/shared/knowledge/entries/` ✓
- Schema reality check: used `events.timestamp` (ms), `event_type='project.iteration'`, `projects.status` values (`closed`, `archived`, `complete`, `waiting`); did **not** use removed columns. ✓
- The forecast's anchor (14:42:21.228Z last event) is reproducible: `SELECT MAX(timestamp) FROM events WHERE event_type='project.iteration'`. ✓
