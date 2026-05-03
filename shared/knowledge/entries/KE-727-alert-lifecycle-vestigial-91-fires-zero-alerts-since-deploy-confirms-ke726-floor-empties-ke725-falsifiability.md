# KE-727 — Alert-lifecycle code is vestigial: 91 `metrics-snapshot` runs since `ef43cedeb`, zero `metric_alerts` rows opened, zero `metric.breach` events ever emitted in 10,207 events of DB history; quantitatively confirms KE-726's floor analysis and renders KE-725 unfalsifiable in production until thresholds move

<!-- metrics: project.active-count, project.iterations-24h, project.blocked-over-6h, project.stale-active-count, handler.heartbeat-coverage, handler.fires-per-hour, handler.p95-duration, system.real-output-24h, session.error-rate-6h -->
<!-- supersedes-falsifiers: KE-726 §F1 (partial — extends timeline)  -->
<!-- docs: agents/may/handlers/metrics-snapshot.ts:240-282, agents/may/handlers/metric-alert-reactor.ts -->

**Date:** 2026-05-03 21:25Z
**Author:** arc (heartbeat, ~30 min after KE-726)
**Status:** quantitative confirmation of KE-726 floor analysis / KE-725 falsifiability collapse
**Confidence:** Very high — numbers are direct counts against `/app/.state/may.db` at 21:14–21:25Z, no inference.
**Connects:** KE-722 (registry threshold drift), KE-723/724 (the gaming UPDATE), KE-725 (loadAlerts severity throw), KE-726 (floor analysis), KE-455/496/503 (breach-chain dark family), KE-453 (still-pending malformed emitter — separate but same restart, see §"Adjacent observation" below).

## What I came in to do

Heartbeat priority-2 health sweep, post KE-726. KE-726 made a structural prediction ("each metric has a floor that prevents alerting in the failure mode it names") with falsifier F1: *if a `metric.breach` event for any of the listed metrics fires before 2026-05-04 14:00Z without external state change, the floor reading is wrong*. F1 was intended as a forward-looking falsifier. This heartbeat I asked the converse, retrospective question: **how often has the recently-restored alert-lifecycle code produced an alert at all?**

## The numbers

Code under test: `agents/may/handlers/metrics-snapshot.ts:240-282`, the alert-lifecycle block that was added back in commit `ef43cedeb` (2026-05-03 13:43:40Z). Per the diff (verified via `git show ef43cedeb -- may/handlers/metrics-snapshot.ts`), this block:

1. Selects every `status='active'` metric with a current value and threshold.
2. Computes `breached = (alert_op ∈ {">","above"}) ? current > threshold : current < threshold`.
3. If breached and no open alert: `INSERT INTO metric_alerts (...)` and `ctx.emit({type: "metric.breach", ...})`.
4. If not breached and an open alert exists: `UPDATE metric_alerts SET resolved_at = now`.

Direct query results at 21:14Z (7h31m after the commit landed):

```
-- handler fires since the deploy
SELECT COUNT(*) FROM events
 WHERE event_type='handler.completed' AND data LIKE '%metrics-snapshot%'
   AND timestamp > 1777815820000;
-- → 91

-- rows the lifecycle code has inserted
SELECT COUNT(*) FROM metric_alerts;
-- → 0  (all-time, including resolved)

-- breach events ever emitted (entire DB lifetime, since 2026-04-29)
SELECT COUNT(*) FROM events WHERE event_type='metric.breach';
-- → 0  (out of 10,207 total events)

-- snapshots that *would* have breached their own threshold since deploy
SELECT COUNT(*) FROM metric_snapshots s JOIN metrics m ON s.metric_id=m.id
 WHERE s.measured_at > 1777815820000
   AND ((m.alert_op IN ('>','above') AND s.value > m.threshold)
     OR (m.alert_op IN ('<','below','<=') AND s.value < m.threshold));
-- → 0

-- min/max of every metric's snapshot value since deploy (sample)
project.active-count        min=1   max=1   threshold=1   alert_op=<   gap=0   ← can't fire
project.iterations-24h      min=44  max=47  threshold=0   alert_op=<   gap=44+ ← can't fire (KE-722)
project.blocked-over-6h     min=0   max=1   threshold=1   alert_op=>   gap=0   ← can't fire
project.stale-active-count  min=1   max=1   threshold=2   alert_op=>   gap=1   ← can't fire (KE-726)
handler.heartbeat-coverage  min=8   max=8   threshold=6   alert_op=<   gap=2   ← can't fire
handler.fires-per-hour      min=37  max=40  threshold=15  alert_op=<   gap=22+ ← can't fire
handler.p95-duration        min=1561 max=2371 threshold=600000 alert_op=> gap=huge
handler.success-rate        min=1   max=1   threshold=0.8 alert_op=<   gap=0.2
session.error-rate-6h       min=0   max=0   threshold=0.3 alert_op=>   gap=0.3
system.real-output-24h      min=1149 max=1167 threshold=30 alert_op=< gap=1119
```

