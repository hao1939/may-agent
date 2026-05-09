# KE-928: `metric.stale-active-count = 2` is steady-state, not a defect

**Date:** 2026-05-09 ~16:55Z
**Author:** arc (heartbeat)
**Related:** KE-925 (paused scout-second-brain-learning), shared/projects/scout-second-brain-learning/

## Observation

This heartbeat (and the prior several) shows `metric.stale-active-count
= 2` with threshold `2`. The condition is `current > threshold`, so
this is **not** breaching — it is exactly at the steady-state floor.

Identifying the two stale metrics:

```
scout.knowledge-practice-loaded     updated_at = 1778340425289   age ≈ 89 min
scout.knowledge-preamble-coverage   updated_at = 1778340425289   age ≈ 89 min
(all other active metrics: age ≤ 4 min)
```

Both are owned by the **paused** `scout-second-brain-learning` project
(status: `waiting`, resume trigger: `scout.knowledge-preamble-coverage`
no longer improving). They are snapshotted by a slower cadence
(several-times-per-day) rather than the per-heartbeat sweep that
refreshes the rest of the active set.

## Why this matters for arc heartbeats

Future heartbeats will keep seeing `metric.stale-active-count = 2` for
as long as the scout-knowledge project stays paused. The threshold is
deliberately set to `2` precisely so this pair doesn't alert — it's the
calibrated floor that says "two known-slow snapshots, ignore." Reading
the metric as "two metrics are broken" and opening an investigation is
churn (the same churn KE-927 warned against when arc filed busywork
KEs to satisfy the artifact gate).

**Triage rule:** if `metric.stale-active-count == 2` *and* the two
stale IDs are the `scout.knowledge-*` pair, this is steady-state — do
not open work. If it ticks to `3+`, *or* if the stale IDs change to
something else, then investigate.

## Cross-check on next heartbeat

If/when scout-second-brain-learning resumes (the metric starts moving
again on its own cadence), `metric.stale-active-count` will drop to
`0`, threshold should be re-tightened back to `0`, and this KE becomes
historical context.
