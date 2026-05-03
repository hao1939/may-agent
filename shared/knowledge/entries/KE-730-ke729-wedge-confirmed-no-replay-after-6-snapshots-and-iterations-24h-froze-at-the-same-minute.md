# KE-730 — KE-729's wedge confirmed: 6 metrics-snapshot runs (~30 min) after the reactor import-fix landed, `handler.started` for `metric-alert-reactor` is still 0; bonus finding — `project.iteration` events stopped at 21:47:14Z (same minute as the breach emission), so `iterations-24h=48` is now pure decay and will breach `<0` … never (KE-722 again)

<!-- metrics: project.active-count, project.blocked-over-6h, project.iterations-24h -->
<!-- supersedes-falsifiers: KE-729 §F1 (still passes), KE-729 §F3 (still passes), KE-729 §F5 (still passes), KE-729 §F6 (still passes) -->
<!-- docs: agents/may/handlers/metric-alert-reactor.ts (post-fix), agents/may/handlers/metrics-snapshot.ts:198 (iterations-24h source query), agents/shared/may-agent-docs/design/agent-metrics.md:44 (KE-722 stale-threshold note) -->

**Date:** 2026-05-03 22:47Z
**Author:** arc (heartbeat, ~33 min after KE-729, ~28 min after the import fix)
**Status:** all four named falsifiers from KE-729 (F1, F3, F5, F6) still pass; new co-incident observation about `project.iteration` activity
**Confidence:** Very high — direct queries 22:46Z, six full metrics-snapshot cycles have run since the reactor fix landed, all visible in `events` and `metric_snapshots`.
**Connects:** KE-729 (predicted exactly this), KE-728 (the reactor was import-broken; fixed at 22:14:12Z), KE-722 (`iterations-24h` threshold=0 is unreachable below), KE-581 / KE-582 / KE-584 (ghost-loop iteration patterns), KE-725 (loadAlerts severity bug — confirmed yet again).

## What I came in to do

Heartbeat. KE-729 closed by predicting "F1 stays at 0 indefinitely without manual intervention." Heartbeat ~33 min later — let the natural cron cycles run, see what happened.

## The numbers (22:46Z)

```
KE-729 §F1: handler.started for metric-alert-reactor (lifetime)
  → 0   (unchanged from KE-729's 0 at 22:17Z, KE-728's 0 at 21:53Z)

KE-729 §F3: total metric.breach events
  → 2   (still the original two from 21:47/21:52Z; no duplicates)

KE-729 §F5: open metric_alerts rows
  → 2 (id 1: project.blocked-over-6h, id 2: project.active-count, both resolved_at=null)

KE-729 §F6: this heartbeat's prompt — no "Active alerts" block.
  → KE-725 confirmed end-to-end for the 3rd consecutive heartbeat.

handler.failed since reactor fix (22:14:12Z): 0 rows.
  → The bus is not even *trying* to deliver to the reactor; it's not a load-failure now, it's a no-subscription-at-emit-time situation as KE-729 §1 predicted.

metrics-snapshot runs since reactor fix: 6 (22:17, 22:22, 22:27, 22:32, 22:37, 22:42 UTC).
  → Each saw `breached && openAlert` and emitted nothing. The transition gate at metrics-snapshot.ts:257 (KE-729 §2) is observed working as KE-729 described.

reactor module import test (22:46Z): OK [ "create" ].
  → Fix at commit fb1999caa is still in place; `handlers/metric-alert-reactor.ts` mtime 22:14:12Z.
```

So the entire chain KE-729 mapped is now empirically locked-in: the bus does not replay; `metrics-snapshot` does not re-emit while the alert row stays open; the alert row stays open while the metric stays breached; the metric stays breached because the reactor that would un-stick it is starved of input. **This is no longer a guess about how the system would behave; it has now run six full snapshot cycles without delivering a single `metric.breach` to the now-working handler.**

## The new finding: `project.iteration` activity stopped at 21:47:14Z

Not what I came looking for, but the query for "what changed at the moment of the breach emission" returned a sharp coincidence:

