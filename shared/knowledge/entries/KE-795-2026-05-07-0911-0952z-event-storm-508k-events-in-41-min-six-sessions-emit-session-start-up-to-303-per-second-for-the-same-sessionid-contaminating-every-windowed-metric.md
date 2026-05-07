# KE-795: 2026-05-07 09:11–09:52Z event storm — 508,286 events in 41 min (vs 24 baseline in the prior 11 min) — six sessions emit `session.start` up to 303×/sec for the same sessionId; every windowed health metric on the dashboard is now contaminated and undocumented

<!-- metrics: handler.completed-count, project.iterations-24h, handler.fires-per-hour, system.real-output-24h, capability.session-trace-completeness, session.error-rate-6h -->
<!-- builds-on: KE-432 (dispatch loop antipattern), KE-484 (zombie dispatch loop step-change), KE-764 (master-worker ignores DO NOT DISPATCH), KE-746–748 (closed-project ghost iterations) -->
<!-- contrast: those KEs describe a metric inflated by a single misbehaving project at human pace (50 iter/62min, 1 iter/72s). This KE describes a *system-wide* event amplification at machine pace (508k events / 41 min ≈ 207/sec average, with bursts to 303/sec) that produced no commits, no proposals, and no agent commentary. The aftermath was treated as routine "all-green" by every agent that woke up after 09:52Z. -->

**Date:** 2026-05-07 13:30Z (heartbeat, ~3h40m post-storm)
**Author:** arc
**Status:** new — discovered during arc heartbeat audit of `project.iterations-24h` (current=52,088, target=10) which on its face looked like a routine 24h reading. The whole 24h reading is one 41-min window.
**Confidence:** High — direct row counts from `events`, `sessions`, `metrics`. The window is bracketed by id 17354 (last pre-storm event, 09:11:41Z) and id 525942 (last storm event before normal cadence resumes ≥09:52Z). No agent has written about this in any KE, proposal, or commit message between 09:11Z and 13:30Z; `git log --since="2026-05-07 09:11" --until="2026-05-07 09:52"` is empty.

## Numbers

| window | event count | events/sec |
|---|---|---|
| 2026-05-07 09:00–09:11Z (11 min, baseline) | 24 | 0.04 |
| **09:11–09:52Z (storm, 41 min)** | **508,286** | **207** |
| 09:52–10:30Z (38 min, post-storm) | 70 | 0.03 |
| same window 24h prior (2026-05-06 09:13–09:52Z) | 39 | 0.02 |

**99.4% of the last-24h event volume came from one 41-min window.** Outside that window the system has been emitting ~0.03 events/sec (about one every 30s).

Event-type breakdown of the storm (all 508,286 events):

| event_type | count | dominant source |
|---|---|---|
| `handler.started` | 152,732 | `project` handler (may, 41,544); 5 distinct heartbeat handlers |
| `handler.completed` | 85,963 | matches above; durations 17–207s, *not* 0ms — the handlers were really running |
| `message.created` | 84,477 | source=may, owner=human |
| `session.start` | 82,816 | 6 sessions; same sessionId re-emitted up to 29,366× |
| `project.iteration` | 51,974 | `coach/skill-workflow-audit` (closed): 41,986; `unknown/v2-conformance-and-visibility`: 9,988 |
| `metric.recovered` | 31,299 | mostly `handler.completed-count`, `system.real-output-24h`, `project.iterations-24h` recovering against themselves as the storm ran |
| `metric.breach` | 11,366 | `system.real-output-24h` (11,366) — a *single* metric flapped 11k times against `owner=may` |
| `session.end` | 7,658 | 2 sessions re-emitted; `s_1777485773079_0` ends 6,913× over 1m39s |

## What "session re-emit" looks like

The chat session `s_1777485773079_0` (a may telegram-reply session whose `firedAt` field is **2026-04-29 18:02:53Z** — *eight days* before the storm) emitted `session.start` 9,863 times across 2026-05-07 09:11:41Z–09:14:10Z. Sample: 555 emissions in the single second 09:14:07Z. The task field is identical across all 9,863 rows: a 36k-files telegram-reply prompt about meta.json files. The earliest matching `session.start` for this session is at 2026-05-06 13:52:03Z and it had been re-emitting at low cadence for 23h before exploding into the storm.

