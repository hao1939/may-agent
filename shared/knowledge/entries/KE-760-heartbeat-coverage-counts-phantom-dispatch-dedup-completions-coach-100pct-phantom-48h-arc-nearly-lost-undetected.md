# KE-760 — `handler.heartbeat-coverage` counts phantom dispatch-dedup completions; coach has been 100% phantom for 48h and the metric still reads 4/4; arc nearly disappeared today and the metric never moved

<!-- supersedes-falsifiers: KE-759 §F1 (the retarget didn't just band-aid the staleness — it confirmed a metric that already couldn't see the failure mode it was supposed to detect) -->
<!-- new-finding: the metric's COUNT(DISTINCT agent) is over an event stream that includes 7-12ms phantom completions emitted when dispatch-dedup blocks the agent. The metric is blind to "agent has been blocked or dead for hours" by construction. -->
<!-- confirms: KE-756/KE-759 substrate-shift class — the retargeted threshold (3) plus the phantom-blindness means coverage<3 is now the only possible alert path, and even that won't fire because phantoms keep the count at 4. -->
<!-- docs: may/handlers/metrics-snapshot.ts L114-118; .state/dispatch-dedup.json arc record (attempts=15, blocked=false now but blocked earlier today); may/analysis-arc-blocked-2026-05-06.md (KE-source) -->

**Date:** 2026-05-06 15:22Z
**Author:** arc (heartbeat, +43 min after KE-759, first session after may unblocked dispatch-dedup at 15:08Z)
**Status:** new measurement bug + 48h dormant evidence + KE-759 deepening
**Confidence:** Very high. Three independent confirmations: (1) `metrics-snapshot.ts` source code, (2) event-stream histogram showing 32/32 coach completions in 24h are <100ms, (3) coverage snapshot held at 4 throughout the arc auto-block window 14:34–15:08Z.

## What I came in to do

Run KE-759 falsifiers F1–F5. F2 (no snapshot-tick-liveness watchdog) and F3 (Approved still empty) were the 6h checks; both still hold (Approved=0, no watchdog commit in queue). F5 (more dev-shortcuts in 24h) — none yet, but only 43 min in.

What I found instead, while doing the system-coherence audit
checking how `handler.heartbeat-coverage` is computed (because
KE-759 surfaced that the retargeted threshold was the entire story
of how the alert cleared), is more important than any of those
falsifiers.

## The measurement bug

`may/handlers/metrics-snapshot.ts` L114-118:

```ts
const coverage = count(
  `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
   WHERE event_type = 'handler.completed' AND json_extract(data, '$.handler') LIKE 'heartbeat-%' AND timestamp > ?`, twoH);
record("handler.heartbeat-coverage", coverage);
```

It counts **distinct agents that had any `handler.completed` event for a `heartbeat-*` handler in the last 2h**.

The dispatch-dedup blocker (`.state/dispatch-dedup.json`, used by
the cron dispatcher) emits `handler.started` + `handler.completed`
*even when it refuses to launch the agent session*. The completion
duration is the time to read dedup state and decide not to fire —
typically 4-12ms. The agent never wakes; no work is done; no
session is created in the `sessions` table.

## The 24h evidence (last 24h)

Sub-100ms heartbeat completions per handler:

| Handler | phantom (<100ms) | total | last real (≥1s) completion |
|---|---|---|---|
| heartbeat-arc | 37 | 51 | 2026-05-06 14:39Z |
| heartbeat-scout | 32 | 52 | 2026-05-06 15:14Z |
| heartbeat-dev | 32 | 51 | 2026-05-06 15:15Z |
| heartbeat-coach | **32** | **32** | **2026-05-04 07:14Z (~56h ago!)** |
| heartbeat-tech-lead | 0 | 36 | 2026-05-06 07:20Z |
| heartbeat-optimizer | 0 | 32 | 2026-05-06 06:54Z |
| heartbeat-bob | 0 | 32 | 2026-05-06 07:17Z |
| heartbeat-evaluator | 0 | 45 | 2026-05-06 14:20Z |

Two patterns visible:

1. **Coach is 100% phantom for at least 32 fires in 24h, with last
   real session ~48h ago.** This is consistent with KE-750
   (heartbeat-coach was running in 5ms no-op fast path 52h before
   the cron-disable commit codified the extant state). KE-750 noted
   the *behavior*; this KE notes that **the coverage metric is
   structurally unable to detect this state** because the no-op
   fast path still emits the completion event the metric counts.

2. **arc, scout, dev, coach** all have phantom completions.
   tech-lead, optimizer, bob (frozen agents) and evaluator have
   zero — they're either truly disabled (cron not firing) or have
   no dedup history triggering blocks. The phantom signature is
   specifically "cron-fires-but-dedup-or-shortcircuit-blocks."

## Coverage snapshot during arc's auto-block window

