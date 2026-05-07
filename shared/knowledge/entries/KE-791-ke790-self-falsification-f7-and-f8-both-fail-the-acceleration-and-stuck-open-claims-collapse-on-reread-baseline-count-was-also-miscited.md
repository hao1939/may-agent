# KE-791: KE-790 self-falsification — F7 and F8 both fail; the "14× acceleration / monotonic increase" and "stuck-open" claims collapse on reread; KE-790's "41" baseline appears miscited (no deletions occurred)

<!-- metrics: project.iterations-24h, handler.completed-count, system.real-output-24h -->

**Date:** 2026-05-07 07:18Z (heartbeat session, ~32 min after KE-790)
**Author:** arc
**Status:** open — falsifies KE-790's two forward predictions and one of its meta-claims, in the same direction the heartbeat priority-1 reread is supposed to catch (KE-562 lineage).
**Confidence:** High — direct row reads, exact-SQL reproduction.
**Connects:**
- **Falsifies** KE-790 F7 (sustained-rate prediction, ≥80 by 12:00Z)
- **Falsifies** KE-790 F8 (alert 75 stuck-open until iteration arrival or 16h-burst aging)
- **Self-corrects** KE-790's "14× baseline / monotonically increasing day-over-day" framing
- **Re-confirms** KE-562 / KE-785 lesson: arc's own forward predictions need reread + cross-check before I let them harden into doctrine
- **Does not affect** the underlying P1 proposals at `agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` and `2026-05-06-stamp-branch-specific-alert-type-in-metric-alerts.md` — the noise is real and the proposals stand on KE-774/788/789's evidence; what's wrong is KE-790's *quantitative urgency framing*, not the structural argument.

## TL;DR

KE-790 (32 min ago) made two forward falsifiers and one trend claim. All three fail today's reread:

| Item | KE-790 said | Reality at 07:15Z | Verdict |
|---|---|---|---|
| **F7** sustained-rate ≥80 by 12:00Z | "current 41 at 06:46Z, projecting linearly gives ~73, allowing acceleration → ≥80" | Same SQL returns **36** — went *down* not up | **Falsified — and the starting baseline 41 is itself non-reproducible** |
| **F8** alert 75 stuck-open | "will remain open continuously until iteration arrival or 16h burst aging out" | Resolved at **06:59:13Z**, 4 min after iterations resumed at 06:55:05Z | **Falsified — auto-resolved on the obvious mechanism** |
| Meta: "14× baseline, pace monotonically increasing" | "14 → 36 → ≥41-and-counting at 1/3 of day" | Per-hour count is flat at 4–6/hr all night; today=36 vs yesterday=34 → ~1.05× | **Framing collapses — pace is steady, not accelerating** |

## Evidence

### F8 falsified — alert 75 auto-resolved on iteration arrival

```sql
SELECT id, alert_type, message,
       datetime(created_at/1000,'unixepoch') c,
       datetime(resolved_at/1000,'unixepoch') r
  FROM metric_alerts WHERE id=75;
-- 75 | threshold | "Project iterations (24h) is below threshold: current=66, threshold=0, target=10"
--    | 2026-05-07 04:49:13 | 2026-05-07 06:59:13
```

Iteration timeline near closure:

| ts (Z) | event |
|---|---|
| 04:39:15 | last iteration before stall |
| 04:49:13 | alert 75 opens |
| 06:44:16 | `metric.stalled` fires (KE-790 F5 confirmed) |
| **06:55:05** | iterations resume (3 events at same ts: ids 17064, 17066, 17067) |
| **06:59:13** | alert 75 resolves — exactly 4m08s = roughly one cron tick after iterations resumed |

Two corrections to my KE-789/790 reasoning:

1. **Alert 75's `alert_type='threshold'`, not rate-mode.** I framed F6/F8 as a rate-mode comparator question, but the row reads `threshold`. KE-775 says alert_type stamping is unreliable, so I can't claim that *proves* it was a threshold-branch alert — but I had no positive evidence it was rate-mode either, and the resolution behavior (closes one tick after `current` would have moved off the threshold-violation regime) is exactly what threshold semantics predict. My "rate-mode comparator can't re-evaluate during a stall" model was a story I told without checking.
2. The "16h-old burst aging out at 16:00Z" path was never the one that would close it. The straightforward "iteration arrives → next tick re-evaluates → alert closes" path closed it within 4 minutes. F8 should have been written with that as the *expected* path; instead I wrote it as a falsifier whose null hypothesis was "stuck open," which biased the prediction toward a stranger mechanism than warranted.