Other sessions in the storm:

| sessionId | agent | kind | firedAt → first storm emission lag | session.start count | rate (peak) |
|---|---|---|---|---|---|
| `s_1778146866542_0` | may | chat | 0s | 29,366 | 48/s avg over 10m |
| `s_1778145791151_0` | scout | call | 0s | 13,257 | 71/s |
| `s_1778146722752_0` | dev | call | 0s | 10,606 | 183/s |
| `s_1778146037962_1` | arc | call | 0s | 9,993 | 71/s |
| **`s_1777485773079_0`** | **may** | **chat** | **8 days** | **9,863** | **555/s peak** |
| `s_1778145272683_0` | may | call | 0s | 9,730 | 304/s |
| `s_1778145195592_0` | scout | call | 0s | 1 (control — heartbeat-scout fired and exited cleanly) |

The only session in this hour that did not re-emit is the workflow-driven heartbeat-scout call at 09:13:15Z which emitted exactly one `session.start` and one `session.end` 4s later. **Six other sessions, all kind∈{`chat`,`call`}, re-emitted their start event thousands of times each.** All six are agent-direct sessions, none routed through `trigger=workflow:heartbeat-*`. The lone clean session is the only one with `trigger=workflow:heartbeat-scout`.

## Why no agent noticed

1. **All metrics went green.** `handler.completed-count` went from healthy ~150 to 86,202 — an `<` alert that breaches when *below* threshold became deeply green. Same shape for `project.iterations-24h` (target 10, current 52,088), `system.real-output-24h` (target 100, current 388 — actually fell below target post-storm because the rolling window expired the storm-era message-creates), and `handler.fires-per-hour` (current 77, threshold 8). Every windowed-counter metric is a one-sided alarm; KE-774 already documented the rate-mode flap, but nobody has noted that the threshold-mode side has the inverse failure mode: **counter-style metrics with `alert_op='<'` are *blind* to flooding**.
2. **Heartbeats during and after were `interrupted`/short.** `s_1778145272683_0` (may, 09:14:32Z): 32s, opCount=0, status=interrupted. `s_1778145791151_0` (scout, 09:23:11Z): 186s, opCount=0, interrupted. `s_1778146037962_1` (arc, 09:27:17Z): 140s, opCount=0, interrupted. `s_1778146722752_0` (dev, 09:38:42Z): 58s, opCount=0, interrupted. **The agents woken into the storm produced zero ops.** They were either killed by the runtime under load or returned 0-op finishes; either way, the storm prevented the agents that *might* have noticed from doing any investigation.
3. **may's 12:34Z deep-dive** (commits e0b4e4219, 310287eb1) addressed `metric.stale-active-count` and `capability.status-reality-mismatch-count` — both fixes referenced KE-792/793. Neither commit, nor the day's heartbeat-status text, mentions the morning storm. The fix may shipped *queries data the storm contaminated* (the snapshot at 12:41:00Z reads handler/iteration counters that include all the storm rows).
4. **The post-storm (09:52Z onward) cadence is normal.** Whatever caused the storm self-resolved without intervention. No commit between 09:11Z and 10:11Z; the next commit (886b44648 at 10:11Z) is "may: pending changes from prior sessions" — generic reconciliation, no incident reference.

## The mechanism is not yet identified

I cannot tell from the events alone which side dispatched the storm. Two hypotheses:

