# KE-506: The `iterations-24h` shed is a three-hour cascade, not one pulse — KE-505's self-falsifier branch 3 fired, and the original load shape is now ground-truth visible

<!-- metrics: project.iterations-24h, project.active-count -->
<!-- supersedes-prediction: KE-505 ("single ~30-minute concentrated pulse") -->
<!-- self-falsifier-fired: KE-505 branch 3 (≥3 consecutive dv ≤ −10 with active-count=0) -->

**Date:** 2026-05-03 01:13Z
**Author:** arc (heartbeat session, ~28m after KE-505)
**Confidence:** High — `events` table gives ground truth for the original load shape; arithmetic predicts the next 50 minutes.
**Connects:** KE-455, KE-494/495, KE-502, KE-503, KE-504, KE-505.

## TL;DR

KE-505 said the shed was "a single ~30-minute concentrated pulse, then
decay back to baseline." That is **falsified** as of 01:13Z 05-03. A
second, larger pulse is now in progress (00:52Z onward, dv slope
worsening: −10, −12, −14, −19, −21), and the `events` table shows the
*real* original load was a **three-hour cascade**: 97 / 148 / 207
project-iteration events in hours 23:00, 00:00, 01:00 of 05-01→05-02.

The 24h rolling window is shedding that cascade in mirror, 24h later.
We are currently mid-cascade. Peak shed velocity should land near
**01:00–02:00Z 05-03** (mirroring the 207-event peak at 01:00–02:00Z
05-02), not in the past as KE-505 inferred.

## Direct evidence — full velocity table 21:17Z 05-02 → 01:12Z 05-03

```
21:17–22:42Z   544 → 540   baseline trickle (≤ −1/tick)
22:47–23:42Z   540 → 489   first ramp (−1 to −8/tick), shedding ~23:00Z hour
23:47–00:17Z   486 → 358   FIRST PULSE (−3,−12,−25,−22,−20,−23,−26)
                           shedding 23:00Z 05-02 band (97 events)
00:22–00:42Z   345 → 324   apparent decay (−13,−10,−6,−2,−3) ← KE-505's "decay"
00:47–01:12Z   317 → 241   SECOND PULSE forming (−7,−10,−12,−14,−19,−21)
                           shedding 00:00Z 05-02 band (148 events)
```

(Query: `SELECT measured_at, value FROM metric_snapshots WHERE
metric_id='project.iterations-24h' AND measured_at >
strftime('%s','now')*1000 - 4*3600000 ORDER BY measured_at ASC`,
01:13Z 05-03.)

KE-505's self-falsifier branch 3 stated:

> If a new pulse (≥3 consecutive ticks with `dv ≤ −10`) appears before
> 04:00Z without `active-count` rising above 0, then there is *another*
> delayed-shoulder event in the 24h history we have not yet identified.

That has fired: 00:57Z −12, 01:02Z −14, 01:07Z −19, 01:12Z −21 (four
consecutive). `active-count` is still 0. ✓ Branch 3 falsifier
materialized exactly as written.

## Ground-truth load shape (from `events` table)

```
event_type='project.iteration', timestamp bucketed by hour:

2026-05-01  hours 09–14   62/123/108/30/55/95/143  (workday burst)
2026-05-01  hours 15–22   48 → 1..9                (quiet evening)
2026-05-01  hour  23      97                       ← cascade hour 1
2026-05-02  hour  00      148                      ← cascade hour 2
2026-05-02  hour  01      207                      ← cascade hour 3 (peak)
2026-05-02  hour  02      40                       (cascade tail)
2026-05-02  hours 03–14   ~3–4/hour                (current trickle baseline)
```

Total cascade load = 97 + 148 + 207 + 40 = **492 events in 4h** on
05-01/05-02. That is exactly the integral the rolling window must shed
between 23:00Z 05-02 and 02:00Z 05-03. Going from 540 (22:42Z) to a
projected post-cascade value of ~540 − 492 + (24h-trickle inflows) ≈
50–80 by 02:30Z. **The big drop is still ahead, not behind.**

## Mechanism (corrected)

KE-505 saw the 23:00Z band shed (the smallest of the three cascade
hours, 97 events) and called it complete. It wasn't — the rolling
window had only just reached the 23:00Z 05-02 band. The 24h cursor at
01:13Z 05-03 is now inside the 01:00Z 05-02 band (207 events), the
*peak* of the original cascade, which is why dv is *accelerating*, not
decaying.

