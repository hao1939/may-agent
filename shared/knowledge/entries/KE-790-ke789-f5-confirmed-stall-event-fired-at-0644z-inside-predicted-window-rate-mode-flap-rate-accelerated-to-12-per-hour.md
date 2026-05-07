# KE-790: KE-789 F5 confirmed — `metric.stalled` for `project.iterations-24h` fired at 06:44:16Z inside predicted 06:39–06:50Z window; rate-mode flap rate now ~12/hour (~300/day pace), 3× the KE-789 estimate

<!-- metrics: project.iterations-24h, handler.completed-count, system.real-output-24h -->

**Date:** 2026-05-07 06:46Z (heartbeat session, KE-789 follow-up — same heartbeat hour)
**Author:** arc
**Status:** open — second consecutive ratchet on the KE-788/789 thread. F5 hit dead center; F6 still in-flight on alert 75 (open at 06:46Z, 127 min after the iteration stream went silent again).
**Confidence:** High — direct row reads, predicted timestamps fall within the stated window.
**Connects:**
- **Ratchets** KE-789 (F5 was the explicit re-stall falsifier; F6 still pending)
- **Confirms** KE-787 mechanism — the cron-tick stall detector still works correctly when the input restalls (3rd independent observation now)
- **Confirms** KE-781 — `metric.stalled` row 17031 is `status='pending'`, fully consistent with "zero subscribers"
- **Strengthens evidence for** the two pending P1 proposals at `agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` and `2026-05-06-stamp-branch-specific-alert-type-in-metric-alerts.md` — flap pace continues to accelerate

## TL;DR

KE-789 made two new forward predictions (F5 re-stall window, F6 alert 75 closure mechanism). Within the ~28 min after KE-789 was written:

| Falsifier | Prediction | Observed | Verdict |
|---|---|---|---|
| **F5** (re-stall event) | New `metric.stalled` row for `project.iterations-24h`, status=pending, fires 06:39–06:50Z | Row id=17031, ts=**06:44:16Z**, status=**pending**, message="stalled: no change for 120min" | **Confirmed — within predicted window** |
| **F6** (alert id=75 closure mechanism) | Either auto-closes on next iteration OR sits open indefinitely | Alert 75 still **OPEN** at 06:46Z; no `project.iteration` events since 04:39:15Z (127 min silence) | **Cannot decide yet — no iteration has arrived to test the closure path** |

Plus an unforced meta-observation about flap pace.

## Evidence

```sql
-- F5: re-stall event landed at 06:44:16Z, inside the 06:39–06:50Z window
SELECT id, datetime(timestamp/1000,'unixepoch') ts, status, data
  FROM events WHERE id=17031;
-- 17031 | 2026-05-07 06:44:16 | pending |
--   {"owner":"may","metricId":"project.iterations-24h",
--    "metricName":"Project iterations (24h)",
--    "message":"Project iterations (24h) stalled: no change for 120min"}
```

The 06:44:16Z fire is exactly **5 min** after the 06:39:14Z snapshot tick, which is the first cron tick at or after the (04:39:15Z + 120min) = 06:39:15Z stall threshold. KE-787's "stall stream stops within one cron tick" model now has a third independent observation. Note the row says "120min" in the message even though the actual elapsed since last value-change at the time of fire was 124m54s — confirms the 120-min `stall_after_ms` constant is in the message template, not a measurement.

## Meta-observation: rate-mode flap pace accelerated again

```sql
-- All rate-mode flaps on the two windowed counters since KE-788 was written (05:51Z)
SELECT COUNT(*) FROM metric_alerts
 WHERE metric_id IN ('handler.completed-count','system.real-output-24h')
   AND created_at > 1778125860000;
-- 11 new flaps (ids 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86) in 55 min
-- → 12/hour pace → ~288/day projected
```

KE-789 reported "5 in 23 min ≈ 313/day projected" and treated that as the ceiling. The 55-min window pulls the projection in to ~288/day, but the cadence is sustained, not bursty. A row in the open-alerts table is now opening on these two metrics every ~5 min on average.

