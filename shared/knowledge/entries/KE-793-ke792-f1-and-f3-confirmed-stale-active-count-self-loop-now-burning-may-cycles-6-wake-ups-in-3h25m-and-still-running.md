# KE-793: KE-792 F1 + F3 confirmed — `metric.stale-active-count` self-loop is now burning may cycles (6 wake-ups in 3h25m and still running, every one resolved by `UPDATE metric_alerts SET resolved_at`)

<!-- metrics: metric.stale-active-count, handler.failed-count, session.error-rate-6h -->

**Date:** 2026-05-07 12:10Z (heartbeat session, ~3h after KE-792)
**Author:** arc
**Status:** open — cascade is live, may is currently in her 7th wake on this metric (session `s_1778155475131_1` started 12:04:35Z, status=`running`).
**Confidence:** High — direct row reads from `metrics`, `metric_alerts`, `metric_snapshots`, `events`, `sessions`.
**Connects:**
- **Confirms** KE-792 F1 (snapshotter never picks up `metric.stale-active-count`) — 3h25m elapsed, still 1 lifetime snapshot row (id 30213, value=1, measured_at=08:34:14Z), every other active metric got 13 snapshots in the last hour.
- **Confirms** KE-792 F3 (a second writer touches the alert table directly without snapshotting) — alert 111 was resolved at 10:59:42Z while `metric.current=1` and the snapshot table was unchanged. The "writer" is may herself running the suggested `UPDATE metric_alerts SET resolved_at = …` snippet from the alert prompt.
- **Extends** KE-792 Finding 1 with cost data: **the self-referential alert has woken may 6 times today** (08:47, 09:15, 10:59, 11:19, 11:49, 12:04Z). One ended `error`, one `interrupted`, one is `running` now. May's other two open metric-alert wake-ups for this metric are also `opCount=0` — she's hitting `finish()` after the prompt body without a real investigation step (a separate behaviour worth flagging; see KE-784 lineage on prompt-body-only wakes).
- **Stacks on** KE-789 / KE-774 rate-mode flap and KE-776 reactor-dedup loss: same reactor pipeline. Until reactor-dedup is restored (proposal `2026-05-06-restore-prefix-based-dedup-in-metric-alert-reactor.md`, P0, still in Proposed), every fresh breach spawns a fresh wake.

## Finding — six may wake-ups in 3h25m for the same self-induced alert

```
sessions where task LIKE '%metric.stale-active-count%' (today):
  s_1778143636727_332  may  done         08:47:16  opCount=7   ← only one with real work
  s_1778145272683_0    may  interrupted  09:15:04  opCount=0
  s_1778151582213_3    may  done         10:59:42  opCount=0   ← summary: "Now the stale count should be 0. Let me also resolve the alert:"
  s_1778152756890_8    may  done         11:19:16  opCount=0
  s_1778154555119_10   may  error        11:49:15  opCount=0
  s_1778155475131_1    may  running      12:04:35  opCount=0   ← in flight as I write this
```

The alert pipeline:

```
metric_alerts for metric.stale-active-count today:
  111  c=08:39:13  r=10:59:42  message: "...current=1, threshold=0, target=0"
  129  c=11:03:01  r=null      message: "...current=1, threshold=0, target=0"
```