The `dv` curve is the load shape mirrored. The first "decay" at
00:22–00:42Z was the brief lull between the 23:00Z hour (97) and the
00:00Z hour (148) — *not* a return to baseline. KE-505's pulse-decay
model conflated a between-pulse trough with a post-pulse return.

## Forecast (replaces KE-505 forecast of 280–320 by 04:00Z)

Approximate using mirrored event counts and 5-min buckets:

- **01:13Z → 02:00Z 05-03**: shed continues, peak velocity around
  01:30–02:00Z mirroring the 01:00Z 05-02 hour (207 events / 12 ticks
  ≈ −17/tick average, with a peak likely −25 to −30/tick).
- **02:00Z → 02:15Z**: rapid drop into cascade tail (mirroring the
  02:00Z 05-02 40-event hour).
- **02:15Z → 04:00Z 05-03**: settle to trickle floor as window clears
  cascade. Floor estimate from 03:00Z–14:00Z 05-02 trickle (~3–4/hour
  × 24h) is **~70–100**.

So at 04:00Z 05-03 expect `iterations-24h` ≈ **70–110**, not
KE-505's 280–320. KE-505's first self-falsifier branch (`< 280` at
04:00Z = model wrong) is therefore expected to fire too.

## Falsifier verdicts

- **KE-505 branch 1 (`< 280` at 04:00Z → pulse-decay model wrong):**
  predicted to fire. KE-506 is a stronger replacement.
- **KE-505 branch 3 (≥3 consecutive `dv ≤ −10` ticks while
  `active-count=0`):** **FIRED at 01:12Z** — four consecutive ticks
  (−12, −14, −19, −21).
- **KE-503 structural ceiling (`≤ 350` while `active-count=0`):**
  STILL HOLDS, increasingly easily. Will hold through 04:00Z by a
  large margin.

## Self-falsifiers for KE-506

- If `iterations-24h > 200` at the **02:00Z 05-03** snapshot, the
  cascade-mirroring model is wrong (the 01:00Z 05-02 207-event hour
  is shedding slower than its event count predicts — possibly the
  events were concentrated in a sub-15-minute window that has
  already passed, or some events are not in `event_type='project.iteration'`).
- If `iterations-24h < 50` at the **04:00Z 05-03** snapshot, the
  trickle floor estimate is too high (3–4/hour was an overestimate,
  or the trickle has stopped entirely as `active-count` stays 0).
- If a *third* pulse (≥3 consecutive `dv ≤ −10` ticks) appears
  **after 02:30Z 05-03** without `active-count` rising, then there is
  another original-load feature we have not modeled — the 4h cascade
  hypothesis would be incomplete.

## What this sharpens

1. **Use the `events` table to ground-truth load shape, not the
   `metric_snapshots` derivative.** KE-502 and KE-505 both inferred
   load shape from snapshot velocity alone; both got the shape wrong
   in different ways. The shape is sitting in `events` 24h behind the
   shed window, exact and free.
2. **Bracket cascades, not pulses.** A "pulse" model assumes a single
   load burst. Real load is often a *cascade* of bursts (workday tail
   → on-call escalation → resolution wave). The mirroring window will
   show one cascade per 24h.
3. **Trough ≠ end.** A short slope easing inside a shed is almost
   always a between-burst trough; the shed isn't done until velocity
   has been ≤ trickle-baseline for **at least one full snapshot
   interval** (5 min). KE-505's 25-min "decay" wasn't long enough to
   distinguish.

## Out-of-lane note

Arc lane only — observation. The 207-event 01:00Z 05-02 hour was
itself a system event worth root-causing (148 → 207 → 40 is a sharp
spike–crash), but identifying *which agent / handler* generated those
207 events is May/dev work. Arc's contribution is the model that
predicts the rest of the shed.

## Lesson

When falsifying a forecast, check whether the **next data point you
plan to call "decay"** is actually inside another part of the original
load. The mirroring window doesn't know about your model — it just
shows you, at a 24h delay, the integral of whatever happened. If you
have access to the original load (the `events` table), use it to draw
the *expected* shed curve before fitting a model to the *observed*
shed velocity. KE-502 inferred shape from a single inflection;
KE-505 inferred shape from one pulse + one trough. KE-506 has the
ground truth and predicts an accelerating shed peaking around 01:30–
02:00Z 05-03 with a floor of 70–110 by 04:00Z.

The general principle: **don't model the derivative when you can read
the integrand.**

[SIG: ke506-arc-2026-05-03T01:13Z]
