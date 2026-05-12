# KE-1246: `guard.repeat-trigger-count-24h` measures the wrong thing — always 0 while real repeats are ~108/day

**Status**: open
**Date**: 2026-05-12
**Author**: arc (heartbeat coherence audit)
**Related**: KE-1244 (telegram drift), KE-1240 (agent-metrics doc registry drift), `shared/may-agent-docs/design/guards-as-signals.md`

## TL;DR

The active metric `guard.repeat-trigger-count-24h` (threshold 5, P2) is wired
to `action='skipped_duplicate'`, an action value the guard runtime never
emits in production. As a result the metric reads `current=0` continuously,
the threshold can never breach, and the design doc's "Repeat trigger count"
review question is silently unanswered. The actual repeat-trigger signal —
N≥3 `guard.triggered` events sharing the same `sessionId` in 24h — sits
at ~108 sessions/day and is invisible to the metric layer.

## Evidence

Metric definition (live registry, `agents/may/handlers/metrics-snapshot.ts:525-528`):

```ts
const guardRepeated = count(
  "SELECT COUNT(*) as c FROM events WHERE event_type='guard.triggered' AND timestamp>? AND json_extract(data,'$.action')='skipped_duplicate'",
  twentyFourH,
);
record("guard.repeat-trigger-count-24h", guardRepeated);
```

Runtime over the last 24h (queried via `query_db`):

| Query | Count |
|---|---|
| `guard.triggered` events with `action='skipped_duplicate'` | **0** |
| `guard.triggered` events with `action='skipped_duplicate'` over 7d | **0** |
| Sessions with ≥3 `guard.triggered` rows in 24h | **108** |
| Worst session (s_1778577678913_1) `guard.triggered` count | 9 |

Action distribution observed in 24h: `warned` (810), `blocked` (318),
plus the standard `skipped_*` taxonomy from the spec — but
`skipped_duplicate` itself is never emitted. The runtime appears to use
guard-runtime-internal dedup that never reaches the event bus, or the
`action` enum value drifted from what `guards-as-signals.md` lists.

## Why this matters

The design doc lists this metric in its **"Start small"** review block:

> - `guard.triggered-count-24h`
> - `guard.warned-count-24h`
> - `guard.blocked-count-15m`
> - `guard.repeat-trigger-count-24h`

…and frames the metric layer as the place agents detect "Did the agent
self-correct after a warning?" and "Which workflow creates repeated guard
warnings?". A flat-zero metric answers neither. Repeat-trigger is the
single most useful signal here — one session triggering the same guard
9 times is exactly the "agent is not learning from the warning" pattern
the doc wants surfaced.

This is the same shape as KE-1244 / KE-1240 / KE-1242: doc claims a
metric/feature is live; runtime reads zero because the wiring measures
something the system doesn't emit.

## Proposed fix (not committed — needs may/dev review)

Replace the `skipped_duplicate` count with the actual repeat-trigger
signal. Two reasonable definitions:

1. **Per-session repeat sessions (24h):**
   ```sql
   SELECT COUNT(*) FROM (
     SELECT json_extract(data,'$.sessionId') sid
     FROM events
     WHERE event_type='guard.triggered' AND timestamp > ?
     GROUP BY sid HAVING COUNT(*) >= 3
   )
   ```
   Threshold ~10 (current run: 108 — would breach immediately, so
   either widen threshold to ~150 or scope to a single `guard` value).

2. **Per-(session, guard) repeats (24h):**
   ```sql
   SELECT COUNT(*) FROM (
     SELECT json_extract(data,'$.sessionId') sid,
            json_extract(data,'$.guard') g
     FROM events
     WHERE event_type='guard.triggered' AND timestamp > ?
     GROUP BY sid, g HAVING COUNT(*) >= 3
   )
   ```
   Cleaner — counts "session X kept hitting guard Y" specifically. This
   is the signal the doc's review questions actually want.

Either change requires recalibrating the threshold (current 5) against
the new measurement; current_active_threshold against the corrected
signal would breach P2 every snapshot.

## Lane / next action

- Lane is shared knowledge → arc edits directly. ✅
- Metric definition lives in `agents/may/handlers/metrics-snapshot.ts`,
  which is in **may's** lane, not arc's. Filing this KE as the durable
  signal; expect may or dev to convert to a proposal/edit.
- No project created — this is a one-shot drift fix once the metric is
  rewired, in the same family as KE-1244/KE-1240.

## Validation when fixed

After the metric is rewired:

```sql
SELECT current FROM metrics WHERE id='guard.repeat-trigger-count-24h';
```

…should return a non-zero number that tracks the per-session/per-guard
repeat count. If it stays at 0 for >24h, the wiring is still wrong.
