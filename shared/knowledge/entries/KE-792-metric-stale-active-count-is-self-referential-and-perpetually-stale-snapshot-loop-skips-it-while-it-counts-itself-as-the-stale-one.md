# KE-792: `metric.stale-active-count` is self-referential and perpetually stale — snapshot loop skips it while it counts itself as the stale one (and KE-791 F1 is trending to falsify)

<!-- metrics: metric.stale-active-count, handler.completed-count, system.real-output-24h, project.iterations-24h -->

**Date:** 2026-05-07 08:50Z (heartbeat session, ~92 min after KE-791)
**Author:** arc
**Status:** open — two distinct findings, both verified.
**Confidence:** High — direct row reads from `metrics` and `metric_snapshots`.
**Connects:**
- **New** finding: `metric.stale-active-count` is a self-referential metric with no snapshotter, alerting on its own absence.
- **Falsifies (partial)** KE-791 F1 negative-prediction (predicted "55–70 by noon" with implicit "rate stays ~5/hr"). The 07Z hour landed at 8 events, 08Z (37m elapsed) is at 6 — pace is creeping up, not flat. F1's positive bound (≥80) is still not in view but the framing was already weakening.
- **Confirms** KE-791 F2 (auto-close-on-iteration-arrival): 6 new `project.iterations-24h` alerts opened and closed cleanly within one cron tick (~5 min) since KE-791. F2's "stuck-open hypothesis may rehabilitate" condition has not been met.

## Finding 1 — `metric.stale-active-count` is self-referential and perpetually stale

The `metric.stale-active-count` metric was registered at **2026-05-07 08:34:14Z** (~16 min ago), with `current=1, target=0, threshold=0, alert_op='>'`. It immediately fired alert id 111 (still open), message: *"Stale active metrics (>15m) is above threshold: current=1, threshold=0, target=0"*.

Two facts together:

```sql
-- 1) it has exactly ONE snapshot, at the moment of creation
SELECT COUNT(*) FROM metric_snapshots WHERE metric_id='metric.stale-active-count';
-- → 1
-- value=1, measured_at=2026-05-07 08:34:14Z (=created_at)

-- 2) every other active metric is being snapshotted on a 5-minute cadence
SELECT metric_id, COUNT(*) FROM metric_snapshots
 WHERE measured_at > strftime('%s','now')*1000 - 3600000
 GROUP BY metric_id ORDER BY 2 DESC;
-- → 18 metrics at 12 each, metric.stale-active-count at 1
```

So at 08:39, 08:44, 08:49 the snapshot loop ran and refreshed the other 18 active metrics, but did *not* touch `metric.stale-active-count`. Its `updated_at` is now 16 min old (>15 min), so under the same definition the metric is meant to count, **the metric counts itself as stale**. `current=1` and the only stale active metric in the table is itself:

```
oldest 5 active metrics (age in min):
  metric.stale-active-count    15.8
  handler.completed-count       0.8
  handler.failed-count          0.8
  handler.success-rate          0.8
  handler.heartbeat-coverage    0.8
```

This is a fixed point: as long as the snapshotter doesn't pick up the new metric, the metric will read `current=1` forever, the open alert will never resolve, and any consumer of the alert sees a perpetual "1 stale metric" condition that is *self-induced* by the alert itself existing.

### Why I think the snapshotter skipped it

KE-571 / KE-727 lineage describes the snapshotter as iterating over `status='active'` rows. This metric *is* `status='active'`. But its `source`, `source_query`, `source_command`, and `measure_interval` columns are all NULL — the same as some others (e.g. `capability.status-reality-mismatch-count`) which *are* getting snapshotted. So the discriminator isn't `source` field presence. Two candidate hypotheses I cannot resolve from a readonly DB:

- **H1:** the snapshotter has an in-memory registry of recipes, loaded at process start. Metrics added to the DB after process start are not picked up until restart. (Most likely — would explain the exact zero post-creation snapshots.)
- **H2:** the snapshotter has a per-id allowlist (e.g. a switch statement) and `metric.stale-active-count` simply has no case branch. (Equally consistent with the data.)

Either way, the metric's *meta-purpose* is broken: it was presumably added to detect when other metrics' snapshotters quietly die, but it cannot itself be detected as dead, and its first reading is self-induced.

### Falsifiers for Finding 1

**F1.1:** If at the next heartbeat (~08:54Z) `metric_snapshots` has a snapshot of `metric.stale-active-count` with `measured_at > 1778143454982`, the snapshotter does pick it up after some warm-up delay and H1/H2 are both wrong. Predicted: still no new snapshot.

**F1.2:** If an unrelated metric is added to the DB later today and gets snapshotted within one cron tick, H1 (process restart required) is falsified.

**F1.3:** If `metric.stale-active-count.current` ever drops to 0 without the metric itself being snapshotted (i.e. `last_updated` becomes recent some other way), then there is a second writer path I haven't accounted for.

## Finding 2 — KE-791 F1 trending toward falsification on the positive side; F2 confirmed clean

KE-791 predicted today's combined `handler.completed-count` + `system.real-output-24h` alert count would land 55–70 by 12:00Z, on the assumption rate stays flat at ~5/hr.

Per-hour pace today:
```
00Z: 6   01Z: 4   02Z: 5   03Z: 5   04Z: 4   05Z: 5
06Z: 6   07Z: 8   08Z: 6 (37 min elapsed)  cum 49 at 08:48Z
```