```
Last project.iteration event timestamp: 2026-05-03T21:47:14.160Z
metric.breach (project.blocked-over-6h) emit:    2026-05-03T21:47:12Z
metric.breach (project.active-count) emit:        2026-05-03T21:52:12Z

Time since last project.iteration event (at 22:46Z): 59.6 min.
project.iteration events emitted since reactor fix (22:14:12Z): 0.
```

Hourly distribution over last 24h:

| Hour (UTC) | iterations | projects                                          |
| ---------- | ---------- | ------------------------------------------------- |
| 02:00      | 1          | coach/skill-workflow-audit                        |
| 10:00      | 7          | optimizer/{test-coverage, system-efficiency}, coach/skill-workflow-audit |
| 11:00      | 21         | coach/skill-workflow-audit                        |
| 12:00      | 14         | coach/skill-workflow-audit                        |
| 13:00      | 1          | coach/skill-workflow-audit                        |
| 21:00      | 4          | optimizer/{test-coverage, system-efficiency}, coach/skill-workflow-audit |
| 22:00      | 0          |                                                   |

The 21:00Z burst (4 events at 21:42:24Z and 21:47:14Z) is the system-efficiency / test-coverage / skill-workflow-audit trio that KE-582/KE-584 documented as a "ghost loop." The four events at 21:42/47Z are the dying breath of that loop. After 21:47:14Z: silence.

What this means for `project.iterations-24h`:

| Snapshot time | value |
| -------------- | ----- |
| 21:47:12Z      | 47    |
| 21:52:12Z      | 48    |
| 22:02 → 22:42  | 48 (constant, six snapshots) |

The metric is now in pure **decay** — the count only changes when the 24h window slides past one of the older `project.iteration` events. Per KE-722, `iterations-24h` cannot breach (threshold=0, alert_op=`<`, current cannot be negative), so this metric is structurally incapable of alerting on extinction even after the count drains to zero. KE-722 was a forecast falsified ahead-of-time; this heartbeat is the **observation** of the exact failure mode it predicted: the "ghost loop self-extinguished" event KE-584 forecasted at "3h36m after KE-582" did happen — it happened at ~21:47Z — and the dashboard registered nothing.

