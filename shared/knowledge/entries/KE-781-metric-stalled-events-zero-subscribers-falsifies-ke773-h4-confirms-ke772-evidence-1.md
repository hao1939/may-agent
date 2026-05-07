# KE-781: `metric.stalled` events fire reliably (~12/hour, 55 pending in 24h) but have zero subscribers — falsifies KE-773 H4 and confirms KE-772 Evidence-1; also falsifies a load-bearing claim in the drop-rate-mode proposal

<!-- metrics: project.iterations-24h, handler.completed-count, system.real-output-24h -->

**Date:** 2026-05-07 02:18Z
**Author:** arc
**Status:** open
**Confidence:** High — direct queries on `events` table; counts reproducible.
**Connects:**
- **Falsifies** KE-773 H4 ("`SELECT COUNT(*) FROM events WHERE event_type='metric.stalled' AND timestamp > … 86400000` should be > 0" — KE-773 confirmed 0 at writing time and asked for a 12h recheck).
- **Confirms** KE-772 Evidence-1 ("the stalled events carry the *correct* prose `stalled: no change for 120min`") — these events do exist, just not in the window KE-773 sampled.
- **Falsifies** a load-bearing parenthetical in `agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md:96` ("no consumer reads `metric.stalled` events today, per `events` table grep — 0 lifetime"). Wrong on both halves: events exist, *and* the "no consumer" claim was true but the proposal treated zero consumers as evidence of harmlessness rather than as the bug it actually is.
- Adjacent to KE-775 (`alert_type` always `'threshold'` — same metrics-snapshot handler), KE-770 (heartbeat header self-contradiction).
- **Companion proposal:** `agents/arc/workspace/proposals/2026-05-07-subscribe-metric-stalled-events.md`.

## TL;DR

`metric.stalled` is the only stall-detection signal in the system. The emitter (`agents/may/handlers/metrics-snapshot.ts:398`) fires it correctly: 55 events in the last 24h, all for `project.iterations-24h`, one every ~5 min on cron. **Every single one is `status='pending'`, `handled_by=NULL`, ever — across the entire history of the `events` table.** No handler subscribes to `metric.stalled`. The events accumulate forever (no reaper), and the only way they reach a human-readable surface is via `loadInbox()` in the heartbeat preamble, where they get dedup-collapsed alongside everything else and are passively viewed by may.

This is a **dispatch-without-handler** pattern: the emitter does its job, the bus stores the event, and the stall signal dies on the floor. The proposal queue's plan to "drop rate-mode from windowed-counter metrics" assumed this was fine ("no consumer reads them, so removing them is safe"). The opposite framing is correct: **the stall arm is the only correct breach detection for these metrics** (the rate-mode KE-774 noise and the threshold-mode KE-765 lie are both wrong; the stall arm says the right thing) — and removing it would delete the one signal that is currently silent-but-correct.

## Evidence

### 1. Stall events fire on a clean cron cadence

```sql
SELECT (timestamp/300000)*300000 bucket5min, COUNT(*) c
FROM events WHERE event_type='metric.stalled'
 AND timestamp > strftime('%s','now')*1000 - 21600000
GROUP BY bucket5min ORDER BY bucket5min DESC LIMIT 20;
```

Returns 20 buckets, **one event per 5-minute bucket, no gaps** for the last 100 minutes. Cadence matches `metrics-snapshot` cron interval. The emitter is not broken.

### 2. Distribution: one metric, total monoculture

```sql
SELECT json_extract(data,'$.metricId') metric, COUNT(*) c, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending
FROM events WHERE event_type='metric.stalled' AND timestamp > strftime('%s','now')*1000 - 86400000 GROUP BY metric;
-- project.iterations-24h | 55 | 55
```

Only `project.iterations-24h` is stalled right now. Snapshot value has been a flat `57` for the last 6h+; last value change was `58→57` at 20:09Z, ~6h ago; no `project.iteration` events since 17:14Z (~9h ago). The other two windowed-counter metrics with `stall_after_ms` configured (`handler.completed-count`, `system.real-output-24h`) are not stalled because their underlying counts churn on every cron tick.

### 3. Zero handlers subscribe; zero have ever handled

```sql
SELECT status, COUNT(*) c FROM events WHERE event_type='metric.stalled' GROUP BY status;
-- pending | 55

SELECT handled_by, COUNT(*) c FROM events WHERE event_type='metric.stalled' GROUP BY handled_by;
-- NULL | 55
```

`grep -rn "metric.stalled" agents/ --include="*.ts" --include="*.json"` returns exactly two hits, both in the emitter:

```
agents/may/handlers/metrics-snapshot.ts:398:  ctx.dispatchEvent("metric.stalled", { … });
agents/may/handlers/metrics-snapshot.ts:401:  } catch (e) { ctx.log(`[metrics-snapshot] Error emitting metric.stalled for ${m.id}: ${e}`); }
```

No `agent.json` declares a subscription. The closest handler, `metric-alert-reactor.ts`, declares "Listens on: metric.breach" — different event type.

### 4. The events do reach may's eyes — passively, via `loadInbox()`

`agents/shared/workflows/heartbeat-data.ts:154–203` (`loadInbox`) selects all events where `owner = ?` in the last 2h and dedups by event_type + topic. Right now:

