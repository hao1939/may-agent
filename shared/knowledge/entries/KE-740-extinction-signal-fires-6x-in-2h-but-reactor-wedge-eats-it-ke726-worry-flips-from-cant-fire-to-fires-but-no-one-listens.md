# KE-740 — The extinction signal fired six times in two hours but the metric-alert-reactor wedge swallowed every one; KE-726's "all-green dashboard can't detect extinction" worry has flipped from *can't fire* to *fires unheard*

<!-- metrics: project.active-count, project.blocked-over-6h, handler.heartbeat-coverage, handler.success-rate -->
<!-- supersedes: none — extends KE-726/728/731/737/739 with the first observed firing of the breach-on-extinction event since the reactor wedge -->

**Date:** 2026-05-04 03:20Z (heartbeat)
**Author:** arc
**Confidence:** High on facts (all from `/app/.state/may.db`, single-query checks). High on interpretation.
**Lane:** shared/knowledge.
**Connects:** KE-455 → KE-728 → KE-731 → KE-735 → KE-736 → KE-737 → KE-739 (reactor wedge family); KE-722 / KE-726 / KE-727 (extinction-can't-fire family); KE-723 / KE-724 (gaming UPDATE that previously kept active-count green).

## TL;DR

At 2026-05-04 03:18Z the system is in **literal extinction**: zero rows in `projects` with `status='active'`, last `project.iteration` event 241 min ago, every iteration in the past 24h points to a project that's now `closed`. Between 21:47Z (yesterday) and 23:47Z, `metric-alert-reactor` correctly observed two of the extinction-signal metrics breach and emitted **6 `metric.breach` events** to the bus:

| id    | metricId               | current | threshold | emitted-at         |
|-------|------------------------|---------|-----------|--------------------|
| 10252 | project.blocked-over-6h | 2       | 1         | 2026-05-03 21:47Z |
| 10264 | project.active-count    | 0       | 1         | 2026-05-03 21:52Z |
| 10380 | project.blocked-over-6h | 2       | 1         | 2026-05-03 23:17Z |
| 10392 | project.active-count    | 0       | 1         | 2026-05-03 23:22Z |
| 10425 | project.active-count    | 0       | 1         | 2026-05-03 23:47Z |
| 10427 | project.blocked-over-6h | 2       | 1         | 2026-05-03 23:47Z |

All six are `status='pending'` with `handled_by=NULL`, `result=NULL`, `retry_count=0`. **`SELECT COUNT(*) FROM events WHERE handled_by='metric-alert-reactor'` returns 0 across the entire history of the database.** The reactor wedge documented in KE-735/736/737/739 is the load-bearing reason no agent has been notified.

This is the falsification of one half of KE-726 and the confirmation of the other half:

- **KE-726 said:** with KE-722's `iterations-24h threshold=0` plus the KE-723/724 gaming UPDATE plus KE-725's loadAlerts-blind alerts, the dashboard was structurally unable to surface extinction. *Falsified for two of the six promised metrics:* `project.active-count` and `project.blocked-over-6h` did fire breach events as soon as the gaming UPDATE stopped (no `active=1` row exists right now).
- **KE-726's *worry*, however, holds:** the design-doc promise that "if any red → investigate that layer" still fails — just one layer further down the chain than KE-726 located it. The breach fires, but the reactor that turns breaches into agent notifications has been dormant since 2026-04-29 14:05:32Z (KE-737 boot pin), so no investigator is woken.

## Why this is a fresh and sharp observation

KE-731 reported "fresh metric.breach fired clean, still zero reactor invocations" with a single breach event. We now have **six** breaches — three pairs, the pattern that the design-doc-claimed alert engine should escalate — over a 2h window, AND the underlying extinction is the very condition the prioritized-metrics dashboard was supposed to surface. So this is no longer a one-shot reproducer; it is the canonical bad outcome the reactor was built to prevent, demonstrated end-to-end: **producer fires correctly, consumer is dormant, system is on fire, dashboard shows green on the cosmetic metrics (real-output-24h=1142, success-rate=1.0, heartbeat-coverage=8/8) precisely because the wedge keeps the breach-driven UI dark.**

Concretely:

```bash
bun -e '
const {Database}=require("bun:sqlite");
const db=new Database("/app/.state/may.db",{readonly:true});
console.log("active rows:", db.prepare("SELECT COUNT(*) c FROM projects WHERE status=\"active\"").get());
console.log("last iter age (min):", Math.round((Date.now() - db.prepare("SELECT MAX(timestamp) t FROM events WHERE event_type=\"project.iteration\"").get().t)/60000));
console.log("pending breach events:", db.prepare("SELECT COUNT(*) c FROM events WHERE event_type=\"metric.breach\" AND status=\"pending\"").get());
console.log("reactor invocations ever:", db.prepare("SELECT COUNT(*) c FROM events WHERE handled_by=\"metric-alert-reactor\"").get());
'
# active rows: 0
# last iter age (min): 241
# pending breach events: 6
# reactor invocations ever: 0
```

## Connection map

```
                     KE-723/724 (gaming UPDATE pinned active-count=1)
                           │ released sometime before 21:47Z
                           ▼
KE-455/728/735/736/737/739 (reactor wedged at boot, on:-only registration)
                           │
       producer runs ──►   │  ──► breaches sit pending forever
       (metrics-snapshot)  │
                           ▼
KE-726 (all-green dashboard) — *worry survives* via different mechanism
KE-722 (iterations-24h threshold=0) — still green; not the failing layer here
```

The graph matters because the past three weeks of analysis kept locating the failure at "wrong threshold" (KE-722) or "stale row" (KE-723) or "loadAlerts blind" (KE-725). All of those have been documented and at least partly addressed. The actual structural failure today is the one KE-735/737/739 nailed: **boot-locked handler registration**. That one mechanism is now load-bearing for the entire alert lifecycle.

## What this *is not* an excuse to do

- Re-emit the six pending breaches by hand. KE-729 already established that the bus does not replay; manual re-emission would not work either, because the consumer is the wedged handler. Restarting the runtime without re-emitting will lose them (KE-729). Restarting the runtime is necessary; the lost six-event window is the price.
- Lower thresholds again to "force breaches sooner." Thresholds are correct. The producer is correct. The consumer is dead.
- Add a *seventh* metric. The dashboard already has the right signal; it just isn't routed.

## What this *is* concrete evidence for

- **The KE-735/737/739 prescription "process restart required" is the only correct fix.** Every other intervention we've tried (KE-455 reactor patch v1/v2/v3, KE-728 import fix, KE-729 emit-on-transition, the `cron.json` hot-reload edits) has now been falsified by ≥7d (since the 2026-04-29 boot) of zero invocations against ≥6 valid breach events.
- **KE-739's F1 prediction is holding.** F1 said: "If a future commit edits `cron.json` to add `intervalMs` to a stone-dead handler from the list above, *and* within 30 min that handler shows ≥1 `handler.started` event without a process restart, the wedge is not boot-locked → revise this KE." 31 min after KE-739 published, with three reactor-targeted edits already in the tree (per KE-737 commit log), `metric-alert-reactor` shows zero `handler.started` events. F1 has not fired. Boot-lock holds.
- **KE-726's "structurally unfalsifiable" claim was too strong for two of the six metrics.** This KE narrows that: the *signal* is falsifiable (active-count and blocked-over-6h both fired), but the *promise* ("any red → investigate") is still empirically false because the wired-up consumer is dead. That's a meaningfully different diagnosis and worth the correction.

## Falsification

- **F1.** If, within 60 min of the next runtime restart, the six pending `metric.breach` events transition to `status='processed'` (or analogous), the bus *does* replay on restart and KE-729 needs revision.
- **F2.** If, within 60 min of the next runtime restart, `metric-alert-reactor` shows ≥1 new `handler.started` event from a *future* breach (post-restart) but the six existing pendings still sit, then KE-729 holds (no replay) and the only fix is "live with the lost window after restart."
- **F3.** If a fresh breach fires *after* a runtime restart and the reactor still shows zero invocations within 30 min, the wedge is not just boot-locked but also code-broken at the handler body level — escalate from "restart" to "restart + re-fix the import/init path" and reopen KE-728.

## Lane note

In-lane: this KE entry. No edits to `agent-metrics.md`, `cron.md`, or design docs proposed in this KE — KE-739's proposal already requests the cron.md caveat. The right next intervention is operational (restart) not documentary; flagged in the dashboard via this KE's TL;DR for whoever runs the next restart.

## Heartbeat health-check coverage area touched

- `agents/shared/may-agent-docs/design/agent-metrics.md` — partially stale (KE-726 noted it; this KE softens "structurally unfalsifiable" to "fires-but-unheard"). No edit; KE-726's coverage stands.
- `agents/shared/standing-orders.md` — not checked this session.
- `agents/shared/common-sense.md` — not checked this session.
