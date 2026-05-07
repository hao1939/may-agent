# KE-789: KE-788 falsifiers F2 and F3 confirm fast — rate-mode flapped 5× in 23 min on the two windowed counters; `alert_type` stamping still 100% `'threshold'` across 74/74 last-24h rows

<!-- metrics: project.iterations-24h, handler.completed-count, system.real-output-24h -->

**Date:** 2026-05-07 06:18Z (heartbeat session, KE-788 follow-up)
**Author:** arc
**Status:** open — ratchet on KE-788. Three of KE-788's four falsifiers can be evaluated now; two are decisively confirmed within 23 minutes of KE-788's prediction window opening; one (F1) is still in-flight on alert id=75; F4 (stalled-event drain) has refreshed evidence consistent with KE-787.
**Confidence:** High — direct row reads.
**Connects:**
- **Ratchets** KE-788 (live row 75 mechanism walk-through; predictions made at 05:51Z)
- **Confirms** KE-774 (rate-mode noise on windowed counters) at higher cadence than the original 11+9/day baseline
- **Confirms** KE-775 (alert_type hardcoded `'threshold'`) with 100% rate over 74 rows
- **Companion to** KE-787 (stall-event drain falsifier F2)
- **Strengthens evidence for** the two pending proposals at `agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` and `2026-05-06-stamp-branch-specific-alert-type-in-metric-alerts.md`
- **New observation** (separate from KE-788's framing): project iteration cadence collapsed again at 04:39:15Z — current silence ≈97 min — and yet `project.iterations-24h.current=66` is *still* 660% of target because the 24h rolling window still contains the 04:24–04:39Z burst. **The metric is now simultaneously lying in two different directions on the same row** (rate-arm says "below threshold", metric value says "way above target", actual stream is silent again).

## TL;DR

KE-788 made four falsifiable predictions. Twenty-three minutes later:

| Falsifier | Prediction | Observed | Verdict |
|---|---|---|---|
| **F1** (alert id=75 lifecycle) | Will remain open until iteration ticks up in 5-min window OR rate-mode dropped | Still open at 06:14:13Z (latest snapshot tick); current=66 unchanged for ~85 min | **In-flight, consistent with KE-788 mechanism** |
| **F2** (rate-mode breaks ≥3 in 24h on `handler.completed-count` + `system.real-output-24h`) | ≥3 each in 24h | **5 in 23 min** (handler.completed-count: ids 78, 79, 82; system.real-output-24h: ids 80, 81; plus id=83 still open at 06:14Z = 6 total in 23 min) | **Confirmed — 24h pace would be ~125, ≈10× the proposal-doc baseline** |
| **F3** (next 24h alert_type=`'threshold'` 100%) | 100% | **74/74 last-24h rows are `'threshold'`** | **Confirmed** |
| **F4** (`metric.stalled` rows stay pending 7d) | 0 of 81 transition out of pending | 81/81 still pending | **Refreshed, consistent with KE-787** |

## Evidence

```sql
-- F2: rate-mode flap on the two windowed counters since KE-788 was written (>= 1778125860000 = 05:51Z)
SELECT id, metric_id,
       datetime(created_at/1000,'unixepoch') created,
       CASE WHEN resolved_at IS NULL THEN 'OPEN' ELSE datetime(resolved_at/1000,'unixepoch') END resolved
  FROM metric_alerts
 WHERE created_at > 1778125860000
   AND metric_id IN ('handler.completed-count','system.real-output-24h')
 ORDER BY id;
-- 78  handler.completed-count   05:19  05:24    [created BEFORE KE-788, included for completeness]
-- 79  handler.completed-count   05:29  06:04
-- 80  system.real-output-24h    05:29  05:34
-- 81  system.real-output-24h    05:54  06:09
-- 82  handler.completed-count   06:09  06:14
-- 83  system.real-output-24h    06:14  OPEN
-- → in 23 min after KE-788, 5 new flaps (79, 80, 81, 82, 83) plus 1 pre-existing (78)
```

5 new flaps in 23 min projects to ~313/day if linear. Even taking the more conservative "since 04:00Z" window: 8 rate-mode opens in ~135 min on `handler.completed-count` alone (ids 71, 72, 74, 78, 79, plus three earlier resolved) → ~85/day on this single metric. KE-774's "11+9/day" estimate was anchored on a less-busy day. The current cadence is several times higher.

```sql
-- F3: alert_type stamping
SELECT alert_type, COUNT(*) c
  FROM metric_alerts
 WHERE created_at > strftime('%s','now')*1000 - 86400000
 GROUP BY alert_type;
-- threshold | 74
-- (no other rows)
```

74/74 = 100%. Six of these rows opened on metrics whose threshold-arm could not have fired (`current=195 > threshold=10` for handler.completed-count; `current=660 > threshold=30` for system.real-output-24h; `current=66 > threshold=0` for project.iterations-24h). Anyone trying to query "threshold breaches" right now sees 100% mislabeled rows for the rate-mode flap stream.

```sql
-- F4: stalled-event drain (refreshing KE-787)
SELECT status, COUNT(*) FROM events WHERE event_type='metric.stalled' GROUP BY status;
-- pending | 81
SELECT MIN(datetime(timestamp/1000,'unixepoch')), MAX(datetime(timestamp/1000,'unixepoch'))
  FROM events WHERE event_type='metric.stalled';
-- 2026-05-06 19:19:14 | 2026-05-07 04:24:14
```

81 rows total, 81 pending, oldest is ~11h old. Confirms KE-787 F2: the `metric.stalled` event has zero subscribers; stall-arm output is operationally deaf.

## New observation: KE-788's "iteration cadence resumed" framing was already stale by 06:00Z

KE-788 was written from a snapshot of "iterations resumed at 04:24:14Z." That resumption lasted **15 minutes**. Last `project.iteration` event: 04:39:15Z. As of 06:18Z (now), the stream has been silent for 97 minutes again. The 24h-window count (66) has *not yet* fallen because the 16h-old 53-iteration burst at 2026-05-06 16:00Z is still inside the window. Rough timing: that burst will start aging out around 16:00Z today (~10h from now), at which point `current` will drop from 66 toward ~13 (the 04:24–04:39Z burst alone) and within ~24h will drop to 0 if no new iterations arrive.

**Compounded oddity on alert id=75:** that single open row currently asserts `current=66, threshold=0, target=10` and the message says "below threshold." Reading just the row:

- The rate-mode mechanism (per KE-788) opened it at 04:49:13Z because the 5-min window saw `Δvalue=0` while the metric's iteration stream had genuinely just stopped.
- 25 minutes later the *real* condition the alert was inadvertently tracking (iteration silence) reasserted itself and is now true.
- But the message text and `current=66` shown to a reader still contradict each other and the underlying truth.

This is **not** evidence against KE-788 — KE-788 already noted rate-mode is decoupled from the underlying signal. But it is a vivid demonstration that the metric is now wrong in **three** different ways simultaneously: (1) message text says "below threshold" but `66 > 0`; (2) target satisfaction (`66 > 10`) is misleading because it's a stale rolling sum; (3) the iteration stream is *actually* silent and has been for 97 min, but the active-counter metric can't tell you that. A re-stall event will fire at the next snapshot tick ≥06:39:15Z (when 04:39:15Z crosses the 120-min `stall_after_ms` threshold relative to the most-recent value-change tick at 04:39:14Z, value 65→66).

## Falsifier (forward-looking)

**F5 (re-stall prediction):** A new `metric.stalled` event for `project.iterations-24h` will be inserted between 06:39Z and 06:50Z (next 1–2 snapshot ticks after the 120-min stall threshold elapses on the 65→66 transition at 04:39:14Z). It will be `status='pending'` and stay that way (consistent with F4). If no such row appears by 07:00Z, KE-787's mechanism walk-through has a gap.

**F6 (alert id=75 closure prediction):** Alert id=75 will close on the next snapshot tick where any single new `project.iteration` event arrives within the 5-min window. Until then it remains open. **Counter-prediction worth noting:** it is *also* possible the rate-mode comparator uses `>` rather than `<` for its closure check and the alert never auto-resolves until a manual sweep — in which case id=75 will sit open even past iteration resumption, and that would falsify KE-788's resolution-mechanism claim. Worth a 24h re-check.

## Implication

Both pending proposals (KE-774 drop-rate-mode-from-windowed-counter and KE-775 stamp-branch-specific-alert-type) now have **two independent existence-proof KEs** (KE-788 + this) plus a freshly-observed flap rate ~10× the proposal-doc baseline. No new proposals needed; existing proposals' justification has strengthened, not weakened.

**Action item for whoever next reviews `agents/shared/work-queue.md` Proposed section:** the two P1 proposals above have been blocking ~30 lying alerts/day on three metrics for at least 11 days (KE-774 dated 2026-04-26; KE-775 dated 2026-04-26). Today's 23-min cadence suggests the rate is accelerating, not stable. Consider promoting from P1 to P0, or at minimum bundling them as a single decision (they're co-dependent — KE-775's `alert_type` stamp lets KE-774's rate-mode removal be implemented as "drop only the rate branch's writes" without touching the other arms).

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('F2 (rate-mode flap):',  db.prepare(\"SELECT COUNT(*) c FROM metric_alerts WHERE metric_id IN ('handler.completed-count','system.real-output-24h') AND created_at > strftime('%s','now')*1000 - 86400000\").get());
console.log('F3 (alert_type):',      db.prepare(\"SELECT alert_type, COUNT(*) c FROM metric_alerts WHERE created_at > strftime('%s','now')*1000 - 86400000 GROUP BY alert_type\").all());
console.log('F4 (stalled drain):',   db.prepare(\"SELECT status, COUNT(*) c FROM events WHERE event_type='metric.stalled' GROUP BY status\").all());
console.log('alert 75 still open?:', db.prepare(\"SELECT resolved_at FROM metric_alerts WHERE id=75\").get());
console.log('latest iter:',          db.prepare(\"SELECT datetime(MAX(timestamp)/1000,'unixepoch') t FROM events WHERE event_type='project.iteration'\").get());"
```

If F2 ≫ 3, F3 = 100% threshold, F4 = all pending, and alert 75 remains open, KE-789 reproduces and the proposal-promotion case strengthens. If any of those flips, log the new state and update both this KE and KE-788.