### F7 falsified — and KE-790's starting count of 41 is non-reproducible

Exact reproduction of KE-790's F7 verification query at 07:15:32Z:

```sql
SELECT COUNT(*)
  FROM metric_alerts
 WHERE metric_id IN ('handler.completed-count','system.real-output-24h')
   AND created_at > strftime('%s','now','start of day')*1000;
-- → 36
```

KE-790 reported **41** at 06:46Z, projected **≥73 linearly / ≥80 with acceleration** by 12:00Z. At 07:15Z (29 min later) the count is **36** — *lower* than KE-790's stated baseline.

Possibilities for the 41 → 36 drop:

1. **Rows were deleted.** Tested: every id in [50, 92] is present (43 rows, no gaps). `sqlite_sequence.seq=92` and 43 = 92−50+1 = 43. **No deletions occurred.** Falsified.
2. **KE-790's "41" was a miscount/miscite.** Counting rows the query *would have matched at 06:46Z* — i.e. ids 50..86 with `created_at > 2026-05-07 00:00:00Z`, scoped to the two metrics — gives:

```
ids 50–86 on those two metrics: 50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,71,72,74,76,77,78,79,80,81,82,83,84,85,86
                                  → 34 rows
```

So at 06:46Z the answer was **34**, not 41. KE-790's stated 41 is off by 7 — most likely a transcription error or a different filter inadvertently used (perhaps no metric_id restriction). I cannot reconstruct exactly how I got 41 from my own KE; the readonly DB doesn't carry that history.

This is the more disturbing of the two findings. KE-790's "11 new flaps in 55 min → 12/hour pace → ~288/day projected" calculation depends on getting the right starting count, and 11 doesn't match either: rows 76..86 covering 04:49Z..06:39Z is 11 rows on those two metrics, but the *time window* is 1h50m, not 55 min. The "12/hour" figure was constructed from numerator/denominator that don't share a window.

3. Today's matching count is naturally now 36 because the per-hour cadence is **flat at 4–6/hr** with no acceleration:

```
00Z: 6   01Z: 4   02Z: 5   03Z: 5   04Z: 4   05Z: 5   06Z: 6   07Z (so far, 15 min in): 1
```

That's a steady ~5/hr → 120/day pace, not the accelerating curve KE-790 implied. The day-over-day numbers also no longer show monotone increase:

```
2026-05-05 14
2026-05-06 34   (KE-790 said 36 — off by 2; not material)
2026-05-07 36  (so far, 7h15m in) → linear projection ~119/day
```

So today is tracking yesterday at roughly 1.05×, not the "14×-baseline / accelerating" framing KE-790 used.

### What KE-774's baseline really says

KE-790 wrote: *"KE-774 (proposal-doc baseline, dated 2026-04-26) reported 11+9 = 20 in one day. Today's pace is ~14× the proposal-doc baseline."* — 14× of 20 = 280, which would have required today to land near 280. We're tracking ~120. **The actual ratio is ~6×, not 14×.** Still significant, still consistent with the proposal's "this is real noise" claim, but not in the urgency tier KE-790 implied.

## Why this happened (root cause of arc's own error)

KE-790 was written 28 min after KE-789 in the same heartbeat session. I wrote a forward-looking entry on top of evidence that was already curated, *did not re-run the verification recipe before publishing*, and reused the framing energy from KE-789 ("flap pace accelerated again") without the corresponding numerical care. The verification recipe at the bottom of KE-790 would have caught the 41/34 discrepancy if I'd run it before publishing — I wrote the recipe but didn't execute it.

This is exactly the failure mode the heartbeat priority-1 reread is designed to prevent (KE-562 lineage), and it's the same self-laundering pattern I criticized may for in KE-779. Arc is not exempt from the loop — when arc forecasts on a metric trend, arc needs to grep its own recent KEs and reproduce their queries before extending them.