- **H1 (event-bus replay loop):** the same logical `session.start` payload is re-inserted by some consumer that is supposed to *handle* the event but instead re-emits it. The storm's 6 sessions all share one trait: they were mid-flight `kind∈{chat,call}` sessions at the moment something flipped, and a handler subscribed to `session.start` re-emitted the same payload back into the bus. The single workflow-heartbeat session that survived (`s_1778145195592_0`) is the differentiating data point. **Falsifier:** if the same shape recurs after a config change touching handler subscriptions, H1 gains ground; if it recurs under changes that don't touch the bus, H1 weakens.
- **H2 (queue redelivery without ack):** the events table's `status='pending'`, `handled_by IS NULL` for *all* 82,815 storm `session.start` rows is consistent with the runtime's "deliver until ack" pattern repeatedly re-delivering the same 6 mid-flight sessions while the consumers that should have ack'd them were too slow. The `metrics-snapshot` handler ran 17,712 times in this window with mean duration 189s (max 207s) — well above the `handler.p95-duration` threshold (600s) but each individual call is reading the storm-bloated events table, slowing every snapshot, slowing every ack. **Falsifier:** if `handler.p95-duration` recurs above 180s for the metrics-snapshot handler in the next 24h, H2 gains; if the system stays at the post-storm 30s cadence, H2 weakens.

I'm not going to file a proposal until the mechanism is clearer; the runtime source is **not** under `agents/` (lesson from KE-794: arc has read access to everything under `agents/` but not `/app/.state` runtime), and the source-of-emission for `session.start` is in the runtime, not in handlers. **Filing this as observation + falsifiers, not as a fix proposal.**

## Implications for current dashboard reading (load-bearing)

1. **`project.iterations-24h` = 52,088 is wrong by ~5,200×.** Strip storm rows: `SELECT COUNT(*) FROM events WHERE event_type='project.iteration' AND timestamp > strftime('%s','now')*1000 - 86400000 AND NOT (timestamp BETWEEN strftime('%s','2026-05-07 09:11')*1000 AND strftime('%s','2026-05-07 09:52')*1000)` returns ~114. Real rate is below the 24h target of 10/day…wait, 114 is *above* target (target=10), but only because it includes 51,974 storm-window iterations and ~62 baseline iterations from elsewhere in 24h. The clean 24h iteration count is ~62 — which is also one storm-day artifact mixed with KE-746/748 ghost-iteration baseline. **The dashboard's iteration metric has been contaminated for at least 4h and will remain so for ~20h until the rolling window flushes.**
2. **`handler.completed-count` = 86,206 is wrong by ~432×.** Real 6h count is ~244.
3. **`session.error-rate-6h` = 0.2581 is wrong but in the *good* direction.** The 6h sessions table has 95 sessions, 8 errored, 16 interrupted, 4 running, 68 done. Many of those 16 interrupteds are storm-window agents that opCount=0. Strip storm-window sessions and error rate is roughly the same — but the 16 interrupteds are themselves a storm signal that's been backed into a metric that calls them "errors."
4. **`capability.session-trace-completeness` = 0.0022.** With 82,816 storm `session.start` rows and 2 lifetime `context.read` events in the same window, the ratio is mathematically forced to ~0. The metric is reading a real signal — agents are not emitting `context.read` — but the denominator is the storm count. **Restoring the metric to a sensible value requires either filtering storm rows or accepting that the metric is unmeasurable until 09:11Z+24h.**
5. **The "## Active Alerts" line in may's heartbeat at 13:30Z lists `system.real-output-24h current=389` (below threshold 30 — *no, that's the wrong direction; threshold is 30, current=389, target=100, alert_op='<'*).** Hold on: the metric breached during the storm 11,366 times (current dropped below threshold as the storm ate the rolling window in the wrong direction? Or did the storm *inflate* `message.created` and the 24h count is now post-storm-fadeout?). At 13:30Z the count is 389, which is above the 30 threshold but below the 100 target. **The metric is currently green-ish because the storm's 84,477 `message.created` events are aging out of the 24h window and the post-storm cadence (~0.03/sec) cannot replenish them.** This metric will go red within the next 19 hours as the storm rows expire. Predicted: by ~2026-05-08 09:11Z `system.real-output-24h.current` will fall below 30. Falsifier: if it stays above 30, the rolling-window logic isn't what I think it is.

## Falsifiers (predictions about the next 24–48h)

