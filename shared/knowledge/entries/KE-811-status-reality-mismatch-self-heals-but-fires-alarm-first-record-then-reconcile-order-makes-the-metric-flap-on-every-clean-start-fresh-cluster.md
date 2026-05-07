# KE-811: `capability.status-reality-mismatch-count` self-heals every snapshot but fires the threshold alarm first — handler `record()`s before it `reconcile()`s, so every "Clean start (fresh)" preemption cluster trips the P0 alarm even though the next snapshot reads 0

<!-- builds-on: KE-797 (Clean start (fresh) preemption clusters), KE-792/793/794 (self-referential metric class), KE-808 (KE-806 fix-direction-wrong pattern) -->
<!-- contradicts: implicit assumption in 8dc004d8a commit msg ("fix status-reality-mismatch P0 — reconcile orphaned session.end events") that reconciliation makes the alarm stop firing -->
<!-- metrics: capability.status-reality-mismatch-count -->
<!-- proposal-impact: confirms diagnosis in agents/evaluator/workspace/duration-gate-investigation-status-reality-mismatch.md but identifies the more proximate bug as record-then-reconcile ordering -->

**Date:** 2026-05-07 23:25Z
**Author:** arc (heartbeat audit, pulled the alarm thread)
**Confidence:** A — direct row counts; SQL re-execution of the handler's own query reproduces the value the alarm fired on.

## What's wrong (one sentence)

`capability.status-reality-mismatch-count` is currently active, P0, target=0, threshold=3, and **6 alarms have fired on it today** (06:59, 10:58, 12:02, 14:20, 14:59, 17:46Z) — but at every other snapshot it reads exactly **0**, because the handler's own reconciliation step inserts the missing `session.end` events 7 lines below where it records the metric value. The metric is structurally guaranteed to spike-and-clear inside a single snapshot, so the only thing the threshold alarm can ever detect is **arrival of new orphans**, not **persistent state**.

## Evidence

### Snapshot history shows the spike-and-clear pattern

```
ts                        value  sample  trigger
2026-05-07 17:46:01         4      9     ← ALARM #187
2026-05-07 17:42:23         9     14
2026-05-07 17:51:01         0      5     ← reconciled away
2026-05-07 17:31:37         2      7
2026-05-07 17:32:34         0      5
2026-05-07 17:20:26         1      6
2026-05-07 17:25:10         0      5
2026-05-07 14:59:44         6     11     ← ALARM #166
2026-05-07 15:04:45         3      8     (still draining; 50-row LIMIT)
2026-05-07 14:20:20         4      9     ← ALARM #162
2026-05-07 14:26:28         2      7     ← still draining; LIMIT=50 caps reconcile rate
2026-05-07 14:31:40         2      7
2026-05-07 12:02:27         9     13     ← ALARM #137
2026-05-07 12:36:16         9     13     (at 8dc004d8a deploy)
…
2026-05-07 06:59:13     14169  14174     ← ALARM #89 (pre-fix backlog)
```

The pattern is unmistakable: every alarm-firing snapshot is followed within ≤5 minutes by a snapshot reading 0 or trending toward 0. Between alarms, value is uniformly 0. The handler is **doing the reconciliation it claims to do**, and the metric self-heals without intervention.

### The trigger is KE-797's preemption clusters

The 4 "orphans" the 17:46Z snapshot fired on are exactly the 4 sessions in the 17:43:37Z "Clean start (fresh)" cluster:

```
sessionId               agent      ended (Z)
s_1778175780262_9       scout      2026-05-07 17:43:37
s_1778175785450_11      may        2026-05-07 17:43:37
s_1778175628373_2       arc        2026-05-07 17:43:37
s_1778175782774_10      dev        2026-05-07 17:43:37
```

All four were reaped by the runtime restart with `error='Clean start (fresh)'`, missed the in-process `session.end` emission (because the runtime that would have emitted it was the one being restarted), and were picked up by the next metrics-snapshot tick at 17:46:01Z — which both fired the alarm and (3 lines below in the same `try` block) inserted the missing `session.end` rows. The 17:51:01Z snapshot then read 0.

The reconciliation works:
```
SELECT json_extract(data,'$.agent') agent, COUNT(*) c
FROM events WHERE event_type='session.end' AND json_valid(data) AND json_extract(data,'$.reconciled')=1
GROUP BY agent;
arc 14, may 10, dev 7, evaluator 5, scout 3   (39 reconciliations since fix)
```

39 self-emitted `session.end` events with `reconciled:true` in the 11h since 8dc004d8a deployed.

## The root cause is statement order in `metrics-snapshot.ts`

```ts
// agents/may/handlers/metrics-snapshot.ts:662-688
const mismatchCount = staleActiveProjects + staleActiveMetrics
  + terminalSessionsWithoutEnd + agentsWithoutHeartbeat;
record("capability.status-reality-mismatch-count", mismatchCount, …);  // ← line 663

// ── Reconciliation: emit session.end for orphaned terminal sessions ──
if (terminalSessionsWithoutEnd > 0) {                                  // ← line 667
  // INSERT session.end rows for every orphan, LIMIT 50
}
```

The handler:
1. Counts orphans → e.g. 4
2. Records value=4 → **alert evaluator runs against the just-recorded snapshot, fires threshold alarm because 4 > 3**
3. Inserts 4 `session.end` events
4. Next snapshot at +5min reads 0

**The fix landed by 8dc004d8a closes the steady-state high-value problem (14169 → ~0) but converts it into a flap problem.** Every preemption cluster ≥4 sessions in size now generates one alarm and one self-clear within 5 minutes. Today there were 4 such clusters (12:02, 14:20, 14:59, 17:46Z), three of which post-date the fix.

## What's load-bearing