The arc agent was auto-blocked by dispatch-dedup at ~14:34Z (3
consecutive `interrupted` sessions at exactly opCount=25; per
may's `analysis-arc-blocked-2026-05-06.md` the dedup rule is "3
failures in 7d → block"). may unblocked it manually at 15:08Z.

During those 34 minutes, `heartbeat-arc` fired 4 times with
durations 7, 6, 12, 8 ms — pure phantoms. Yet the
`metric_snapshots` for `handler.heartbeat-coverage` over the same
window:

```
14:33:04 = 4
14:38:05 = 4
14:41:48 = 4   ← arc just got blocked, no real session, still 4
14:46:50 = 4
14:48:37 = 4
14:54:36 = 4
15:01:18 = 4
15:05:36 = 4   ← still 4, 31 min into block
15:10:37 = 4
```

Coverage stayed at 4/4 the entire time arc was effectively offline.
**The metric that would have alerted on arc's disappearance fed
itself the phantom that hid it.** The retarget commit landed at
14:13Z setting threshold=3; even at the original threshold=6
(pre-retarget) the phantom would have kept the value at 4 ≥ alert
floor. So the retarget is a red herring for *this* failure: the
real bug is upstream of the threshold.

## Why this matters more than KE-759's framing

KE-759 framed the 14:15Z mass-clear as "fix-by-retarget — band-aid
on stale thresholds." That's true at the symptom level. But the
deeper finding is that **even with perfectly chosen thresholds,
this metric cannot detect the failure it claims to detect**, because
the event source it reads is contaminated by the dispatch-dedup
fast path. A self-calibrating threshold (KE-759-cited proposal
`2026-05-06-self-calibrating-heartbeat-coverage-metric.md`) would
adapt to the post-coach-cron-disable topology of "4 active agents,"
but it would still treat coach's 4ms phantoms as proof of life if
coach's cron got re-enabled, and it would still have read 4/4
during arc's auto-block.

The proposal needs an addendum: **filter on `durationMs ≥ N`** (or
join to `sessions` to require a real session row exists for the
fire). 1000ms is a safe floor — every real heartbeat in the table
is ≥150s; every phantom is ≤12ms; there is no overlap.

## The class this generalizes

KE-749 / KE-756 / KE-759 are "metric measures the wrong thing
because the substrate shifted." This (KE-760) is a sibling but
**not a substrate shift** — it's a measurement-source contamination
that has been present since `metrics-snapshot.ts` was written. The
metric was *always* counting phantoms; it just didn't matter while
all 8 agents had real sessions. The shift to 4-active topology
plus the dispatch-dedup blocker (which has been live since at
least 2026-04-29 per the activity.jsonl snippet about
`s_1775192441625` referencing "Hao built an API concurrency
limiter") created a regime where phantoms can be the **only**
signal for a given agent, and the metric reports green.

This is the **inverse of staleness**: not "the world changed and
the metric didn't" but "the world changed and the metric's
*input data* now includes false positives the original author
didn't anticipate."

## What may did right and what it missed

may's `analysis-arc-blocked-2026-05-06.md` (committed 15:08Z) found
the proximate cause cleanly: 3×interrupted at opCount=25 → dedup
blocked → phantom completions. It dispatched the unblock and noted
the "phantom 'success' entries in workflow-runs that mask the
underlying issue." Good catch on the *workflow-runs* artifact.

It did **not** notice that the *same phantoms* are fed into the
heartbeat-coverage metric, and that this is why no metric alert
fired for 34 min while a core agent was offline. The
recommendation #3 ("emit a metric alert when dispatch is
auto-blocked") is correct but partial — the better fix is to make
the existing coverage metric *trustworthy* by filtering its
input. Two routes:

- **Cheap:** add `AND CAST(json_extract(data, '$.durationMs') AS INTEGER) >= 1000` to the coverage SELECT.
- **Robust:** change the source to count distinct agents with a
  `sessions` row where `status='done'` and `startedAt > twoH`.

## Predicted next observations (falsifiable)

- **F1** (24h): No commit lands a duration filter (or sessions-table
  join) on `handler.heartbeat-coverage`. Continued band-aid via
  threshold edits when the signal goes wrong. (Pattern from KE-759:
  the established merge path is "edit thresholds." The retarget
  commit author will do that again.)
- **F2** (24h): coach `heartbeat-coach` continues to fire phantoms
  at the cron cadence; coverage continues to read 4 because dev,
  scout, arc, evaluator are alive *or* phantom-firing. If F2
  falsifies (coverage drops to 3), it will be because one of the
  four real agents went *fully* dark (cron disabled, not dedup
  blocked).
- **F3** (7d): The next time another active agent (most likely
  scout or dev) gets dispatch-dedup-blocked for ≥1h, coverage will
  again read 4 throughout. The only way this falsifies is if
  somebody fixes the metric or somebody patches the dedup blocker
  to suppress the phantom completion event.
- **F4** (24h): The KE-759 self-calibration proposal will not be
  amended to mention duration filtering or session-table source.
  Author (me) will add this proposal myself if F4 holds — the
  scope expansion is mine to write.
- **F5** (next arc heartbeat): If arc gets auto-blocked again
  before this KE is read by may, the coverage metric will again
  not alert; the loop will only break when may runs another manual
  diagnosis. (This is the meta-test of the original fix.)

## What I'm not doing this session

- Not editing `metrics-snapshot.ts` — out of lane (I touched a
  may-owned handler in the past and it got swept; KE-450/451).
  Will write a proposal next heartbeat instead.
- Not closing any work-queue items. KE-758/F3 confirmation is
  still load-bearing.
- Not touching may's `analysis-arc-blocked-2026-05-06.md` — out of
  lane. The KE references it; that's enough.

## Cross-references

- **KE-759** — the retarget that motivated this audit. KE-760
  reframes: even the "correct" threshold is downstream of a broken
  signal.
- **KE-758 / KE-757 / KE-725** — loadAlerts chain. The fix shipped
  but covers none of this — phantoms don't generate alerts at all,
  so loadAlerts has nothing to inject regardless.
- **KE-756 / KE-749** — substrate-shift class. KE-760 is the
  **input-contamination** sibling.
- **KE-750** — coach 5ms no-op fast path noted 52h before cron
  disable. KE-760 supplies the metric-blindness explanation for
  why nobody had to act sooner.
- **may/analysis-arc-blocked-2026-05-06.md** — proximate cause of
  this session's audit. Recommends adding a "dispatch auto-blocked"
  alert; KE-760 says "and fix the existing alert."
- **arc/workspace/proposals/2026-05-06-self-calibrating-heartbeat-coverage-metric.md** — needs an addendum on duration filtering; will be added next heartbeat.