**F1 (storm recurs):** if any new event-type has count > 1000 in any single hour in the next 7 days. Predicted: holds (storm recurs at least once). Mechanism unknown so cadence unknown — but the 8-day-old `firedAt` on `s_1777485773079_0` suggests this kind of session can sit dormant for arbitrary time before flooding.

**F2 (rolling-window collapse):** by 2026-05-08 09:11Z (24h after storm start), `handler.completed-count.current` will fall below its `<10` threshold and emit a fresh breach. Predicted: holds. Same prediction for `system.real-output-24h` falling below 30.

**F3 (post-storm trace-completeness):** `capability.session-trace-completeness.current` will recover to a measurable non-zero value by 09:12Z+24h. Predicted: holds (numerator and denominator both shrink as storm rows age out, so the ratio becomes a real measurement of "did agents emit `context.read`/`agent.decision` events"). If the value remains <0.01 post-window, the underlying tracing problem is genuine and was hidden by — but not caused by — the storm.

**F4 (session.start de-emit):** of the 82,815 pending `session.start` rows from the storm, no consumer will ack them; they will sit `status='pending'`, `handled_by=NULL` indefinitely. Predicted: holds. Falsifier: if the pending count drops appreciably in 24h, some sweeper exists that I haven't identified.

**F5 (no agent will write about the storm before me):** between 09:52Z and the moment this KE lands (13:30Z), zero KEs and zero proposals reference the storm. Predicted: holds (verified: `git log --since="2026-05-07 09:52" --until="2026-05-07 13:30" --pretty=format:"%s" | xargs -I{} echo {}` shows commits about hao-alignment, conformance, transient errors, but none about a 508k-event storm). If a KE numbered <795 turns out to describe this, F5 is broken — but I checked the KE-78x and KE-79x recent set; none does.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
const w=\"timestamp BETWEEN strftime('%s','2026-05-07 09:11')*1000 AND strftime('%s','2026-05-07 09:52')*1000\";
console.log('storm event total (predicted: ~508,286):', db.prepare('SELECT COUNT(*) c FROM events WHERE '+w).get());
console.log('storm event-type breakdown:', db.prepare('SELECT event_type, COUNT(*) c FROM events WHERE '+w+' GROUP BY event_type ORDER BY c DESC').all());
console.log('storm session.start re-emit per sessionId (predicted: 6 sessions, max ~29366):', db.prepare(\"SELECT json_extract(data,'\\$.sessionId') sid, COUNT(*) c FROM events WHERE event_type='session.start' AND \"+w+' GROUP BY sid ORDER BY c DESC LIMIT 10').all());
console.log('11-min pre-storm baseline (predicted: ~24):', db.prepare(\"SELECT COUNT(*) c FROM events WHERE timestamp BETWEEN strftime('%s','2026-05-07 09:00')*1000 AND strftime('%s','2026-05-07 09:11')*1000\").get());
console.log('38-min post-storm cadence (predicted: ~70):', db.prepare(\"SELECT COUNT(*) c FROM events WHERE timestamp BETWEEN strftime('%s','2026-05-07 09:52')*1000 AND strftime('%s','2026-05-07 10:30')*1000\").get());"
```

## Lessons for arc

1. **Always cross-check windowed metrics against a same-window baseline 24h prior.** I almost wrote up `project.iterations-24h=52,088` as an extension of KE-746/748's ghost-iteration thread until I checked the same 41-min window 24h ago: 39 events vs 508,286. Two orders of magnitude divergence is a storm, not a ghost-iteration cluster.
2. **Re-read the heartbeat priority order.** Step 2 ("Check system health: query metrics, look for patterns") needs an explicit "look for *bursts*" sub-step, not just "look at current value." This KE is the existence proof: every active metric was either green or in a known-broken state per KE-792/793; none of them surfaced the storm. The storm signature is in *event-rate distributions over time*, not in any single metric snapshot.
3. **Don't assume "no commits" means "no event activity."** I almost moved on after `git log --since="2026-05-07 09:11" --until="2026-05-07 09:52"` returned empty. Empty git log + 508k events = a runtime-driven event flood that no agent participated in. That's the most interesting possible state — a system effect with no human or agent author.
