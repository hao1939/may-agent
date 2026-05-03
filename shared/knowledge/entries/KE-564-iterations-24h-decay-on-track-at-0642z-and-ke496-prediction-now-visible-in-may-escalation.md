# KE-564 — KE-563 decay schedule on-track at 06:42Z; KE-496 prediction surfaced in May's 06:42Z escalation to Hao

<!-- metrics: project.iterations-24h, project.blocked-over-6h -->

**Date:** 2026-05-03 ~06:48Z
**Author:** arc (heartbeat)
**Status:** confirmation — KE-563 F2 not fired (arithmetic on-track); KE-455 + KE-496 still hold (zero `metric.breach` ever).
**Confidence:** High (DB read; no judgement involved).
**Connects:** KE-455, KE-496, KE-561, KE-562, KE-563, and arc proposal `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md`.
**Severity:** low (checkpoint + visibility note).

## What this KE adds

KE-563 published a deterministic ageout schedule for `project.iterations-24h` and three falsifiers (F1 re-arm, F2 schedule miss, F3 breach fires). At 06:42Z the first three table rows can be checked against live data, and at the same minute May emitted an `agent.notification` to `hao` that names the KE-496 fix as the unblocker. Both observations are worth recording before the cliff completes silently.

## 1. KE-563 schedule check at 06:42Z (F2 not fired)

| Time (UTC)              | KE-563 prediction (`current` at end of bucket) | Live measurement                                                | Note |
|-------------------------|------------------------------------------------|-----------------------------------------------------------------|------|
| 2026-05-03 06:42        | 27                                             | `COUNT(events where event_type='project.iteration' AND timestamp > now-86400000)` = **27** at 06:44:53Z | exact match |
| 2026-05-03 06:12 (sample) | 30                                           | `metrics.current` = **29** (sampled 06:42:08Z) → **27** at 06:48:48Z | metric snapshot lags live count by one 5-min tick; KE-563 listed `30` because the snapshot was 29 just *before* the two 06:42:21 events aged out at 06:42:21 — within ±1 of the prediction |

F2 ("schedule diverges by >2") has not fired. The next checkpoint
where the prediction is testable without ambiguity is 07:12 (predicted
`current = 24` at end of bucket 07; live count should be 24 by
07:42:19Z when both 07:42 events have aged out).

I will not write a per-bucket check KE — KE-563 is the schedule, this
KE is the first datapoint, and only a divergence is worth a follow-up.

## 2. KE-496 prediction is now visible in May's escalation stream

At **06:42:46Z** May emitted (`event_type=agent.notification`, owner=hao):

> "[P2] Recurring red metrics (project.active-count=0,
> project.blocked-over-6h=2) have been alerting for 10+ consecutive
> checks. Per KE-513, these are structurally unfireable with current
> config. The fix is adopting the reconcile proposal at
> agents/arc/workspace/proposals/2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md
> (unadopted since May 1). Specifically: set project.iterations-24h
> threshold 0→3, project.blocked-over-6h target 2→0. Awaiting your
> decision on whether to adopt."

Three things to note:

1. **KE-496's §Implication-1 is now visible in operations.** May's
   message describes exactly the failure mode KE-496 named: alerts that
   look red on a dashboard but cannot fire a `metric.breach` event.
   This is no longer just an arc-internal observation; it is an
   in-band escalation to the human owner with the proposal path
   linked. KE-496 was 14h old at this point and at risk of rotting;
   it has now been picked up in the dispatch chain.
2. **The cite is to KE-513, not KE-496.** KE-513 ("stop the loop")
   does not contain the unfireable-config analysis — KE-496 does.
   This is a minor mis-citation; a future reader following the May
   notification to KE-513 will find a "stop forecasting" recommendation
   rather than the structural diagnosis. Not worth its own KE, but
   when the proposal lands, the rationale section should reference
   **KE-496** (and KE-451 for the lane reason the proposal is the right
   artifact) rather than KE-513.
3. **`project.blocked-over-6h = 2` is new since KE-496 was written.**
   At KE-496 time (19:48Z 2026-05-02) `current` was 0; at 06:48Z 05-03
   it is 2. Two `waiting` projects have been in that state ≥6h:
   `proof-of-life-dashboard` (waiting since 2026-05-02 00:25:41Z, ~30h)
   and `hao-alignment` (waiting since same mtime, ~30h). KE-496's
   inverted-gauge prediction — *being at target = being in breach* —
   is now arithmetically true on this row: `current=2`, `target=2`,
   `threshold=1`, `alert_op='>'` → `current > threshold` so a breach
   would fire if KE-455 were resolved, while simultaneously
   `current == target` so the metric reads as "at goal." Anyone
   reading the metric without KE-496 in mind will be confused by the
   simultaneous "green target / red threshold" status.

## 3. Breach event count: still zero

```
SELECT COUNT(*) FROM events WHERE event_type='metric.breach';  -- 0 (all-time)
```

KE-455 ("`metric.breach` events have never fired") still holds. The
cliff in `iterations-24h` will pass through the design-doc threshold
(3) at ≈14:12Z 2026-05-03 with no event emitted; this confirms KE-563
F3.

## Falsifiers

- **F1 (KE-563 re-arm).** Same as KE-563: a `project.md` mtime advance
  followed by a non-emission at the next tick. Not yet fired (latest
  mtime still `cross-agent-collaboration/project.md` at
  2026-05-03T02:26:32Z).
- **F2 (KE-563 schedule miss).** Same as KE-563. Today's first
  checkpoint passed; next is 07:42 (predicted `current=24`).
- **F4 (new).** If May's proposal-adoption escalation produces a
  metrics-table edit before 14:12Z 2026-05-03 — i.e. someone sets
  `project.iterations-24h.threshold=3` and/or
  `project.blocked-over-6h.target=0` — then a `metric.breach` *can*
  fire, and KE-563's "0 breach events across the cliff" prediction is
  voided by repair, not by error. (This is the desired outcome, not a
  failure of the model.)

## Recommendations

None new. The two existing recommendations carry forward:

1. **Adopt arc proposal `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md`** (May's lane, now visible in May's own escalation stream).
2. **Repair KE-455's emit path** so `metric.breach` events fire when the config above is corrected.

No file edits in non-arc lanes; this KE is the artifact for this heartbeat.

## Lesson

When an upstream consumer (May) cites a downstream KE, the citation
chain is part of the artifact's value — and worth checking. May's
notification credits KE-513 for a finding that lives in KE-496;
that's a small drift today, but exactly the mechanism by which
"the rationale gets lost when the fix lands." Put the proposal's
rationale field on the same KE that contains the analysis, not on
the loop-stopper.

[SIG: 1777790948:ke564-arc]
