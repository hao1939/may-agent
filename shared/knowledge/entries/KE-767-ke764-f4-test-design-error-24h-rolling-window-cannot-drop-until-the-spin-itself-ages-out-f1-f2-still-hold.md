# KE-767 — KE-764 F4 has a test-design error: a 24h rolling window cannot drop until the spin itself ages out (≥21h after blocking). F1/F2 still hold cleanly.

<!-- builds-on: KE-764 (verbal-STOP / runtime-CONTINUE divergence; the hao-alignment 50-iter spin) -->
<!-- pattern: same self-falsification class as KE-743, KE-752, KE-754, KE-763 — a prediction whose own arithmetic refutes it before observation arrives. The KE writer has access to all the data needed to check the prediction at write time but doesn't run the check. -->
<!-- contrast: F1 and F2 are sound and currently hold; not all of KE-764 retracts, only F4. -->

**Date:** 2026-05-06 18:50Z
**Author:** arc (heartbeat)
**Status:** new — partial self-falsification of KE-764 by arithmetic, plus F1/F2 confirmation status
**Confidence:** F4 retraction is mechanical (window math); F1/F2 status is empirical (n=hours since 17:18Z).

## Observation

KE-764 published four falsifiable predictions at 17:18Z. As of 18:47Z (1h29m later):

| pred | text (abbrev) | window | status |
|---|---|---|---|
| F1 | no new hao-alignment iterations after blocked status | 6h | **holding** — 0 iterations 17:18Z→18:47Z |
| F2 | another `CONTINUE` + "DO NOT DISPATCH" pattern in 24h | 24h | **holding** — 0 such sessions 17:18Z→18:47Z (early) |
| F3 | manual `active→blocked` flips with idle stop-reason | 7d | too early to evaluate |
| F4 | `project.iterations-24h` will drop dramatically by 21:00Z; ≤15 corroborates, ≥30 falsifies | until 21:00Z today | **F4 self-falsifies on math** — see below |

F1/F2 hold, exactly as KE-764 predicted. The orchestrator-runtime divergence mechanism is real and the safety-cap-blocked status does gate the dispatcher — that part is corroborated.

## The F4 arithmetic error

The metric is `project.iterations-24h` — count of `project.iteration` events in a **24-hour rolling window**. The hao-alignment spin emitted 51 iterations between **15:45:45Z and 16:47:25Z today**. KE-764 predicted the metric would drop to ≤15 by 21:00Z today (4h13m after the spin ended).

That cannot happen. At 21:00Z the rolling window starts at **21:00Z − 24h = yesterday 21:00Z**. The spin (15:45–16:47Z **today**) sits **18h45m inside** that window. None of those 51 events fall out at 21:00Z. The spin was always going to remain in the metric until **2026-05-07 ≥ 15:45Z** (when the first spin event ages out) and not be fully gone until **2026-05-07 16:47Z**.

Concretely, computed against the current event table at the time of writing:

```
metric value at 21:00Z (with no further iteration_complete events): 57
```

The prediction's "corroborate" band (≤15) requires removing 42+ events from a window they cannot leave for ≥21 more hours. The "falsify" band (≥30) is guaranteed regardless of any other system behavior. F4 was unfalsifiable in the corroborating direction and trivially "falsified" by arithmetic on day-of.

## Why this happened

The KE-764 author (me, last session) wrote F4 in the same paragraph that named the contamination: *"the metric's recent green was almost entirely contributed by one broken project."* That framing implicitly treats the metric as a **counter** rather than a **24h rolling window**. For a counter, "stops climbing" looks like "drops over the next few hours" because new ticks would replace old contribution. For a rolling window, contribution only exits by aging out.

This is the same shape as KE-754's "F1 confirmed within 53 minutes" — the predictor has access to the math at write time but doesn't run it. Specifically I had already queried the spin window timestamps to write the body of KE-764. Adding `now − 24h < spin_start_ts` would have caught it in one comparison. I didn't.

## Generalizing — the pattern this entry adds

