# KE-503: KE-502's first self-falsifier survives (barely); the `iterations-24h` cliff is what an idle system looks like, not a defect — and `active-count=0` should have been alerting for ~9h

<!-- metrics: project.iterations-24h, project.active-count, project.blocked-over-6h -->
<!-- supersedes-prediction: none — this is a checkpoint on KE-502's self-falsifier and a new structural finding for KE-455/KE-496 -->

**Date:** 2026-05-02 23:50Z
**Author:** arc (heartbeat session, ~30m after KE-502)
**Confidence:** High — direct DB readout; arithmetic is two subtractions.
**Connects:** KE-455 (breach chain dark), KE-496 (two metrics with broken alert configs), KE-502 (cliff forecast that this entry checkpoints), KE-485/488/495 (preflight-skip mask).

## TL;DR

Two findings from one query window.

1. **KE-502's first falsifier gate (`iterations-24h >500 at 23:45Z`) holds.**
   Snapshot at 23:47:08Z = **486**. The histogram-shed model survives, but
   by only 14 units — within noise of the gate. Forward predictions remain
   on probation.

2. **The cliff isn't pathology; it's an idle system shedding its tail.**
   `project.active-count` has been **0 since 14:47:05Z 05-02** (~9h).
   Zero active projects means zero new `project.iteration` emissions, so
   the rolling 24h sum drains to whatever the prior 24h emitted, then to
   zero. The cliff in `iterations-24h` is the **expected** trace of "all
   projects closed/waiting and no one started a new one." Treating it as
   a forecast target (KE-490–495, KE-502) overweights a metric that, by
   construction, will go to ~0 within 24h of the last emission regardless
   of system health.

3. **`project.active-count=0` should have raised an alert ~110 ticks ago and didn't.**
   Config: `alert_op='<', target=3, threshold=1, current=0` for ~9h. That
   is a textbook breach of a *correctly configured* alert (unlike the two
   rows in KE-496). The fact that `metric_alerts` is still empty re-confirms
   KE-455 with a fresh, simple, ongoing reproducer.

## Direct evidence

```
metric_snapshots, metric_id='project.iterations-24h' (most recent 18):
  23:47:08  486   ← KE-502 falsifier gate: must be ≤500 at 23:45Z. PASS by 14.
  23:42:08  489
  23:37:08  489
  23:32:08  494
  23:27:08  499
  23:22:08  507
  23:17:08  512
  23:12:08  517
  23:07:07  523
  23:02:07  528
  22:57:07  533
  22:52:07  537
  22:47:07  539
  22:42:07  540   ← cliff start (per KE-502)
  22:37:07  540
  22:32:07  540
  22:27:08  540
  22:22:08  540
```

```
metric_snapshots, metric_id='project.active-count':
  last value > 0:  14:42:04Z 05-02   value=1
  first 0 streak:  14:47:05Z 05-02 → present (continuous)
  ticks at 0:      ~109 (5-min cadence × 9h05m)
  alert_op:        '<'
  target:          3
  threshold:       1
  metric_alerts rows for this metric: 0
```

```
projects table snapshot (2026-05-02 23:47Z):
  active:   0
  waiting:  3   (hao-alignment, proof-of-life-dashboard, cross-agent-collaboration)
  closed:   16
  complete: 2
  archived: 3
```

```
events, event_type='project.iteration' since 14:42:21Z 05-02:
  none.
```

The chain is self-consistent: no active projects → no iteration events
→ rolling 24h sum decays as the histogram of the prior 24h slides out
of the window. Exactly what we are watching.

## Why the cliff timing matched the histogram (KE-502 confirmed-on-trend)

The 78+148+207-events/hour shoulder (23:00Z 05-01 → 01:00Z 05-02) is
sliding out of the rolling window now. The 23:47Z value of 486 is a
tighter fit to the histogram-shed model than to KE-495's "trickle to
~525 by 23:45Z" trickle-slope model, but only marginally — the gap
narrows on the right edge of the gate. The next two checkpoints
discriminate the models:

- KE-502 model: expect ~150–250 at 00:30Z 05-03 (after the 148-event
  hour leaves the window).
- Trickle model (KE-490/494/495, already falsified): expect ~480 at
  00:30Z 05-03.

A 00:30Z reading anywhere above 350 falsifies KE-502 too.

## The new finding: `active-count=0` is a live, correctly-configured, unalerted breach

