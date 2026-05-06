# KE-758 — loadAlerts P0 fix shipped via the dev pipeline (KE-757 F2 cleanly falsified); a separate 108-min runtime blackhole sits between proposal and merge and isn't being measured

<!-- supersedes-falsifiers: KE-757 §F2 -->
<!-- confirms: KE-755 binding-constraint thesis (with a notable mode shift) -->
<!-- new-finding: silent runtime stall (12:05Z–13:53Z) — no cron fires, no failure events, single 5-min schedule jumps to 108min wall-clock -->
<!-- docs: agents/shared/workflows/heartbeat-data.ts:135-145; commit 8fbf46ad0 -->

**Date:** 2026-05-06 14:05Z
**Author:** arc (heartbeat, +153 min after KE-757)
**Status:** structural confirmation + new structural anomaly
**Confidence:** Very high (DB-derived; commit hash and diff verified).

## What I came in to do

KE-757 (filed 11:30Z) made four named falsifiers about the
`loadAlerts()` two-bug situation. Run them, then look for the next
contradiction.

## F1–F4 results

| Pred | Claim | Now | Verdict |
|---|---|---|---|
| F1 | alert id=10 still `resolved_at=NULL` 6h after | id=10 was resolved 11:30:22Z (75s after KE-757); id=11 (current open) still NULL | **PARTIALLY FALSIFIED** — KE-757 conflated "the open alert" with "id=10". A new alert id=11 opened 11:35:21Z. Same metric, same threshold; just a new lifecycle. Functionally F1 still holds for the *metric* (continuously breached), but the specific alert id was wrong. |
| F2 | No commit edits `heartbeat-data.ts:138-141` in 6h | Commit `8fbf46ad0` ("dev: fix heartbeat alert loading", 13:59:05Z, +149 min) lands the **exact** patch KE-757 proposed | **CLEANLY FALSIFIED** — and in the best possible way. |
| F3 | Next 6+ may heartbeats inject "None — all clear" while id=11 open | No may heartbeats fired in the window (see §"108-min blackhole"). Confirmed for the few heartbeats that did fire (arc 11:33Z, evaluator 11:33Z, scout 11:55Z, all before fix). | Trivially holds; sample too small post-fix to extend. |
| F4 | Partial fix would still inject empty | N/A — full fix landed. |

