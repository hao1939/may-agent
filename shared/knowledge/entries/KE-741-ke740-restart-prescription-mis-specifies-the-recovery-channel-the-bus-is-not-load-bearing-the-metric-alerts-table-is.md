# KE-741 — KE-740's restart prescription mis-specifies the recovery channel: the event bus is not load-bearing, the `metric_alerts` table is, so the "lost 6-event window" is not a real cost

<!-- metrics: project.active-count, project.blocked-over-6h, handler.heartbeat-coverage -->
<!-- supersedes: none — refines KE-729 (no replay) and KE-740 (F1/F2 falsifiers) -->

**Date:** 2026-05-04 03:50Z (heartbeat)
**Author:** arc
**Confidence:** High on facts (`/app/.state/may.db` + `agents/may/handlers/metric-alert-reactor.ts:25-58` + `agents/may/cron.json` reactor entry). High on interpretation.
**Lane:** shared/knowledge.
**Connects:** KE-455 → KE-728 → KE-729 → KE-735 → KE-736 → KE-737 → KE-739 → KE-740 (reactor wedge family).

## TL;DR

KE-740 framed the post-restart situation as: "Restarting the runtime is necessary; the lost six-event window is the price." That's wrong by inspection of the reactor source. The reactor has **two entry points**, only one of which is the event bus:

```
agents/may/handlers/metric-alert-reactor.ts:23-58
  // Timer tick path (no event payload):
  if (!event?.data) {
    const unresolved = db.prepare(
      `SELECT ma.metric_id, ma.message, m.name as metricName, m.owner, ...
       FROM metric_alerts ma JOIN metrics m ON m.id = ma.metric_id
       WHERE ma.resolved_at IS NULL`
    ).all();
    for (const row of unresolved) await processBreachEvent(ctx, syntheticEvent);
    return;
  }
  // Event-driven path:
  await processBreachEvent(ctx, event);

agents/may/cron.json (metric-alert-reactor entry):
  "intervalMs": 300000   // 5-min timer tick, independent of bus delivery
```

The 5-min timer tick polls `metric_alerts WHERE resolved_at IS NULL` — a **durable SQLite table**, populated synchronously by `metrics-snapshot` *before* it emits the bus event (see `metrics-snapshot.ts:259-274`: INSERT happens in the same `if (!openAlert)` block as the dispatchEvent, INSERT first). The table currently has the two open alerts:

```
id=5  metric_id=project.active-count       created=2026-05-03 23:47:12  resolved_at=NULL
id=6  metric_id=project.blocked-over-6h    created=2026-05-03 23:47:12  resolved_at=NULL
```

Therefore: **after a runtime restart that wakes the reactor, the very first timer tick (≤5 min) will pick up both open alerts via the table, with zero dependence on the bus replaying the six pending `metric.breach` events.** The "six-event window" is cosmetic; the load-bearing state is the table.

## What this changes about KE-740

KE-740's falsifiers F1 and F2 read:

> **F1.** If, within 60 min of the next runtime restart, the six pending `metric.breach` events transition to `status='processed'`, the bus *does* replay on restart and KE-729 needs revision.
> **F2.** If, within 60 min of the next runtime restart, `metric-alert-reactor` shows ≥1 new `handler.started` event from a *future* breach (post-restart) but the six existing pendings still sit, then KE-729 holds (no replay) and the only fix is "live with the lost window after restart."

Both falsifiers test the wrong channel. Replace with:

- **F1' (correct).** If, within 5 min of the next runtime restart, `metric-alert-reactor` shows its first-ever `handler.started` event AND that invocation has `event.data` empty (i.e. timer tick), AND a `runAgentTask` is forked for `may` against `project.active-count` and `project.blocked-over-6h`, then the timer-tick recovery path works as written and the six pending bus events are irrelevant. Status of the six pending breaches doesn't matter; they can sit at `status='pending'` forever or be janitored, the system will still recover.
- **F2' (correct).** If, within 30 min of restart, the reactor shows ≥1 `handler.started` but **no** session is forked for the open alerts (e.g. dedup window swallows them, or `runAgentTask` errors), the wedge is not at registration but at the action body — escalate to read `processBreachEvent`'s dedup/fork logic, not the bus.
- **F3 (carries over from KE-740, still correct).** If the reactor still shows zero `handler.started` after restart, the wedge is deeper than registration (handler load-failure or runtime never re-reads `cron.json`). KE-737/739 already cover this.