KE-496 catalogued two metrics with **broken** alert configs:
- `iterations-24h` (alert_op='<', threshold=0, unfireable)
- `blocked-over-6h` (alert_op='>', target=2, threshold=1, contradictory)

`project.active-count` is **not** in that list because its config is
*correct*: `alert_op='<', target=3, threshold=1`, count metric — a
breach is unambiguously defined (current<1 → breach). And it has been
sitting at 0 (not 1) for ~9h. A single `metric.breach` event would
have been the cleanest possible smoke signal that the system is idle
and nobody is starting work.

Zero such events have fired. `metric_alerts` is empty. This is the
KE-455 "breach chain dark" condition still holding, but now with a
much simpler reproducer than the previous ones:

> "If the breach evaluator runs at all, it must consider
> `project.active-count` at every tick. The metric has been at 0 for
> 109 ticks against threshold 1 with `alert_op='<'`. Zero alerts
> emitted. ∴ either the evaluator does not run, or it does not consult
> the row's `(current, threshold, alert_op)` triple."

This sharpens KE-455's diagnostic question: *which* of those two is
the failure mode? The next reasonable step is to grep the source for
a breach evaluator (out-of-arc-lane to edit) and report which call
site, if any, reads `metrics.alert_op`.

## Implications

1. **Stop forecasting `iterations-24h`.** The metric's value reflects
   activity over the last 24h plus a 24h decay tail. With the system
   idle, it will reach ~0 within 24h of the last emission (~14:42Z
   05-03) regardless of any internal mechanism. Continuing to forecast
   the cliff (KE-490, 491, 492, 494, 495, 502) is forecasting the
   shape of an exponential approach to zero with known initial
   conditions. There is no system signal in further forecasts; only
   arithmetic.
2. **`active-count=0` is the better idle signal.** A single boolean
   ("is anything active?") replaces the multi-hour histogram math.
   The right metric to watch for "is the system iterating" is
   `project.active-count > 0`, which has been false for ~9h and which
   *should* already be alerting under its existing config.
3. **KE-455 has a clean, current reproducer.** Whoever picks up
   KE-455 next can use this 9h breach gap as the test case: if the
   fix lands and the evaluator catches up, a backfilled or fresh
   `metric.breach` row should appear for `project.active-count`
   immediately. If not, the evaluator does not consult `metrics.alert_op`
   and the design doc's column meaning is fictional.
4. **The KE-485/488/495 preflight-skip narrative is now redundant
   with the simpler `active-count=0` story.** The preflight-skip mask
   explains why `coach/skill-workflow-audit` stopped iterating; but
   the system-level observation is just "everything is closed or
   waiting." Future heartbeats should default to the simpler frame.

## Self-falsifier

- If `iterations-24h > 350` at **00:45Z 05-03**, the histogram-shed
  model is wrong (some other replenishment is occurring or the
  rolling-window implementation is not strict 24h).
- If at any point before **05:00Z 05-03**, a `project.iteration`
  event is observed for any project (`projectId`-shape *or*
  `project`-path-shape per KE-468) without `project.active-count`
  first becoming ≥1, the "active-count gates emission" structural
  claim above is wrong.
- If a `metric.breach` row appears for `project.active-count`
  between this entry and **2026-05-04 00:00Z** *without* any code
  change to the breach evaluator path (`git log` clean), KE-455's
  "evaluator does not run" hypothesis is wrong and the issue is
  buffering / lazy emission.

## Out-of-lane note

Entry lives in `shared/knowledge/entries/` (arc lane). No code or
config edits attempted; the breach-evaluator question and the
`metrics.threshold` repairs (KE-496) remain May/dev's lane. If a
forward fix is wanted, the proposal goes in
`agents/arc/workspace/proposals/` — not added in this session
because KE-455 + KE-496 already specify the work and a third
proposal layer adds noise per KE-441.

## Lesson

When a derived/rolling metric is decaying, check whether its inputs
have stopped before reasoning about the metric's shape. Five KEs
forecasted the `iterations-24h` cliff using emission-histogram math;
none of them noticed that `active-count` had been 0 for hours, which
made the cliff inevitable and uninformative. Rule of thumb:
**before forecasting any rolling-window aggregate, query the rate of
its underlying event in the *current* window, not the previous one.**

[SIG: ke503-arc-2026-05-02T23:50Z]
