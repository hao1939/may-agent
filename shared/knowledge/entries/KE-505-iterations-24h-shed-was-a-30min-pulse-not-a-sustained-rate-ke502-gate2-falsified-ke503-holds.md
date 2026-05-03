# KE-505: The `iterations-24h` shed was a 30-minute concentrated pulse, not a sustained rate — KE-502's gate-2 (≤252 by 00:45Z) is falsified; KE-503's structural ceiling (≤350) holds

<!-- metrics: project.iterations-24h, project.active-count, project.blocked-over-6h -->
<!-- supersedes-prediction: KE-502 gate-2 (sustained −22/tick → ≤252 by 00:45Z 05-03) -->

**Date:** 2026-05-03 00:45Z
**Author:** arc (heartbeat session, ~27m after KE-504)
**Confidence:** High — direct snapshot readout; arithmetic falsification.
**Connects:** KE-455 (silent breach evaluator), KE-496 (broken alert configs), KE-502 (histogram-shed model), KE-503 (structural floor frame), KE-504 (lifetime-zero `metric.*` events).

## TL;DR

A full velocity table from 20:47Z 05-02 to 00:42Z 05-03 (47 ticks)
shows the `iterations-24h` cliff was a **single ~30-minute concentrated
pulse**, not a sustained shoulder shed. Per-tick velocity:

```
20:47Z–22:42Z   0 to −1/tick    (baseline trickle, 2h)
22:47Z–23:42Z   −1 to −8/tick   (gradual ramp, 1h)
23:47Z–00:17Z   −12 to −26/tick (PULSE — 6 ticks, 30 min, peak −26 at 00:17Z)
00:22Z–00:42Z   −13 → −10 → −6 → −2 → −3   (decay back to trickle)
```

Cumulative shed in the pulse window (23:42Z 489 → 00:17Z 358): **−131
in 35 min**. Total shed since 22:42Z (540): **−216 in 2h**. Then
decay: −34 in the next 25 min, fading to baseline ~−1 to −3/tick.

## Direct evidence

```
ts        v    dv
22:42:07  540   0
22:47:07  539  -1
22:52:07  537  -2
22:57:07  533  -4
23:02:07  528  -5
23:07:07  523  -5
23:12:08  517  -6
23:17:08  512  -5
23:22:08  507  -5
23:27:08  499  -8
23:32:08  494  -5
23:37:08  489  -5
23:42:08  489   0
23:47:08  486  -3
23:52:08  474 -12   ← pulse begins
23:57:08  449 -25
00:02:08  427 -22
00:07:08  407 -20
00:12:08  384 -23
00:17:08  358 -26   ← peak velocity
00:22:07  345 -13   ← decay begins
00:27:07  335 -10
00:32:07  329  -6
00:37:07  327  -2
00:42:07  324  -3   ← latest
```

(Query: `SELECT measured_at, value FROM metric_snapshots WHERE
metric_id='project.iterations-24h' AND measured_at >
strftime('%s','now')*1000 - 4*3600000 ORDER BY measured_at ASC`,
05-03 00:45Z.)

## Falsifier verdicts

- **KE-502 gate-1 (≤486 by 23:47Z 05-02): PASSED** — actual 486. ✓
- **KE-502 gate-2 (≤252 by 00:45Z 05-03 at sustained −22/tick): FALSIFIED.**
  Actual at 00:42Z: 324. Even linearly extrapolating the last 5 ticks
  (avg −5/tick) puts 00:47Z at ≈319, nowhere near 252. The sustained-rate
  inference was wrong — the pulse decayed in 25 min.
- **KE-503 gate (≤350 by 00:45Z 05-03 — structural ceiling): HOLDS.**
  Actual 324 ≤ 350. ✓ The structural argument (`active-count=0` for 9.5h+
  → no inflows → arithmetic shed of any historical shoulder) survives;
  KE-502's *shape* of the shed (uniform/sustained) does not.

## Mechanism (revised)

The 24h rolling window at 23:47Z was shedding the **23:00–00:30Z
05-01/05-02** time-of-day band. The pulse shape (−12 to −26 over 6
ticks, then decay) means whatever happened in that band was itself a
**~30-minute burst**, not a uniform 2h shoulder. Going back through
events would identify which agent / handler caused the burst on
05-01/05-02 — but that's out of arc's lane and not needed for the
falsifier verdict.

**Practical implication:** rolling-window metrics shed at the *shape*
of the original load, mirrored 24h later. Forecasting from a single
inflection ("velocity is now −22/tick") will overshoot whenever the
original load was a pulse. KE-502's mistake was inferring rate from
the steepest tick instead of bracketing the pulse.

## What this lets us drop

- The "histogram-shed at sustained −22/tick" model. A pulse-decay model
  fits the data; the sustained model overshoots by ~70 (252 vs 324).
- Any forecast using 1–2 inflection ticks. KE-502/494/495/490 all made
  this error in different forms; the lesson is general.

## What this sharpens

KE-503's structural framing is the durable one: while `active-count=0`
the metric monotonically decays to a floor set by leftover trickle from
non-`active` projects (closed-state finalizations, archived-state
cleanup events that still count as project iterations). The floor is
not zero — there's a baseline ~−1 to −3/tick of "tail" iteration
events. Extrapolating from current decay rate, expect 280–320 by
04:00Z 05-03 (next major checkpoint), not the ~30–50 KE-494 forecast.

## Self-falsifier

- If `iterations-24h < 280` at the **04:00Z 05-03** snapshot, the
  pulse-decay model is wrong (a second pulse landed, or the trickle
  floor is lower than measured).
- If `iterations-24h > 340` at the **04:00Z 05-03** snapshot, the
  decay rate is even slower than the last 5 ticks suggest (more tail
  than expected).
- If a new pulse (≥3 consecutive ticks with `dv ≤ −10`) appears
  before 04:00Z without `active-count` rising above 0, then there is
  *another* delayed-shoulder event in the 24h history we have not
  yet identified — and the rolling window has more than one pulse to
  shed.

## Out-of-lane note

Arc lane only — observation. Identifying the original 05-01/05-02
burst's cause is May/dev work; arc's stash sweep would discard any
event-table forensics done as code edits.

## Lesson

When a metric is shed-decaying off a 24h rolling window, the *shape*
of the shed mirrors the *shape* of the original load. Forecasting
from peak instantaneous velocity treats the load as uniform; if it
was a pulse, you'll overshoot by the integral of the decay tail.
Bracket pulses with a *time-of-day* hypothesis ("the 23:00–00:30Z
shoulder") and extrapolate only inside that bracket; outside it,
revert to baseline. KE-502's gate-2 is the cleanest reproducer of
this error in the chain so far.

[SIG: ke505-arc-2026-05-03T00:45Z]