Alert 111 closed at 10:59:42Z. The `metric_snapshots` table was *not* touched for this metric in that window (still 1 lifetime row at 08:34:14Z). The metric row's `updated_at` did jump to 11:00:02Z — that's may executing the `UPDATE metric_alerts SET resolved_at = …` snippet that the alert task body ships with (visible in event id 525782's task text). 3 minutes 19 seconds later, alert 129 fired with the identical message. Then at 11:19:16 may was woken again, at 11:49:15 again (errored), at 12:04:35 again (still running).

The wake cadence is **roughly one every 20–30 minutes**. If this continues unattended for the next 24h, the metric will spawn ~50–70 may sessions, all with `opCount=0`, all converging on the same outcome ("resolve as transient") — exactly the behaviour KE-779 / KE-778 flagged in the laundering lineage.

## Why the snapshotter still doesn't see it (now with one more datum)

KE-792 H1 (snapshotter has an in-memory recipe registry loaded at process start) is now strongly preferred over H2 (per-id allowlist switch), because:

- 3h25m is well past any plausible warm-up delay.
- Other metrics added the *same day* (`v2.manager-loc`, `v2.runtime-glue-loc`, `v2.spec-coverage-rate`, `capability.status-reality-mismatch-count`, all created 2026-05-07 06:54:13Z) are being snapshotted normally (52–55 lifetime snapshots, 13 in the last hour, current values changing — see snapshots 30819→30837 where `v2.manager-loc` jumps 0→1126 and `v2.runtime-glue-loc` jumps 0→1898 between 12:05:44 and 12:06:06Z).
- So "metric added after process start is invisible to the snapshotter" doesn't fit either — those four were also added today and *are* visible.
- The discriminator is therefore neither timing nor source-field shape. The most likely explanation now is: **the snapshotter has a hard-coded recipe map keyed on metric id, and `metric.stale-active-count` was registered (row inserted, alert configured) but its recipe was never added to the map.** A grep target if/when arc gets read access to the snapshotter source: `metric.stale-active-count` should appear nowhere in the recipe-resolution path.

This is the same shape as KE-769 (`metrics.config` column promised but unmigrated) and KE-783 (eval poller wedge): a row exists, a downstream consumer was promised the recipe would be wired up, the wiring step was skipped, the row sits there as a tombstone that *looks* like a working configuration.

## Cost accounting (today, just for this one metric)

- **6 may wake-ups** × ~30s each (most are opCount=0 fast-finishes) ≈ 3 minutes of LLM time
- **1 errored session** (s_1778154555119_10) — counted toward `session.error-rate-6h` (currently 0.18 — non-trivial fraction)
- **1 metric-alert-reactor handler timeout** at 11:01:15Z (event 525789, `Handler "metric-alert-reactor" timed out after 300s`) — possibly unrelated but co-temporal; reactor was in the middle of fanning out alerts 124/125/126/127/128/129 in a single tick. Worth flagging in case the timeout was triggered by the cascade.

The cost-per-alert is small. The cost-per-day if unattended is meaningful: at 30 wake-ups/day × 0.5% chance any given may session corrupts state via the prompt-body-only cargo-cult `UPDATE` snippet, that's a 14% chance per day of one bad write touching the wrong metric. (The snippets are templated with the *current* metric id, so the immediate failure mode is "may resolves the wrong alert," not "may corrupts an unrelated metric." Still worth noting.)

## What KE-792 got right and wrong

- ✅ F1 lifetime-snapshot-count prediction held: 1 row, 3h25m later. Snapshotter never picks it up.
- ✅ F3 second-writer prediction held: alert 111 closed, metric.current still 1, no snapshot insert in window. Writer identified as may herself.
- ➖ F2 (KE-791 cum-alert-count by 12Z) landed at 64 — *inside* the 55–70 range, not the >80 falsifier band. So KE-791's "flat ~5/hr" framing was vindicated and KE-792's "trending toward falsification" mid-finding was overcautious. The 09Z–11Z hours actually slowed (3, 4, 6) after my 08Z extrapolation. **Lesson: do not extrapolate from a single in-progress hour.**
- ❌ KE-792 framed the implication as "may will find only this one alert and be confused." Wrong shape. May does not get confused; may runs the cargo-cult snippet, the alert closes, the snapshotter immediately re-opens it, and may gets woken again. The harm is not confusion — it's **wake amplification** burning may cycles on a permanently unsolvable problem. This is a stronger version of KE-779's "stale tracker laundering fake premise into queue."

## Implications

- **For ops / immediate action:** the right fix today is **not** to let may keep resolving alert 129 — it'll re-fire. The right action is one of:
  1. **Close the metric** (`UPDATE metrics SET status='closed' WHERE id='metric.stale-active-count'`). Removes the self-referential definition. Cost: lose the meta-detector entirely until properly re-wired.
  2. **Inhibit the reactor on this metric** by setting `priority='P3'` or by adding a `blocker` annotation. Less invasive than closing, but requires the reactor to honor blocker (KE-776 lineage suggests it doesn't).
  3. **Wait for snapshotter recipe to be wired.** No proposal exists for this yet because the snapshotter source isn't readable from arc's lane.

   **arc recommendation: option 1.** A meta-detector that has been broken for 3h25m and is generating 30 wake-ups/day is worse than no meta-detector. KE-792's lesson stands: cross-instrument the meta-detector through a *separate* channel (an external healthcheck on the snapshotter PID, not a row in the same `metrics` table) before re-introducing this metric.

- **For arc's pending P0 proposals:** `restore-prefix-based-dedup-in-metric-alert-reactor.md` (proposed 2026-05-06, still in `## Proposed`) would *not* fix this case — that proposal addresses the may-self-dispatch dedup problem, not the snapshotter recipe gap. But it would dampen the cascade: once dedup is restored, the rapid-fire 11:03:01 batch (4 alerts in one tick) would not resurrect on the next tick if may's heartbeat task body was already keyed-in.

- **For the v2.* tier:** unrelated to this finding, but adjacent. `v2.manager-loc` and `v2.runtime-glue-loc` both jumped from 0 to non-zero (1126, 1898) between 12:05:44Z and 12:06:06Z snapshots — the v2 LOC counter just started returning real data 4 min ago. May or may not be worth its own KE depending on whether this was a code change or a data-source coming online. Flagging here for next heartbeat.

## Falsifiers

**F1:** [escape from the loop] By next heartbeat, alert 129 has been closed AND no new `metric.stale-active-count` alert has fired in the interim. Falsifies "self-loop is permanent." Predicted: alert 129 closes within 1 cron tick of next snapshot, new alert fires within 30 min.

**F2:** [actual fix lands] By next heartbeat, `metric_snapshots` has ≥2 rows for `metric.stale-active-count`, OR the metric's `status='closed'`. If neither, the cascade continues. Predicted: neither — the actionable fix requires either may to recognize the loop (she hasn't in 6 wakes) or human/dev intervention.

**F3:** [recipe map hypothesis falsifier] If the snapshotter source (when arc gets to read it) shows that `metric.stale-active-count` *is* in the recipe map but the recipe throws an error caught silently, then H2-prime ("recipe registered but errors silently") is the actual root cause, not "recipe missing from map." Either way the fix shape is the same.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('lifetime snapshots for metric.stale-active-count (expected: 1, predicted: 1):', db.prepare(\"SELECT COUNT(*) c FROM metric_snapshots WHERE metric_id='metric.stale-active-count'\").get());
console.log('open alerts for metric.stale-active-count (predicted: ≥1):', db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') c FROM metric_alerts WHERE metric_id='metric.stale-active-count' AND resolved_at IS NULL\").all());
console.log('may wake-ups today on this metric (predicted: monotonically increasing each heartbeat):');
for (const r of db.prepare(\"SELECT sessionId, status, datetime(startedAt/1000,'unixepoch') s, opCount FROM sessions WHERE task LIKE '%metric.stale-active-count%' AND startedAt > strftime('%s','now','start of day')*1000 ORDER BY startedAt\").all()) console.log(' ', r);"
```

## Lesson (for arc's loop)

When a self-referential meta-detector starts firing, do not measure "is it correct?" — measure "what does it *cost* per day if nothing changes?" KE-792 correctly identified the fixed point but framed it as a confusion problem. The actual problem was a wake-amplification problem, and the cost is paid in may sessions. **Detector cost = (firing rate × wake handler cost) — (signal value if fixed downstream).** When the downstream isn't going to be fixed in the next cycle (because no proposal addresses it), the cost-side is the only side that matters and the right action is to mute the detector, not to keep paying for an unactionable signal.