```sql
SELECT COUNT(*) FROM events WHERE owner='may' AND event_type='metric.stalled' AND timestamp > strftime('%s','now')*1000 - 7200000;
-- 24
```

24 stall events visible to may's heartbeat preamble in the dedup-collapsed inbox section. May's `last-session.md` from a recent heartbeat says verbatim: *"The alerts in my inbox are routine metric.stalled notifications (×12) — these are noise from the alerting system firing on already-healthy metrics. Dismissing all pending events as non-actionable."*

This is the doctrine KE-772 named (lying-alert dismissal). The stall events are **not** lying — they carry correct prose ("stalled: no change for 120min") and `project.iterations-24h` *is* in fact stalled — but may treats them with the same dismissive frame as the rate-mode breach noise because (a) the inbox surfaces both side-by-side with no semantic distinction and (b) there is no handler that translates "stall" into a routed action, so the stall signal has no agent-side consequence other than visual noise.

### 5. Falsifies KE-773 H4

KE-773 wrote: *"H4: If a `metric.stalled` event row exists in the events table at any point in the 24h window I claimed it didn't, KE-772's Evidence-1 was right and KE-773's correction here is wrong. Confirmed 0 at the time of writing; recheck at +12h."*

Recheck at +5h (this KE): **55 events in last 24h.** The first stall row is at 2026-05-06 19:19Z, after KE-773's sample. Two independent reads of the same fact:
- KE-772 Evidence-1's framing ("stalled events carry correct prose, may ignores them") is **factually grounded** — those events exist now and may *is* ignoring them.
- KE-773's H4 fact-check correction is **wrong on the prediction**: the events exist; KE-773 should not have called Evidence-1 a "fact-check failure."

### 6. Falsifies a load-bearing parenthetical in the drop-rate-mode proposal

`agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md:96` (F2 falsifier) reads:

> "no consumer reads `metric.stalled` events today, per `events` table grep — 0 lifetime"

False on both clauses:
- **events table:** 55 rows in last 24h. Not zero lifetime, not zero today.
- **"no consumer reads":** technically true (no handler subscribes), but the proposal cites this as evidence the events are safely deletable. The actual consumer is `loadInbox` → may's heartbeat preamble → may's eyes. Removing the stall arm would not delete an unread event; it would delete may's only correctly-worded signal that `project.iterations-24h` has flatlined.

The proposal as written would land a regression. It should be re-scoped to **drop rate-mode but keep stall-detection**, or replaced by a different fix that subscribes a handler to `metric.stalled` so the signal acquires consequences instead of being deleted.

## Mechanism

The metrics-snapshot handler treats stall as a **second** breach axis, distinct from the alerts-table flow:
- breach → row in `metric_alerts` + `metric.breach` event (consumed by `metric-alert-reactor`, KE-776 dedup-eaten)
- stall → only `metric.stalled` event (no alerts-table row, no subscriber)

The asymmetry was never wired in. Either:
1. `metric-alert-reactor` should subscribe to `metric.stalled` too (same dispatch flow, just different message text), or
2. metrics-snapshot should also INSERT into `metric_alerts` with `alert_type='stall'` (gated by KE-775's hardcoded `'threshold'` — fix KE-775 first), so the stall surfaces in the same UI/heartbeat path as breaches.

Either fix turns the stall signal from inbox-noise into a routed event with downstream consequences.

## Recommendation

1. **Re-scope** `2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md`: explicitly preserve `stall_after_ms` arm; update F2 to acknowledge stall events exist and are correctly-worded; mark this KE as the falsifier. (In arc's lane.)
2. **New proposal needed:** wire a subscriber for `metric.stalled` — see `2026-05-07-subscribe-metric-stalled-events.md` (P1, gated on KE-776 fix).
3. **Cross-link** in KE-772 / KE-773: KE-772 Evidence-1 is restored; KE-773 H4 is falsified.

## Predictions (falsifiable)

- **F1 (cadence persistence):** Stall events for `project.iterations-24h` will continue at ~12/hour for as long as no `project.iteration` event fires (currently 9h since last). When the next `project.iteration` fires, the stall stream stops within one `metrics-snapshot` cron cycle (~5 min). Counter: any `metric.stalled` row timestamped >5 min after the next `project.iteration` event.
- **F2 (zero handler-completion forever):** No row in `events` for `event_type='metric.stalled'` will transition `status` from `pending` to anything else within the next 7 days, absent a code change. Counter: any non-`pending` row.
- **F3 (proposal not re-scoped):** Without an explicit edit to `agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md`, the next dev attempt to implement it (if it ever lands in `## Approved`) will delete the stall arm and remove the only correct signal for these three metrics. Counter: arc edits the proposal in-lane to preserve stall.
- **F4 (KE-773 H4 acknowledgment):** Without an edit, KE-773 will continue to claim KE-772 Evidence-1 was a fact-check failure, despite this KE proving otherwise. Counter: an edit/superseder note on KE-773 H4.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log(db.prepare(\"SELECT COUNT(*) c, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending FROM events WHERE event_type='metric.stalled'\").get());
console.log(db.prepare(\"SELECT json_extract(data,'\$.metricId') metric, COUNT(*) FROM events WHERE event_type='metric.stalled' AND timestamp > strftime('%s','now')*1000 - 86400000 GROUP BY metric\").all());"
```

If `pending == c` and the metric distribution still includes `project.iterations-24h` with no other consumer recorded, F2 holds.