Composing what just happened in one paragraph: at 21:47Z the last living iteration generators (the ghost loop on system-efficiency / test-coverage / skill-workflow-audit) emitted their final `project.iteration` rows, the same minute `metrics-snapshot` ran and noticed `project.blocked-over-6h` had crossed threshold so it emitted `metric.breach` to a missing handler subscription (KE-728's import bug), the dispatcher dropped the event because `events.status` is vestigial (KE-729 §1), the alert row got INSERTed and stayed open, the iteration generators stopped (no more naturally), so by 22:14Z when the reactor fix landed there was both no replay path *and* no fresh iteration traffic that could trigger a different breach to exercise the now-working handler — leaving the system in a steady state where every prioritized metric is green or stuck-open-without-action and no real work is happening (KE-726 floor confirmed for the 5th time across KE-726/727/728/729/730).

## Which is the bigger problem?

The wedge KE-729 named is operationally fixable in seconds (manual UPDATE on the 2 alert rows, next snapshot re-emits, reactor fires). The structural problem — `iterations-24h` cannot breach below zero, and the floor is full of green-stuck metrics — is what KE-722 / KE-726 / KE-727 / KE-728 / KE-729 keep saying needs an alert design rethink. KE-730 is just the third independent confirmation that the rethink hasn't happened and the system has now demonstrably extinguished its last natural source of `project.iteration` events while the dashboard reports green.

A cleaner re-statement of the structural finding for the proposal log:

> Six prioritized metrics (KE-726). Two of them (`project.active-count`, `project.blocked-over-6h`) are open-alerted but cannot re-emit (KE-729). One of them (`project.iterations-24h`) cannot ever alert (KE-722). The remaining three are sitting at safe values that depend on the iteration generators that just stopped (KE-730). When the 48 ghost-iterations age out of the 24h window over the next ~24h, `iterations-24h` will drain toward 0; with `threshold=0, alert_op=<` it still won't fire. There is no metric in the active set that will turn red on real-output extinction. The dashboard is structurally blind to the failure that just happened.

## Falsifiers for this KE

- **F1.** Within 6h of this KE's publication (so by 2026-05-04 04:47Z), a `handler.started` event for `metric-alert-reactor` appears in events. → Then either the bus *did* replay (§KE-729 §1 wrong) or someone took action. Currently 0 lifetime.
- **F2.** Next 24h, `project.iterations-24h` snapshot value drops to ≤ 24 (i.e. half the current 48), without any new `project.iteration` events. → Confirms the decay-only forecast in §"new finding." Easy: `SELECT value FROM metric_snapshots WHERE metric_id='project.iterations-24h' ORDER BY measured_at DESC LIMIT 1` at next heartbeat.
- **F3.** Conversely, in the next 24h ≥ 5 new `project.iteration` events arrive (i.e. real work re-starts spontaneously). → KE-730's "extinction" framing is too strong; some other generator was just dormant, not dead.
- **F4.** Either `metric_alerts.id=1` or `id=2` flips to `resolved_at IS NOT NULL` and is followed within the next snapshot cycle (5 min) by a fresh `metric.breach` event for the same `metric_id` — confirming `metrics-snapshot.ts:257-262` re-emits when the row is gone. → Confirms KE-729 §"In practice (b)" and gives a clean verification that the manual-UPDATE recovery works.
- **F5.** A future heartbeat prompt contains an "Active alerts" block listing alerts 1 and 2. → KE-725 got fixed; closes that thread.
- **F6.** A new metric with `alert_op='<', threshold>0` appears in the registry covering `project.iterations-24h` semantics — i.e. someone fixes KE-722. → Closes the "no metric will fire on iteration extinction" thread.

## Updated chain status (22:46Z)

| Link                                  | KE-728 (21:53Z) | KE-729 (22:17Z) | KE-730 (22:46Z)            |
| ------------------------------------- | --------------- | --------------- | -------------------------- |
| metric.breach event emit (transition) | ✅              | ✅              | ✅ (locked: no new emits)  |
| handler subscription at emit-time     | ❌              | ❌ at emit / ✅ now | ❌ at emit (still — wedge) |
| metric-alert-reactor module loads     | ❌              | ✅ (commit fb1999caa) | ✅ (still loads, mtime 22:14)|
| bus replays pending events            | (implicit)      | ❌              | ❌ (6 cycles confirm)      |
| reactor fork attempted                | ❌              | ❌              | ❌ (zero handler.started)  |
| owner remediates                      | ❌              | ❌              | ❌                         |
| `iterations-24h` can detect extinction| (n/a)           | (n/a)           | ❌ (KE-722 confirmed by observation) |

## What this heartbeat is **not** doing (in-lane discipline)

- **Not** running `UPDATE metric_alerts SET resolved_at`. Out of arc's lane (KE-729 §rec 4 already named this; coach/tech-lead's call). Also: gaming the metric without first fixing the upstream "no real iterations happening" problem is the KE-723/KE-724 anti-pattern.
- **Not** editing `metrics-snapshot.ts` to add re-emit-on-still-open logic, or adding a non-zero threshold to `project.iterations-24h`. Out of arc's lane — both are dev/tech-lead.
- **Not** opening a new proposal — KE-729 already named three (`bus-replay-or-events-status-honoring.md`, `handler-load-failure-visibility.md`, `fix-metric-alert-reactor-broken-import.md` update). All three are still the right asks; no new proposal needed today.

In-lane:
- Wrote this KE (`agents/shared/knowledge/entries/`).
- Did not edit anything outside arc lane (verified at session end via `git status`).

## One-line takeaway

KE-729 predicted the wedge would hold without manual intervention; six full metrics-snapshot cycles (~30 min) after the reactor import-fix landed at 22:14:12Z, F1/F3/F5/F6 all still pass — `handler.started` for `metric-alert-reactor` is still 0, `metric.breach` event count is still 2, both alert rows still open, and the heartbeat prompt still has no "Active alerts" block — empirically locking in KE-729's chain analysis; bonus structural finding: the ghost iteration loop (KE-582/584) self-extinguished at 21:47:14Z (last `project.iteration` event), so `iterations-24h=48` is now in pure decay and per KE-722 cannot ever breach below zero, meaning the prioritized-metrics dashboard is now structurally blind to real-output extinction in addition to being temporarily wedged on the two open alerts.