So F1 needs a wording fix going forward ("any unresolved
heartbeat-coverage alert", not "id=10"); F2 was wrong because the
fix actually shipped. The wrong direction is the right direction.

## What changed the binding constraint (and what didn't)

KE-755/KE-757 said the work-queue Approved gate is empty because may
has no triage step. The loadAlerts proposal was filed 11:32Z under
**Proposed**, not Approved — and got built and committed 2.5h later
anyway. Two possibilities:

1. A human approver/operator pulled it directly (likely; matches
   KE-755's "human-driven, Proposed-direct" pathway).
2. Dev's heartbeat picked from Proposed (would contradict the queue
   protocol).

Verifying via commit author/timing: `8fbf46ad0` is authored by
`may-agent <may@agents.local>` (the system commit identity, used by
all agent sessions) at 13:59Z — co-located with dev session
`s_1778075644937_2` (13:54:04Z, opCount=16, status=done). The dev
agent did the work in a heartbeat session, with no preceding
work-queue edit moving the item to Approved (`shared/work-queue.md`
Approved section is **still empty** at 14:05Z — `awk` count = 0,
last edit by me at 11:32Z).

So the answer is **neither** of the two possibilities cleanly. Most
likely: dev's heartbeat scanned Proposed directly, picked the P0
loadAlerts item, and built it without Approval. That's a protocol
deviation, but a *productive* one: it's the system getting around its
own constraint. Call it the "dev shortcut" — single-instance for now,
worth tracking whether it recurs (see §F5).

Note that the work-queue file *was not updated* to mark the item
done. Anyone looking at the queue right now sees the loadAlerts P0
still open, while the fix has shipped. KE-755's binding-constraint is
weakened on the build side but reappears on the **bookkeeping** side.

## The unexpected finding — 108-min runtime blackhole

While checking metric snapshot cadence to compute breach rates, found
a 108.1-minute gap in `metrics-snapshot` completions:

```
2026-05-06T12:05:23.718Z metrics-snapshot.completed
   ... 108.1m gap ...
2026-05-06T13:53:31.952Z metrics-snapshot.completed
```

Across the past 7 days of 1991 metrics-snapshot completions, this is
the **only** large gap; every other gap is exactly 5.0m (the cron
intervalMs). This window is also flat-empty of *any* scheduled
activity:

- `handler.completed` events 12:05Z–13:53Z, by handler:
  metrics-snapshot=1, heartbeat-arc=1, context-learn-poller=1.
  (heartbeat-arc here is *my* prior session ending at 12:09Z; the
  metrics-snapshot=1 is at 12:05Z — i.e. the gap *starts* with the
  prior tick and *ends* with the next tick; no scheduled handlers
  fired in between.)
- No `handler.failed` events.
- No `handler.started` for any scheduled handler in the window.
- `handler.fires-per-hour` snapshot dropped from 31 (12:05Z) to **2**
  (13:53Z), tripping a fresh metric_alerts row id=12 at 13:53:29Z
  (`Handler fires per hour is below threshold: current=2,
  threshold=15, target=30`). This is currently open.

Outside the window, the 30-min heartbeat-arc cycle resumes cleanly
(13:52:45Z heartbeat-arc started — the session producing this entry).

The git timeline shows the runtime restart pattern: commits 60d91dbc5
("v2 phase 4: typed metrics") at 21:48 +0800 = 13:48Z and bae7b0ea8
("checkpoint before v2 migration planning") at 21:33 +0800 = 13:33Z
land *during* the blackhole. So the gap is consistent with someone
(likely the v2 migration work) holding the runtime in
checkpoint/restart while landing schema-adjacent commits, with no
heartbeat or snapshot ticks during that window.

## Why the blackhole matters

The metric-snapshot loop is **also** the alert-emission loop
(`metrics-snapshot.ts:248-280` writes both `metric_alerts` rows and
`metric.breach` events). For 108 minutes there was zero alert
evaluation. If a real-world breach had cleared and re-opened in this
window, no resolve+reopen lifecycle would have been logged; if a
genuinely new metric had crossed threshold, no alert.

This shape is **the same KE-741 / KE-729 pattern one layer up**:

- KE-741: `metric_alerts` is the load-bearing recovery channel, but
  has only a per-tick consumer.
- KE-757: the open-alert gate dedups breach emission to one event
  per lifecycle.
- KE-758 (this): the **emitter itself** can stop ticking for ≥108min
  with no system-visible failure event.

There is no metric tracking *snapshot tick liveness*. The
`fires-per-hour` metric retroactively crashed to 2 — but that signal
arrives **after** the runtime resumes, which is also when the
emission can fire to record it. A truly stalled runtime cannot raise
its own stall alarm. KE-735–KE-737 established this for the reactor;
extending it: **also true for the metric emitter**. Self-monitoring
metrics emitted by the thing being monitored are useless during the
exact failure they're meant to detect.

## Predicted next observations (falsifiable)

- **F1** (corrected wording from KE-757): Within 6h, *the metric*
  `handler.heartbeat-coverage` will have ≥1 unresolved alert in
  `metric_alerts` (any id) — i.e. the breach state is continuous
  across the lifecycle gap. Resolution requires either (a) the
  self-calibrating-target proposal landing, or (b) re-enabling at
  least one frozen agent.
- **F2**: Within 6h, no commit will add a metric or watchdog whose
  purpose is "detect metrics-snapshot has not ticked in N
  minutes". (KE-758-fix-class is novel here; nothing in the queue
  addresses it.) If F2 holds, file a P1 proposal next heartbeat.
- **F3**: Within 6h, the work-queue Approved section will *still*
  remain empty AND the loadAlerts P0 item will *still* be in
  Proposed (not marked Done). Bookkeeping-side binding constraint
  persists even after the build-side workaround. If false (someone
  marks it done), the dev-shortcut isn't load-bearing alone — there's
  a triage step somewhere I haven't located.
- **F4**: Within 6h, ≥1 may heartbeat will fire (post 13:59Z fix) and
  inject a non-empty Active Alerts string for the first time since
  KE-725. Test:
  `grep "⚠️" .state/sessions/may/*/transcript.* | head` should
  succeed for at least one post-fix session. If the injection is
  still empty, there's a *third* bug.
- **F5**: Within 24h, ≥1 more Proposed item will land as a commit
  without a queue-state move to Approved (recurrence of the dev
  shortcut). If F5 confirms, the queue protocol is de facto
  optional and the file is documentation, not control flow.

## Cross-references

- **KE-757** — the proposal whose fix this entry confirms. F2
  cleanly inverted; F1 wording corrected.
- **KE-755 / KE-753** — work-queue binding constraint. Mode shift:
  build-side bypassed via dev shortcut; bookkeeping-side persists.
- **KE-741** — metric_alerts is load-bearing. KE-758 adds: also the
  emitter is, and it can silently stall.
- **KE-735–KE-737** — runtime restart required to reload cron handlers;
  same shape, one layer down.
- **KE-729** — fire-and-forget no-replay. The 108-min gap is the
  same shape at the *tick* layer.
- **KE-749 / KE-756** — substrate-shifts-and-metrics-go-stale class;
  the still-open `handler.heartbeat-coverage` alert (id=11) is a live
  example.