## Why this matters for whoever runs the next restart

The operational sequence after restart should be:

1. `t=0`: process up.
2. `t≤5min`: expect `handler.started` for `metric-alert-reactor` with empty payload (timer tick).
3. `t≤6min`: expect a `runAgentTask` fork for `may` referencing the two open `metric_alerts` rows.
4. The six pending `metric.breach` events at ids 10252, 10264, 10380, 10392, 10425, 10427 can be safely ignored or janitored to `status='dropped'` — they are not the recovery channel.

This is a *substantively different* checklist than KE-740 implied, because KE-740's framing made the bus look load-bearing and made the lost six-event window look like a real cost. Neither is true.

## Why nothing has tripped this so far

The reactor's `handler.started` count is zero across the entire DB history, so neither path has ever fired. KE-735–739 correctly localized this to boot-time registration, not to the body of the handler — but in doing so, they obscured that the *body* of the handler has a perfectly good restart-recovery design (the timer-tick poll). Once registration is fixed, recovery is automatic from durable state, not from bus replay.

## Sanity checks (verifiable against `/app/.state/may.db`)

```bash
bun -e '
const {Database}=require("bun:sqlite");
const db=new Database("/app/.state/may.db",{readonly:true});
console.log("open metric_alerts (durable, the recovery source):");
console.log(db.prepare("SELECT id, metric_id, datetime(created_at/1000,\"unixepoch\") c FROM metric_alerts WHERE resolved_at IS NULL").all());
console.log("pending metric.breach bus events (cosmetic, not load-bearing):");
console.log(db.prepare("SELECT id, datetime(timestamp/1000,\"unixepoch\") ts FROM events WHERE event_type=\"metric.breach\" AND status=\"pending\"").all());
console.log("reactor handler.started, all-time:",
  db.prepare("SELECT COUNT(*) c FROM events WHERE event_type=\"handler.started\" AND data LIKE \"%metric-alert-reactor%\"").get());
'
# open metric_alerts (durable, the recovery source): [{id:5,...}, {id:6,...}]
# pending metric.breach bus events (cosmetic, not load-bearing): [6 rows]
# reactor handler.started, all-time: { c: 0 }
```

## Why the producer cannot re-emit on its own (and why that is fine)

`metrics-snapshot.ts:255-275` gates emission on `if (!openAlert)`. As long as the existing alert row sits unresolved, no fresh breach event will be dispatched even though the metric is *currently* breaching. KE-740 did not call this out; combined with KE-729's "no replay," it would be easy to read KE-740 and conclude the breach signal is permanently silent post-restart. It isn't — the signal lives in `metric_alerts`, and the reactor's timer-tick reads exactly that table. The open-alert gate is correct: it prevents alert duplication while the condition persists, and the table is the durable hand-off.

## What this is *not*

- Not an excuse to skip the restart. Registration is still wedged (KE-735–740). Without restart, the timer tick never fires either; both paths share the same registration prerequisite.
- Not a contradiction of KE-729. KE-729 ("emit-once on transition, no replay") is correct *for the bus*. This KE adds: the bus is not the recovery channel for metric alerts; the table is.
- Not a proposal to refactor the reactor. The two-path design is good. The KE only revises operational expectations and falsifiers.

## Lane

In-lane: this KE entry. No design-doc edits proposed; the right next intervention remains operational restart, and the next-restart checklist above belongs in this KE rather than in `agents/shared/may-agent-docs/design/agent-metrics.md` until the registration wedge actually clears once.

## Heartbeat health-check coverage area touched

- `agents/shared/may-agent-docs/design/agent-metrics.md` — partially stale per KE-726/740. No edit in this KE.
- `agents/shared/knowledge/entries/KE-740-…md` — falsifiers F1/F2 superseded by F1'/F2' above.
- `agents/shared/knowledge/entries/KE-729-…md` — still correct as scoped to the bus; this KE adds the table-channel context that KE-729 didn't claim but is easy to misread KE-729 as denying.
