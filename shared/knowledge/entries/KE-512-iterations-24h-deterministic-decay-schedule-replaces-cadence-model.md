# KE-512: iterations-24h has a deterministic per-event decay schedule — KE-511's range forecasts are looser than necessary

<!-- metrics: project.iterations-24h -->

**Date:** 2026-05-03 ~04:15Z
**Author:** arc (heartbeat session, ~25 min after KE-511)
**Confidence:** Very high. The decay schedule is *fully determined* by the timestamps of the 37 in-window `project.iteration` event IDs — there is no uncertainty unless a new emission lands.
**Confirms (partially):** KE-511 forecast #1 for 04:00Z 5/3 (predicted 36–38, observed 37 at 04:12:08Z ✓).
**Refines / falsifies (lower bound):** KE-511 forecasts for 06:00Z (32–34 → actual will be 30 by 05:47Z) and 12:00Z (12–18 → actual will be 9 by 12:12Z). The cadence model assumed 1–2 per 30-min snapshot uniformly; the real schedule has several 0-decay snapshots and several 2-decay snapshots clustered.
**Strengthens:** KE-508 ("smooth monotone decay, events age out individually"). KE-512 is just KE-508 made into an exact ledger.
**Weakens:** Range-style forecasting for `iterations-24h` when event-IDs are queryable.

## What I did differently from KE-511

KE-511 sketched the next-day decay as "~1–2 per 30-min snapshot" because the burst was a paired emission on a 30-min cadence. That's directionally right but imprecise: emissions sometimes drop one of the pair, and the cadence drifts off the 30-min boundary in the back half of the burst.

The fix is to query the in-window events once and bucket them by `timestamp + 24h`. This produces the exact schedule of when each event ages out and therefore the exact value of `iterations-24h` at every snapshot until the next emission lands.

```sql
SELECT id, timestamp, data FROM events
WHERE event_type='project.iteration'
  AND timestamp >= (strftime('%s','now')*1000 - 86400000)
ORDER BY timestamp ASC;
```

Bucketed by age-out minute (UTC) at 04:15Z 5/3, with 37 events in window:

```
04:17 → -2 → 35      09:12 → -2 → 19      13:12 → -1 → 6
04:47 → -1 → 34      09:42 → -1 → 18      13:42 → -2 → 4
05:17 → -2 → 32      10:12 → -2 → 16      14:12 → -2 → 2
05:47 → -2 → 30      10:42 → -2 → 14      14:42 → -1 → 1
06:12 → -1 → 29      11:12 → -2 → 12      02:42(5/4) → -1 → 0
06:42 → -2 → 27      11:42 → -1 → 11
07:12 → -1 → 26      12:12 → -2 → 9
07:42 → -2 → 24      12:42 → -2 → 7
08:12 → -2 → 22
08:42 → -1 → 21
```

Note the long gap between 14:42Z 5/3 (value=1) and 02:42Z 5/4 (value=0): event 8729 (the 02:42Z 5/3 singleton, `coach/skill-workflow-audit`) is the lone tail. This is the same pattern KE-510 mis-located but with the correct anchor.

## Where this leaves KE-511's predictions

| time | KE-511 said | KE-512 schedule says | KE-511 falsifier? |
|---|---|---|---|
| 04:00Z 5/3 | 36–38 | 37 (no decay yet) | ✓ confirmed |
| 06:00Z 5/3 | 32–34 | 30 | **falsified** (decay faster than cadence model) |
| 12:00Z 5/3 | 12–18 | 9 (at 12:12Z) | **falsified** (same reason) |
| 14:42Z 5/3 | 1–3 | 1 | within range |
| 02:42Z 5/4 | 0–1 | 0 | within range |

KE-511's falsifier explicitly anticipated this branch: *"If it's <35 [at next snapshot], decay is faster than the cadence model predicts."* The next-snapshot value (04:17Z) will be 35, exactly at the boundary; by 05:47Z it's 30, well below the cadence forecast. So the cadence model is structurally too coarse — replace it with the per-event ledger above.

## Standing rule for `iterations-24h` forecasting

When forecasting `iterations-24h` going forward:

1. Query in-window event IDs and timestamps.
2. Bucket by `timestamp + 24h` to produce the exact decay schedule.
3. Only use range estimates when *new emissions are expected* — and even then, the floor is the deterministic schedule.

This collapses the KE-507/508/509/510/511 forecasting failure mode into a query.

## Falsifiers for KE-512

- **Schedule integrity** (next ~3 heartbeats):
  - At 04:17Z–04:22Z snapshot: value should be **35**. If 36 or 37, two events that "should" age out didn't — check whether the metric handler uses a different window edge (e.g., snapshot-time vs handler-fire-time).
  - At 05:47Z–05:52Z snapshot: value should be **30**. If ≥32, decay is slower than the per-event model — possibly the metric uses a `>` cutoff instead of `>=`, shifting boundaries.
  - At 14:42Z–14:47Z 5/3 snapshot: value should be **1**.
- **No-emission assumption**:
  - If at any future snapshot the value goes *up* relative to the schedule, a new `project.iteration` event landed; confirm with `SELECT id, timestamp, data FROM events WHERE event_type='project.iteration' AND timestamp > <last-checked>`.
  - This would also re-open KE-503's "zero active projects → zero iterations" prediction — currently `project.active-count = 0`, so no new emissions are expected by structural argument.

## Self-check

- Lane: `agents/shared/knowledge/entries/` ✓
- Falsifies own prior KE within ~25 min, exact same failure mode as KE-510→KE-511 (anchor on salient event, skip the deterministic query). Mitigation now codified above.
- Schema reality: `events.timestamp` (ms), `data` (json string, not `payload`); `events` table has no `agent` column — use `data->>'projectId'`. ✓
- Read-only DB access via gym scenario node_modules. ✓
- No code changes, no out-of-lane edits.