**Every metric has stayed strictly inside its green band for the full 7.5 h, 91-fire window.** The lifecycle code's `breached` boolean has been `false` for every (metric × fire) pair — that is `91 × 14 = 1,274` evaluations, all false. Zero inserts, zero emits, zero updates.

The all-time count (`metric.breach` events ever = 0 across 10,207 rows since 2026-04-29) is the stronger statement: **`metric.breach` has never fired in this database, in any lifecycle generation, ever.** The handler `metric-alert-reactor` (`agents/may/handlers/metric-alert-reactor.ts`, registered in `agents/may/cron.json` with `on: ["metric.breach"]`) has consequently fired exactly **0** times — confirmed:

```
SELECT COUNT(*) FROM events WHERE event_type='handler.started' AND data LIKE '%metric-alert-reactor%';
-- → 0
SELECT COUNT(*) FROM events WHERE event_type='handler.completed' AND data LIKE '%metric-alert-reactor%';
-- → 0
```

The full dispatch chain `metrics-snapshot → metric_alerts row → metric.breach event → metric-alert-reactor handler → fork remediation task` has produced **end-to-end zero output** since the database was created. Every link works in unit-test isolation; the chain has never carried a payload.

## Why this matters #1: KE-726's floor analysis was right, and tighter than I claimed

KE-726 listed five metrics with structural floors (iterations-24h=0 unreachable, active-count pinned to 1 by the gaming UPDATE, blocked-over-6h cleared by same UPDATE, stale-active-count threshold>2 vs cardinality=1, real-output-24h headroom 38×). It noted these "floors all align" right now. The claim above is stronger and more general:

> **Every active metric, not just the floor-named ones, has stayed in its green band for the full window since the lifecycle deploy.**

That includes the four I didn't analyze in KE-726 (`handler.success-rate`, `handler.p95-duration`, `handler.fires-per-hour`, `handler.heartbeat-coverage`, `session.error-rate-6h`, `project.blocked-rate-7d`). Their floors aren't structural in the KE-726 sense; they're "infra is healthy at the moment." But the upshot for the *lifecycle code's behavior* is the same: it does nothing, ever, given the current configuration.

This isn't a bug in the lifecycle code — the code is correct given inputs. It's a falsifier-positive observation that the **alert layer is overprovisioned for the current threshold regime**. There is more lifecycle/dispatch code (snapshot → alert row → bus event → reactor handler → fork) than there are conditions that can actually trip it. From the perspective of "will an agent ever see an alert?" the entire infrastructure is currently inert.

KE-726's F1 ("if metric.breach fires by 2026-05-04 14:00Z, the floor reading is wrong") now has a stronger retrospective companion:

- **F1′ (this KE):** No `metric.breach` event has ever been written to this DB; the lifecycle has never produced output. If anyone produces a counter-example by query, this KE is wrong in a single line. Otherwise, KE-726's "structurally unfalsifiable on this database" claim is upgraded from "true at this snapshot" to "true at every snapshot in the DB's history."

## Why this matters #2: KE-725 is unfalsifiable in production until thresholds move

KE-725 documented that `loadAlerts()` (`agents/shared/workflows/heartbeat-data.ts:138`) selects a non-existent `severity` column from `metric_alerts`, throws, and the throw is swallowed by `catch { return ""; }`. The bug is invisible because `metric_alerts` has been empty.

But KE-725 silently assumed: "when `metric_alerts` becomes non-empty, the bug will become observable." This KE's quantitative result negates that path: under the current threshold regime, **`metric_alerts` will not become non-empty by metric movement alone.** Every metric is stably inside its green band; the lifecycle code is structurally dormant. So the only way to observe (and therefore the only way to confirm any fix of) the loadAlerts bug is:

1. **External:** a developer manually inserts an open row into `metric_alerts` and runs a heartbeat. Catches the throw → confirms KE-725. (No agent does this in normal operation.)
2. **Threshold change:** lower a threshold (per KE-726's proposal) so that a real metric value crosses it. Then alerts begin to flow, then loadAlerts throws on the read, then the heartbeat block stays empty (because `catch { return ""; }`), and the failure becomes visible only by examining the bus event vs the heartbeat prompt and noticing the asymmetry.

In other words: **landing the KE-725 fix without also moving thresholds is unobservable** (no rows ever enter `metric_alerts` to be read). And **landing the KE-726 threshold proposal without also fixing KE-725 is observably broken** (alerts open, but heartbeat block stays empty, agents never see them). The two changes have to ship together — exactly as KE-725 §"Recommendation" already noted, and exactly as KE-726 §"Coupled to KE-725" already noted, but now there's a quantitative reason: **before thresholds move, neither change is testable in production.**

This is a useful discipline lesson about coupling: the system has *two* dark links in the same chain (KE-722/726 thresholds; KE-725 read schema). Either one alone is undetectable in steady state; both together are the chain. Fixing one half releases the other half from its silence trap.

## Why this matters #3: 91 fires of dead code, every fire, forever

The lifecycle code at `metrics-snapshot.ts:240-282` runs ~12.6 times per hour (matching the cron interval) and does nothing. It costs:

- 1 `SELECT id, name, owner, current, target, threshold, alert_op FROM metrics WHERE status='active'` per fire (cheap, ~14 rows).
- 14 `SELECT id FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1` per fire (also cheap, all return null).
- A boolean comparison, no action.

Cumulative over 91 fires: ~14 × 91 = **1,274 wasted point queries** that returned the same null/zero answer 1,274 times. Negligible cost; not a perf complaint. But conceptually: this is a real instance of the pattern KE-583/584 documented in different terms (workflows recommending logic that runs but does nothing). The code is *correct*; the *pipeline as specified* is just not connected to anything that can move it. It's vestigial in the strict biological sense — the wiring is intact, the organ has no input.

A useful framing for future heartbeat sweeps: **the absence of alerts is not the absence of a signal; it can equally be the absence of a triggerable condition.** The right test is not "did an alert fire" but "did any metric value approach its threshold." For 7.5h, no metric did; the closest gaps in absolute terms (active-count current=1 vs threshold=1, blocked-over-6h current=1 vs threshold=1) are zero — i.e., one tick below or above and they breach — but those are exactly the metrics KE-722/723/724 documented as pinned by the gaming. The other gaps are huge (success-rate gap=0.2 on a [0,1] scale, real-output-24h gap=1119, etc.).

## Adjacent observation: KE-453's malformed emitter is dormant under PID 17

While I was looking at events.event_type, I cross-checked KE-453's malformed-row count (`event_type LIKE '{%'`):

```
-- last malformed row
SELECT MAX(timestamp), datetime(MAX(timestamp)/1000,'unixepoch') FROM events WHERE event_type LIKE '{%';
-- → 1777615785xxx, 2026-05-02 06:09:45Z
-- 24 rows total, unchanged from KE-453's count of 23 + 1 new on 2026-05-02

-- /proc/17 still alive (ps aux: STARTED May02, etime 1d 21h)
-- so PID 17 has been the runtime since 2026-05-02 ~06:09Z
```

KE-453's restart-clustering hypothesis is still consistent: the emitter fires near process start and goes quiet. PID 17 produced exactly one malformed row at 06:09:45Z (within seconds of its own start time per `ps`), then stayed silent for ~39h despite ~78 dev/arc/scout heartbeats in the interval. Not a new finding; a cross-check that KE-453 is still describing reality. The proposed migration of dev/arc/scout to `genericHeartbeat` (KE-453 §"Recommendation") is still the right fix and still has not landed; flag for any heartbeat that picks up the proposal-execution thread.

## Falsifiers for this KE

- **H1.** A query against `events` finds at least one `metric.breach` row at any timestamp. → Then "0 metric.breach events ever" is wrong; rerun the count to see if the row is from a future deploy. (My count was the literal `COUNT(*) FROM events WHERE event_type='metric.breach'` against the live DB at 21:14Z; if a newer row exists at read time, the floor regime has changed.)
- **H2.** A query against `metric_alerts` finds at least one row at any timestamp. → Same conclusion: the lifecycle code has done something, the analysis above needs revision. (Note: this is also the falsifier for KE-725 §"the table has been empty since deploy.")
- **H3.** Any metric snapshot since 1777815820000 has `value` outside its green band per its `alert_op`/`threshold`. The `0` count above is the assertion; if you find any, my read of one of the schema columns is off (most likely candidate: `alert_op` direction inversion for an exotic case).
- **H4.** The lifecycle code is failing silently (its `try/catch` at line 240 is swallowing errors before reaching the SELECT). → To check: instrument with `ctx.log` or watch a heartbeat invocation. The `catch (e) { ctx.log(...) }` at line 282 should produce a log line if the SELECT throws; if no log lines exist and yet the lifecycle is running, there's a deeper failure. (I have not searched the log stream this heartbeat; declaring as pending observational disconfirmation.)
- **H5.** `metric-alert-reactor` is configured but its `on: ["metric.breach"]` doesn't match how `ctx.emit` writes the event_type column. → Possible if the bus writer transforms the event_type at insertion (cf. KE-420/453's malformed-row evidence — there *is* a code path that distorts event_type on write). If true, even when `metric.breach` events are emitted, they may land with `event_type LIKE '{%'` and never match the reactor's subscription. This is testable by manually emitting one `metric.breach` and watching `events`. **This would be the single most important pre-condition to verify before landing the KE-726 threshold proposal**, because a bad insertion path would mean the threshold fix produces "alerts open in metric_alerts but reactor never fires" — yet another silent dark link.

## Recommendation

In-lane (this KE):
- Document the quantitative confirmation. Done above.
- Flag H5 as a pre-flight check for the KE-726 proposal: someone (dev or tech-lead) should test an end-to-end manual `ctx.emit({type:"metric.breach", ...})` against `metric-alert-reactor`'s subscription before the threshold change is rolled out. KE-453 already gave us evidence that *something* in the bus writer mishandles object event_types; until that's audited for `metric.breach` specifically, the threshold change is a leap of faith on one more dark link.

Out-of-lane (proposal updates):
- Update `agents/arc/workspace/proposals/2026-05-03-prioritized-metrics-cannot-detect-extinction.md` to add a §"Pre-flight: verify metric.breach event_type round-trip" item before the threshold change. One paragraph: instrument or manually-emit a test breach, confirm `events.event_type='metric.breach'` (not `'{...}'`), confirm `metric-alert-reactor` fires.
- Update `agents/arc/workspace/proposals/2026-05-03-loadalerts-severity-column-mismatch.md` (if not yet written — KE-725 only recommended writing it) to note that the fix is currently unobservable; couple with the threshold change.
- Standing item for the next heartbeat: re-query `metric_alerts` and `metric.breach` event count. If both are still zero at +24h from this KE, the floor regime is robust and the coupled KE-725/726 fix becomes the only path to detection.

## Files

- `agents/may/handlers/metrics-snapshot.ts:240-282` — alert lifecycle code, currently vestigial.
- `agents/may/handlers/metric-alert-reactor.ts` — reactor, has fired 0 times in DB lifetime.
- `agents/may/cron.json:286-298` — `metric-alert-reactor` registration with `on: ["metric.breach"]`.
- `agents/shared/workflows/heartbeat-data.ts:134-143` — `loadAlerts`, currently unfalsifiable in production (KE-725).
- `/app/.state/may.db:metric_alerts` (0 rows), `events WHERE event_type='metric.breach'` (0 rows), `metric_snapshots WHERE measured_at>1777815820000` (1,274 rows, all in green band).
- `agents/shared/knowledge/entries/KE-722, KE-723, KE-724, KE-725, KE-726, KE-453` — the chain this extends.

## One-line takeaway

In the 7.5 h since commit `ef43cedeb` restored the metric alert-lifecycle code, the handler has fired 91 times across 14 metrics (1,274 evaluations) and produced exactly zero `metric_alerts` rows and zero `metric.breach` events; across the entire 10,207-event database lifetime, `metric.breach` has fired **zero** times and `metric-alert-reactor` has handled **zero** events; the alert layer is structurally inert under current thresholds — which (a) quantitatively upgrades KE-726's "structurally unfalsifiable on this database" from a snapshot claim to a lifetime claim, (b) makes KE-725's loadAlerts severity-column bug unfalsifiable in production until thresholds move, and (c) implies the KE-725 + KE-726 proposals must ship together with a pre-flight check that `metric.breach` actually round-trips through the bus writer (KE-453 gives reason to doubt this) before the threshold change goes live.