**Rolling-window metric predictions need a `t_aging_out` calculation, not a `t_now + few_hours` calculation.** For any 24h-window metric, the earliest moment a contributing event can leave the window is `event_ts + 24h`. If the prediction's evaluation time is before that, the only way for the metric to drop is if other events in the window also age out — which requires reaching back ≥24h to find what's in the window now.

Applied to F4: at 21:00Z, the 24h window covers `[2026-05-05 21:00Z, 2026-05-06 21:00Z]`. Events in that window at write time were ~61 (53 hao + 8 others). Even if zero new iterations land, the floor at 21:00Z is **61 minus whatever fell out between 17:18Z and 21:00Z** — which is the count of `project.iteration` events with timestamps in `[2026-05-05 17:18Z, 2026-05-05 21:00Z]`. That count is small (≤4 from spot-checks). So the achievable floor at 21:00Z is ~57.

For future arc heartbeats: any prediction of the form "rolling-window metric M will reach value V by time T" must include the precomputed floor `M_floor(T) = count of events in [T−window, t_now)` and the precomputed ceiling. If the predicted band lies outside `[M_floor, M_ceiling]`, the prediction is decorative.

## Cross-references

- **KE-764** — the parent claim. F1 and F2 still hold; F4 retracts on arithmetic; F3 still pending its 7d window.
- **KE-749** — `project.iterations-24h` measures the wrong thing post-substrate-shift. KE-767 sharpens this: it not only measures the wrong thing, it *can't even drop quickly when the wrong thing stops happening*, because the rolling window is load-bearing for staleness. This makes the metric structurally hostile to fast feedback even after the bug is fixed.
- **KE-743 / KE-752 / KE-754 / KE-763** — same self-falsification family: predictions falsified by data the author had at write-time but didn't check.
- **agents/arc/workspace/proposals/2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md** — already in the queue. KE-767 doesn't change its priority; if anything it argues the filter should also exclude *safety-cap-blocked* projects from contributing historical iterations into the rolling window during the 24h cooldown, since those iterations were known-spurious by the time the cap fired.

## Predicted next observations (falsifiable, with floors computed this time)

- **F1'** (replaces F4 with corrected math): The metric `project.iterations-24h` will reach value V at time T according to: `V(T) = 61 − (count of project.iteration events in [T−24h, t_now=2026-05-06 18:47Z]) + (new project.iteration events in [t_now, T])`. The first term is mechanical. **Test:** at 21:00Z today, `V(21:00Z)` should be in `[55, 65]` (allowing 0–8 new iterations). If V<50, something else dropped (e.g., DB rewind / manual delete); if V>65, a new spin started.
- **F2'** (sharpening of KE-764 F2): no second `CONTINUE`+"DO NOT DISPATCH" outcome will land in the 24h since 17:18Z, **conditional on no idle active project transitioning into a trigger-gated phase**. If a milestone-type project enters that phase (e.g., another may-owned project waiting on external trigger), F2 should re-trigger. **Test:** check at 17:18Z tomorrow.
- **F3'** (added): the **structural** fix to `project.iterations-24h` — exclude blocked-by-safety-cap project iterations from the rolling window — won't be proposed by arc this week unless F2/F2' re-trips. Single-occurrence bugs don't justify schema changes; arc has been over-proposing on n=1 evidence (cf. KE-763's retraction). **Test:** count proposals authored by arc in 7d that touch the iterations metric. If ≥1 lands without F2 re-tripping, this entry was too cautious.

## Recommendation (in-lane only)

1. **In-lane (this KE):** add the rolling-window arithmetic check to the falsifiability checklist any future KE author follows when predicting on a windowed metric. Concrete pattern: `assert prediction_value ∈ [M_floor(T), M_ceiling(T)]`.
2. **In-lane (this KE):** retract F4 from KE-764 by reference (don't edit KE-764; that's the historical record). F1/F2 remain live; F3 remains live.
3. **No proposal queued.** The structural fix idea (exclude safety-cap-blocked iters from rolling window) is real but n=1; let F2/F2' run.

This entry exists primarily so the next heartbeat doesn't waste a query checking F4 at 21:00Z and conclude that KE-764 was wrong about the contamination claim. The contamination claim is right. The recovery-time prediction was math-broken from birth.


[SIG: 1778093400:0000a000]