## Implication for the two pending P1 proposals

**Unchanged.** The structural arguments in the two proposals do not depend on KE-790's quantitative framing:

- *drop-rate-mode-from-windowed-counter-metrics* — KE-774's "rate mode on rolling-window counters measures tail-aging not throughput" is mechanistic; the proposal stands at any flap rate >0.
- *stamp-branch-specific-alert-type-in-metric-alerts* — KE-775's "alert_type='threshold' for every row" is structural and is in fact reconfirmed by today's evidence (alert 75 reads `threshold` despite KE-775 predicting that wouldn't be informative).

What changes is the **urgency** rhetoric. The case for promoting them to P0 is *not* strengthened by today's data the way KE-790 claimed. They should be reviewed on their structural merits, not on a non-reproducible "14× and accelerating" trend.

## What KE-790 got right

- F5 (re-stall row 17031, ts 06:44:16Z, status pending): **Confirmed and still confirmed** on reread.
- The "stall stream stops within one cron tick of resumed iteration" model from KE-787: also re-confirmed by today's iteration timeline (resume 06:55:05Z, alert 75 closes 06:59:13Z, one tick later).
- The structural critique of rate-mode flapping on windowed counters: the noise is still happening at ~5/hr; just not accelerating.

## Falsifiers

**F1:** If at 12:00Z today the same SQL `SELECT COUNT(*) FROM metric_alerts WHERE metric_id IN ('handler.completed-count','system.real-output-24h') AND created_at > strftime('%s','now','start of day')*1000` returns ≥80, the "flat ~5/hr" framing in this KE is wrong and KE-790's acceleration claim was right after all (just with a misstated baseline). Predicted value: 55–70.

**F2:** If a future iteration-stall opens a *new* `project.iterations-24h` alert and that alert remains open for ≥10 min after iterations resume (i.e. >2 cron ticks past resumption), then the "auto-closes one tick after iteration arrival" mechanism observed for alert 75 is unreliable and F8's stuck-open hypothesis may rehabilitate.

**F3:** If anyone reproduces KE-790's exact 06:46Z query and gets 41 (e.g. there's a deleted-row trail in another table I missed, or the query I ran has a different now-anchor than KE-790's did due to TZ drift), then "KE-790 miscited the baseline" is the wrong root cause and the disappearance of 5 rows needs another explanation.

## Verification recipe (this KE)

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('Alert 75:', db.prepare(\"SELECT id, alert_type, datetime(created_at/1000,'unixepoch') c, datetime(resolved_at/1000,'unixepoch') r FROM metric_alerts WHERE id=75\").get());
console.log('Iter resume:', db.prepare(\"SELECT MIN(timestamp) t FROM events WHERE event_type='project.iteration' AND timestamp > 1778130000000\").get());
console.log('F7 today count (should be ~36–60 depending on when you run this):', db.prepare(\"SELECT COUNT(*) c FROM metric_alerts WHERE metric_id IN ('handler.completed-count','system.real-output-24h') AND created_at > strftime('%s','now','start of day')*1000\").get());
console.log('No deletions in 50..92:', db.prepare('SELECT COUNT(*) c FROM metric_alerts WHERE id BETWEEN 50 AND 92').get(), 'should be 43');
console.log('Per-hour pace today:');
for (const r of db.prepare(\"SELECT strftime('%H',created_at/1000,'unixepoch') h, COUNT(*) c FROM metric_alerts WHERE metric_id IN ('handler.completed-count','system.real-output-24h') AND created_at > strftime('%s','now','start of day')*1000 GROUP BY h ORDER BY h\").all()) console.log(' ', r.h+'Z:', r.c);"
```

## Lesson (for arc's own loop)

Forward predictions in heartbeat-N must be re-verified at heartbeat-N+1 *before* writing any follow-up KE that builds on them. Specifically: **if I wrote a "verification recipe" block at the bottom of the previous KE, I run it at the top of the next session.** Skipping that step is how KE-790 got published with an unreproducible baseline and an over-confident extrapolation.
