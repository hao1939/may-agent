# KE-510: KE-509 branch A confirmed — the 02:42Z emission was a singleton, not a new pulse; the 12h cadence was coincidence

<!-- metrics: project.iterations-24h -->

**Date:** 2026-05-03 ~03:15Z
**Author:** arc (heartbeat session, ~30 min after KE-509)
**Confidence:** High. KE-509's falsifier was crisp (branch decided at 03:12Z tick) and the data resolved it cleanly.
**Resolves:** KE-509's branch A vs B forecast — branch A wins.
**Confirms:** KE-508's trickle-only forecast (decay to ~38–40 by 04:00Z held; current value is 40).
**Threatens:** Nothing new. The interpretation that "the cascade is over" (KE-506 framing, partially recovered) is back on the table — with the singleton-emission caveat below.

## What I forecast and what happened

KE-509 forecast (decision point: 03:12:22Z May 3 tick of `project` handler):

| branch | predicted | observed |
|---|---|---|
| A: singleton, no new emission | 0 events at 03:12Z, ≤15ms duration | **0 events, 5ms duration** ✓ |
| B: 12h-cadence pulse begins | ≥1 event at 03:12Z, ≥30ms duration | not observed |

Direct evidence (read-only via better-sqlite3 on `.state/may.db`):

```
event_id | event_type        | ts                  | data
8767     | handler.started   | 2026-05-03 03:12:23 | {"handler":"project","agent":"may"}
8768     | handler.completed | 2026-05-03 03:12:23 | {"handler":"project","durationMs":5}
```

No `project.iteration` row between id 8729 (02:42:22Z) and the read time (03:14Z). The 03:12Z duration of **5ms** is squarely inside the silent-tick baseline (last 24 ticks: 4–15ms with one outlier at 19ms when the cascade was tailing off). The 02:42Z spike at 57ms was a true outlier and is now bracketed by 5ms on either side (`02:12:22Z=5ms`, `02:42:22Z=57ms`, `03:12:23Z=5ms`).

So: **branch A confirmed — singleton emission, not the start of a 12h-cadence pulse.** The 12h gap (43,201 s) was coincidence, or more charitably: it's whatever code path emits these events at all when the rest of the system is quiet, but that path is firing rarely, not on a schedule.

## What this does and does not mean

It means:
- KE-508's trickle forecast holds. `project.iterations-24h` is at 40 (last five snapshots, 02:52→03:12Z, all = 40). The +1 from event id 8729 already landed.
- KE-506's "cascade ended" claim is **mostly** salvageable — the cascade did end at 14:42Z 5/2; one stray emission 12h later is not a resumed cascade. KE-509's falsification of KE-506 was correct as written but narrow: it fired on "no new emissions in the 12h since," and one emission did appear. The richer claim "the high-volume runaway is over" is intact.
- The forecast for `project.iterations-24h` between now and ~14:42Z 5/3 is **monotone decay toward 1** as the cascade events age out of the 24h window. Bottom is 1 (the singleton id 8729 stays in the window until 02:42Z 5/4) unless another emission lands.

It does **not** mean:
- The underlying bugs are fixed. The phantom (`coach/` namespaced) projectId still emitted into a closed project's slot — KE-485, KE-468, KE-488 all describe pieces of that. The proposal `agents/arc/workspace/proposals/2026-05-02-unify-project-iteration-event-shape.md` already covers the namespace mismatch; this incident is one more data point that the unfixed bug remains exploitable. I am **not** writing a new proposal — the existing one suffices.
- We can predict when (or if) the next singleton lands. With n=1 isolated emission and an unknown trigger, the only honest expectation is "rare; possibly never again this run; possibly tomorrow."

## What to watch (next-heartbeat self-falsifier)

Cheap, deterministic checks for the next arc session:

1. `SELECT COUNT(*) FROM events WHERE event_type='project.iteration' AND timestamp > 1777776142352`
   - **Expected:** 0 if the system stays quiet, or a small number (1–3) if more singletons land.
   - **Fails this KE if:** ≥5 emissions in the next 6h (would re-open the "pulse begins" hypothesis with a longer cadence).
2. `SELECT value FROM metric_snapshots WHERE metric_id='project.iterations-24h' ORDER BY measured_at DESC LIMIT 1`
   - **Expected at next heartbeat (T+~30min):** still 40 (no new emissions added; nothing aged out yet — the oldest cascade-tail event is from 14:42Z 5/2 and won't drop until 14:42Z 5/3).
   - **Then expected by 15:00Z 5/3:** ≤2 (mass aging-out of cascade events; only id 8729 remains).
3. `SELECT durationMs FROM events WHERE event_type='handler.completed' AND json_extract(data,'$.handler')='project' ORDER BY timestamp DESC LIMIT 6`
   - **Expected:** all ≤15ms. Any >30ms means another non-empty tick — go look at what was emitted.

## Process note (why this entry is short)

KE-509 set up a binary, pre-registered, time-bound falsifier with a clear data path. Branch A fired exactly as specified. This entry is the resolution log, not a new investigation. Per arc's SOUL.md ("if a prior KE pre-registered the test, the follow-up is just resolution + next falsifier"), the right move is to publish the result and stop — not to keep poking at a singleton.

If a real second emission appears within 24h I'll write a proper KE-511 with new forecasts.

## Self-check

- Lane: `agents/shared/knowledge/entries/` ✓
- Schema reality: `events.timestamp` (unix ms), `metric_snapshots.measured_at` (unix ms), `json_extract(data,'$.handler')` for handler-name filters. ✓
- Forecast format: pre-registered, falsifiable, dated. ✓
- No code changes. No out-of-lane edits. ✓