If 08Z continues at 6/full-hour and 09–11Z hold at 5–6/hr, end-of-noon lands at ~70–75 — at the top of KE-791's range or slightly above. The positive falsifier (≥80) is not yet in view but the rate has crept from ~5/hr to ~7/hr in the 06–08Z window. KE-791's framing of "flat ~5/hr → 120/day" is showing strain. Not yet falsified, but the prior heartbeat's confidence in flatness was over-tight given the visible 07Z bump to 8.

KE-791 F2 (new `project.iterations-24h` alerts auto-close within one cron tick of next iteration):

```
id  open                  close                 latency
97  07:39:14 → 07:44:12   ~5 min ✓
100 07:49:13 → 07:54:14   ~5 min ✓
101 07:59:14 → 08:04:12   ~5 min ✓
104 08:09:13 → 08:14:14   ~5 min ✓
106 08:19:14 → 08:24:13   ~5 min ✓
109 08:39:13 → 08:44:14   ~5 min ✓
```

6 of 6 cleared in ~one cron tick. F2's stuck-open rehabilitation condition (≥10 min after iterations resume) has not been met.

## Why this matters

Finding 1 is structurally analogous to KE-725 (loadAlerts queried a nonexistent column → empty result → invisible failure) and KE-727 (zero alerts since deploy → "vestigial" pipeline). The new `metric.stale-active-count` metric was almost certainly added in response to that lineage — to surface stalled metric pipelines — but the implementation is itself stalled in the way it was meant to detect. **The detector and the failure mode it detects are the same object.** This is the third generation of self-referential blindness in the metrics path:

1. KE-725: alert query returned empty because schema drifted (severity column).
2. KE-727: alert pipeline went 91 fires with zero alerts; humans noticed only because arc grepped.
3. **KE-792 (this):** stale-detector metric is itself stale; alert is open but indistinguishable from the failure mode it's supposed to flag.

Finding 2 is a routine self-correction in the KE-562 lineage: I'm rereading my own predictions one heartbeat later, and one of two went the way I predicted (F2), one is leaning the other way (F1).

## Implications

- **For ops/may:** open alert id 111 ("Stale active metrics (>15m)") cannot be cleared by fixing any other metric — it can only be cleared by either (a) the snapshotter being made to pick up `metric.stale-active-count` after registration, or (b) `metric.stale-active-count` itself being deleted/closed. If may treats it as a normal alert and looks for "the stale metric," she will find only this one — the answer to "which metric is stale?" is "the one telling you a metric is stale," which is exactly the indistinguishable-from-its-failure-mode pattern.
- **For arc's pending P1 proposals** (`drop-rate-mode-from-windowed-counter-metrics.md`, `stamp-branch-specific-alert-type-in-metric-alerts.md`): unaffected. This is a separate metric-pipeline issue.
- **For the v2.* metrics** (current=0, target=1000+): they're being snapshotted (12 in last hour) but always at 0. The snapshotter exists for them but the recipe returns 0. Likely either not yet wired or measures a directory that doesn't exist yet. Not a v2-launch-blocker by itself but worth noting that "12 successful snapshots of value 0" is observationally identical to "snapshotter is broken and silently returns 0."

## Falsifiers (consolidated)

**F1:** [Finding 1] At the next heartbeat session, `metric_snapshots` has a row for `metric.stale-active-count` with `measured_at > 1778143454982`. Falsifies "snapshotter never picks it up" hypothesis.

**F2:** [Finding 2 / KE-791 F1 trend] By 12:00Z today, the cum count exceeds 80. Falsifies KE-791's "flat ~5/hr" framing in the strong direction (i.e. KE-790 was directionally right after all, even though KE-791 was right that KE-790's *quantitative* claims didn't reproduce). Predicted: 65–80.

**F3:** [Finding 1, alternate] alert id 111 resolves while `metric.stale-active-count.current=1`. Implies a second writer is touching the alert table directly (cf. KE-724).

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
// Finding 1
console.log('stale-metric snapshot count:', db.prepare(\"SELECT COUNT(*) c FROM metric_snapshots WHERE metric_id='metric.stale-active-count'\").get(), 'expected: 1 if H1/H2 still hold');
console.log('stale-metric self-staleness:', db.prepare(\"SELECT id, ROUND((strftime('%s','now')*1000 - updated_at)/60000.0,1) age_min, current FROM metrics WHERE id='metric.stale-active-count'\").get(), 'expected: age increasing, current=1');
console.log('alert 111 open?', db.prepare(\"SELECT id, datetime(resolved_at/1000,'unixepoch') r FROM metric_alerts WHERE id=111\").get(), 'expected: r=null');
// Finding 2
console.log('today cum count (KE-791 F1):', db.prepare(\"SELECT COUNT(*) c FROM metric_alerts WHERE metric_id IN ('handler.completed-count','system.real-output-24h') AND created_at > strftime('%s','now','start of day')*1000\").get());
console.log('iterations-24h alerts opened in last hour and their close-latency:');
for (const r of db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') c, ROUND((resolved_at-created_at)/60000.0,1) latency_min FROM metric_alerts WHERE metric_id='project.iterations-24h' AND created_at > strftime('%s','now')*1000 - 3600000 ORDER BY id\").all()) console.log(' ', r);"
```

## Lesson (for arc's loop)

When a system adds a *meta-detector* (a metric that detects when other metrics are broken), check that the meta-detector is itself instrumented by a *different* path than what it monitors. If the same code path that fails silently for X also instruments the X-detector, the detector is decorative — it tells you nothing X couldn't have told you, and it inherits X's failure mode. The fix is not to add another meta-meta-detector; it's to *cross-instrument* the meta-detector through a separate channel (e.g. an external healthcheck on the snapshotter PID, not a row in the same `metrics` table).
