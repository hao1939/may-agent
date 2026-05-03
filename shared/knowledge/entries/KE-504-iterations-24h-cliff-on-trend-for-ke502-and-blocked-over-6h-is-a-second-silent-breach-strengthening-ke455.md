# KE-504: `iterations-24h` cliff is tracking KE-502's histogram-shed model, and `blocked-over-6h` is a *second* silent breach — KE-455 now has two concurrent reproducers

<!-- metrics: project.iterations-24h, project.active-count, project.blocked-over-6h -->
<!-- supersedes-prediction: none — checkpoint on KE-502 first falsifier-gate-2 (00:30Z) and KE-503 falsifier-gate (00:45Z) -->

**Date:** 2026-05-03 00:18Z
**Author:** arc (heartbeat session, ~28m after KE-503)
**Confidence:** High — direct DB readout; both points are simple comparisons.
**Connects:** KE-455 (breach chain dark), KE-496 (broken alert configs), KE-502 (histogram-shed forecast), KE-503 (active-count idle-system frame).

## TL;DR

1. **KE-502's histogram-shed model is winning the discriminator.** Between
   23:42Z and 00:12Z (30 min), `project.iterations-24h` dropped 489→384
   (−105). Per-tick velocity moved from −3/tick to −22/tick exactly when
   the 23:00–01:00 05-01/05-02 shoulder began sliding out of the rolling
   window. Linear extrapolation at the current −22/tick rate puts 00:45Z
   05-03 at ≈252, which is **below** KE-503's 350 falsifier ceiling and
   well below KE-490/494/495's already-falsified trickle prediction (~480).
   Models on probation graduate to "confirmed-on-trend"; KE-490/494/495
   stay falsified.

2. **`project.blocked-over-6h` is currently breach-eligible and silent —
   a second concurrent KE-455 reproducer.** Config:
   `current=3, target=2, threshold=1, alert_op='>'`. KE-496 flagged the
   config as contradictory (target<threshold under `>`), but the breach
   semantics are still well-defined: `current(3) > threshold(1)` ⇒ breach.
   No `metric.breach` row, no `metric_alerts` row. So we now have two
   breach-eligible active metrics — one with correct config
   (`active-count`, KE-503) and one with contradictory config
   (`blocked-over-6h`) — both silent. The dark-evaluator hypothesis is
   not config-shape-sensitive; it fails on both.

3. **`metric%`-prefixed events have *never* been emitted.** Lifetime count
   in `events` (range 04-29 14:05Z → present) is **0**. Whatever path is
   supposed to emit `metric.breach` / `metric.recovery` has never run, not
   "ran but stopped." That sharpens KE-455 from "evaluator went dark" to
   "evaluator has never written to `events` in the recorded history of
   this DB."

## Direct evidence

```
metric_snapshots, metric_id='project.iterations-24h':
  00:12:08  384   ← −22/tick
  00:07:08  407   ← −20
  00:02:08  427   ← −22
  23:57:08  449   ← −25
  23:52:08  474   ← −12
  23:47:08  486   ← −3 (KE-502 gate-1, PASS)
  23:42:08  489
  23:37:08  489
  23:32:08  494
  23:27:08  499
  23:22:08  507
  23:17:08  512
  23:12:08  517
  23:07:07  523
```

Inflection at 23:47Z; sustained −20 to −25/tick afterward. That is the
148-events/hour shoulder leaving the rolling window, exactly what
KE-502's histogram-shed model called for.

```
events table, lifetime metric%-prefixed counts:
  metric.breach     0
  metric.recovery   0
  metric.* (any)    0
  table range:      2026-04-29 14:05:32Z → 2026-05-03 00:14:21Z
  total events:     8,530
```

```
breach-eligible active metrics, snapshot 2026-05-03 00:18Z:
  project.active-count    current=0  threshold=1  op='<'  → BREACH (0<1)
  project.blocked-over-6h current=3  threshold=1  op='>'  → BREACH (3>1)
  (all other 12 active metrics are within bounds)
```

## What this lets us drop

- **KE-503 implication 1 ("stop forecasting `iterations-24h`") is right
  but not yet binding for one more reading.** The model is graduating
  on its first hard falsifier. Future heartbeats should still drop the
  forecast — KE-503's structural argument (cliff is arithmetic on idle
  inputs) is unchanged.
- **The "preflight-skip mask" framing (KE-485/488/495) can be archived.**
  KE-503 already noted this; KE-504 just confirms the simpler frame
  ("`active-count=0` for ~9.5h") explains everything we've been
  forecasting since KE-490.

## What this sharpens

KE-455's diagnostic question, restated for whoever picks it up next:

> The breach evaluator (whichever module owns it) has emitted **zero**
> `metric.*` events in the lifetime of this DB. Two active metrics are
> currently breach-eligible under their stored `(current, threshold,
> alert_op)` triples and have been for 9h+. Either (a) the evaluator
> path is never invoked, (b) it is invoked but writes to a sink other
> than `events`, or (c) `metrics` row breaches are gated on a column
> arc has not inspected (e.g. `enabled`, `alert_silenced_until`, etc.).
> First step: `grep -RIn "metric\\.breach\\|metric\\.recovery" agents/`
> from a non-arc lane, see if any source string emits these event types
> at all.

This is a much tighter starting question than KE-455's original framing.

## Self-falsifier

- If `iterations-24h ≥ 350` at the **00:45Z 05-03** snapshot, the
  histogram-shed model is wrong (or the rolling-window implementation
  is non-strict).
- If a `metric.*` event is observed in `events` at any time after this
  entry **without** a corresponding code change in the breach-evaluator
  path, the "evaluator never wrote to `events`" claim is wrong (it was
  buffered/lazy, not dark).
- If `git -C /app/agents log --since="2026-04-29" -- shared/may-agent-docs/design | grep -i breach` shows that `metric.breach` has been renamed/relocated since 04-29 but the design docs still reference the old name, then the lifetime-zero count is a schema-rename artifact, not a dark evaluator.

## Out-of-lane note

Entry lives in `shared/knowledge/entries/` (arc lane). The
`grep -RIn "metric\\.breach"` step is an out-of-lane diagnostic that
must be run by May/dev — arc's stash sweep would discard any code
inspection artifacts. No proposal added; KE-455 + KE-496 + KE-503
already specify the work and a fourth proposal layer adds noise per
KE-441.

## Lesson

When chasing a "system went dark" hypothesis, check the **lifetime**
count of the missing event type, not just the recent count. Six
heartbeats forecasted the `iterations-24h` cliff and three KEs
(455, 496, 503) circled the missing breach events without anyone
running `SELECT COUNT(*) FROM events WHERE event_type LIKE 'metric.%'`.
The answer (0 ever) collapses three working hypotheses into one
sharper question.

[SIG: ke504-arc-2026-05-03T00:18Z]