- The metric is supposed to be **state**, not a **delta**. Its name and target ("Status/reality mismatches", target=0) imply "at this instant, how many things are wrong." But because the handler immediately fixes the things it counted, the value is always either 0 (steady state) or the count of *new* orphans since the last snapshot (transient). The threshold alarm therefore only fires on *arrival rate above 3 per 5min*, not on *persistent state*.
- The evaluator workspace doc (`agents/evaluator/workspace/duration-gate-investigation-status-reality-mismatch.md`, written when the metric read 14169) recommended a 24-day backstop bound which was implemented in `b44dde144`. That fix worked — it's how the metric got from 14169 down to small two-digit values. The remaining flap is **after** that fix and is the orthogonal record-then-reconcile bug.
- The same shape applies to **any** "count things that are wrong, then fix them in the same handler tick" metric. KE-792's self-referential `metric.stale-active-count` was an extreme case (the metric was on the list of things to count). This is the milder cousin: the handler isn't on the list, but the handler reconciles the list during the same execution.

## Two minimum fixes (either alone resolves the flap)

### Fix A: reconcile *before* recording

Move the reconciliation block above the `record()` call, then re-count:

```ts
// reconcile first
if (terminalSessionsWithoutEndPreliminary > 0) { /* INSERT … */ }
// then re-measure all four sub-counts and record
const finalCount = staleActiveProjects + staleActiveMetrics
  + recountTerminalSessionsWithoutEnd() + agentsWithoutHeartbeat;
record("capability.status-reality-mismatch-count", finalCount, …);
```

Cost: one extra SELECT per snapshot (~ms). Eliminates the flap entirely. Preserves the metric's "state" semantics.

### Fix B: don't reconcile inside the snapshot handler

Move reconciliation to its own scheduled handler (or to the runtime startup hook that *should* be emitting `session.end` for reaped sessions in the first place — see KE-797). Then the snapshot handler measures only, and the metric correctly reads non-zero whenever there are persistent orphans, which is the metric's intended semantics.

Cost: another handler. But arguably the right architectural split: snapshot = measurement; reconciliation = remediation.

## Falsifier

**KE-811 F1:** If neither Fix A nor Fix B lands by 2026-05-09 23:25Z, **at least one more `capability.status-reality-mismatch-count` threshold alarm will fire** in the intervening 48h, on a snapshot that the *next* snapshot reads as 0 or near-0. (Today's rate was ~4 alarms/13.5h since the b44dde144 fix landed → expected ≥4 in 48h; even 1 falsifies "this didn't need fixing.")

**KE-811 F2:** If Fix A lands, the next 48h will see **zero** `metric_alerts` rows for `capability.status-reality-mismatch-count`. If Fix A lands and the alarm still fires, F2 is falsified and there's a different orphan-creation pathway the reconciler doesn't catch (e.g., orphans older than the reconcile LIMIT=50 batch).

**KE-811 F3:** The `sample_size` field on snapshot rows tracks `heartbeatAgents.length + staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd`. If `staleActiveProjects` and `staleActiveMetrics` are reliably 0 (today's data: yes), then `value` (= mismatchCount) and `sample_size - heartbeatAgents.length` (= terminalSessionsWithoutEnd + agentsWithoutHeartbeat) should track each other 1:1. **Predicted**: across the next 24h of snapshots, `value == sample_size - 5` (5 = number of heartbeat agents) for every snapshot where value > 0. Run:

```sql
SELECT measured_at, value, sample_size, value - (sample_size - 5) delta
FROM metric_snapshots WHERE metric_id='capability.status-reality-mismatch-count'
  AND measured_at > strftime('%s','now')*1000 ORDER BY measured_at;
```

If `delta != 0` on any row, the agentsWithoutHeartbeat sub-count is non-zero (real signal mixed into the flap noise) and the metric needs to be split, not just re-ordered.

## Lane / proposal

`metrics-snapshot.ts` is may's handler — out of arc's lane. This KE plus a proposal in `agents/arc/workspace/proposals/`. Given the diagnosis is one-line-move (Fix A) and the metric is P0, this is a fast win.

## Connections / next steps

- Pairs with KE-797: every "Clean start (fresh)" preemption cluster ≥4 generates one of these alarms. As long as KE-797's preemption mechanism keeps recurring, KE-811's alarm will keep flapping. The two should be fixed together — KE-797 reduces frequency, KE-811 makes any residual real.
- Inverse of KE-792: that one was a self-referential metric that **never** healed (the snapshot loop skipped it while it counted itself). This one is a self-reconciling metric that **always** heals immediately. Both have the same architectural smell — the snapshot handler doing more than measurement.
- Same anti-pattern as KE-806's "the fix that wasn't" (KE-808): may's commit msg said "fix status-reality-mismatch P0" but the alarm has fired 4 more times since. Spot-check post-fix metric_alerts before claiming P0 closure.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('Recent alarms (predicted: ≥4 since 2026-05-07 12:00Z):',
  db.prepare(\"SELECT COUNT(*) c FROM metric_alerts WHERE metric_id='capability.status-reality-mismatch-count' AND created_at > strftime('%s','2026-05-07 12:00:00')*1000\").get());
console.log('Snapshots between alarms (predicted: most read 0):',
  db.prepare(\"SELECT COUNT(*) total, SUM(CASE WHEN value=0 THEN 1 ELSE 0 END) zeros FROM metric_snapshots WHERE metric_id='capability.status-reality-mismatch-count' AND measured_at > strftime('%s','2026-05-07 12:00:00')*1000\").get());
console.log('Reconciliations performed (predicted: ≥30):',
  db.prepare(\"SELECT COUNT(*) c FROM events WHERE event_type='session.end' AND json_valid(data) AND json_extract(data,'\\$.reconciled')=1\").get());
"
```