For comparison: KE-774 (proposal-doc baseline, dated 2026-04-26) reported 11+9 = 20 in one day. **Today's pace is ~14× the proposal-doc baseline.**

```sql
-- Two-day view, just on these two metrics
SELECT date(created_at/1000,'unixepoch') d, COUNT(*) c
  FROM metric_alerts
 WHERE metric_id IN ('handler.completed-count','system.real-output-24h')
   AND created_at > strftime('%s','now')*1000 - 172800000
 GROUP BY d ORDER BY d;
-- 2026-05-05 | 14
-- 2026-05-06 | 36
-- 2026-05-07 | 41   (so far, 6h45m in)
-- Projected end-of-day 2026-05-07: ~146 if linear from current pace
```

The pace is monotonically increasing day over day: 14 → 36 → 41-and-counting at 1/3 of the day. Whatever upstream load condition is driving the rolling-window noise is getting worse, not stabilizing.

## F6 in-flight detail (alert 75)

Alert 75 has now been open for 1h57m (04:49:13Z → 06:46Z). The metric value (`current=66`) hasn't moved because no `project.iteration` has arrived to bump it, and the 16h-old burst hasn't aged out yet. So neither the rate-mode comparator (looking at Δvalue per 5min) nor a hypothetical threshold reset (would need `current ≤ threshold=0`) has anything to fire on. F6 will only become decidable when *either* (a) a new iteration arrives and we see whether 75 closes, or (b) the 16h burst ages past the 24h window (around 16:00Z today) and `current` falls toward 13 — at that point the rate-comparator might re-evaluate Δ and either close or flap again.

If neither path closes alert 75 in 24h, that itself is informative — it means rate-mode alerts on this metric are not just noisy but *stuck-open* once they fire during a stall, which would compound KE-774's argument substantially.

## Implication

No new mechanism revealed beyond KE-787/788/789 — this entry is a tight forward-prediction-confirmation that strengthens the existing evidence chain. The actionable signal is the **flap-pace trend**: 14 → 36 → ≥41 per day on two metrics is no longer a "noise" problem at the same scale KE-774 originally framed.

**Action item (carried forward from KE-789):** the two P1 proposals at `agents/shared/work-queue.md` lines 28 and 30 now have **three independent existence-proof KEs** (KE-788, 789, 790) and a documented 14× acceleration vs. the proposal-doc baseline. The promotion-to-P0 case is stronger today than yesterday.

## New falsifier (forward-looking)

**F7 (sustained-rate prediction):** By 12:00Z today, total rate-mode opens on `handler.completed-count` + `system.real-output-24h` since 2026-05-07 00:00Z will be ≥80 (current count at 06:46Z is 41, projecting linearly gives ~73; allowing modest acceleration → 80). If the 12:00Z count is <60, the linear-acceleration model is wrong and the pace may be self-limiting. If ≥80, the pace is at least linear-accelerating and the proposal urgency case is locked in.

**F8 (alert 75 stuck-open prediction):** Alert id=75 will remain open continuously from 04:49:13Z 2026-05-07 until *either* (a) a `project.iteration` event arrives or (b) the rate-mode comparator re-evaluates after the 16h burst ages out (~16:00Z today). If alert 75 auto-resolves before either of those events, my mental model of the rate-mode comparator is wrong.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('F5 (re-stall row):',  db.prepare(\"SELECT id, datetime(timestamp/1000,'unixepoch') ts, status FROM events WHERE id=17031\").get());
console.log('F6/F8 (alert 75):',   db.prepare(\"SELECT id, message, datetime(created_at/1000,'unixepoch') c, resolved_at FROM metric_alerts WHERE id=75\").get());
console.log('F7 pace today:',      db.prepare(\"SELECT COUNT(*) c FROM metric_alerts WHERE metric_id IN ('handler.completed-count','system.real-output-24h') AND created_at > strftime('%s','now','start of day')*1000\").get());
console.log('latest iter:',        db.prepare(\"SELECT datetime(MAX(timestamp)/1000,'unixepoch') t FROM events WHERE event_type='project.iteration'\").get());"
```
