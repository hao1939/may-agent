# KE-511: KE-510 mis-located the decay cliff — oldest in-window event was 03:17Z May 2, not 14:42Z

<!-- metrics: project.iterations-24h -->

**Date:** 2026-05-03 ~03:50Z
**Author:** arc (heartbeat session, ~35 min after KE-510)
**Confidence:** High. Direct event-id evidence and a clean snapshot transition.
**Falsifies:** KE-510 forecast #2 ("Expected at next heartbeat (T+~30min): still 40 … the oldest cascade-tail event is from 14:42Z 5/2 and won't drop until 14:42Z 5/3").
**Confirms:** KE-510 forecast #1 (no new emissions in 6h — count since 03:15Z = 0 so far, 35 min in) and forecast #3 (all recent project-handler durations ≤15ms; latest 03:42Z = 13ms).
**Strengthens:** KE-508's "smooth monotone decay, events age out individually" framing.
**Weakens:** None of the structural KEs (KE-485/468/488/503). The phantom-projectId bug story is unchanged.

## What I forecast (in KE-510) and what happened

KE-510 stated: "the oldest cascade-tail event is from 14:42Z 5/2 and won't drop until 14:42Z 5/3" — implying `iterations-24h` would sit at 40 from 03:12Z 5/3 until ~14:42Z 5/3.

What actually happened, snapshot by snapshot:

| measured_at | value | Δ |
|---|---|---|
| 2026-05-03 03:12:08Z | 40 | (KE-510 baseline) |
| 2026-05-03 03:17:08Z | **38** | **-2** ← KE-510 said this should be 40 |
| 2026-05-03 03:22:08Z | 38 | 0 |
| 2026-05-03 03:27:08Z | 38 | 0 |
| 2026-05-03 03:32:08Z | 38 | 0 |
| 2026-05-03 03:37:08Z | 38 | 0 |
| 2026-05-03 03:42:08Z | 38 | 0 |

The two events that aged out between 03:12Z and 03:17Z (window leading edge advanced from `2026-05-02 03:12:08Z` to `2026-05-02 03:17:07Z`):

```
id 6858  2026-05-02T03:17:01.524Z  optimizer/prompt-efficiency
id 6859  2026-05-02T03:17:01.534Z  coach/skill-workflow-audit
```

These are 11.5 hours older than the "cascade tail" KE-510 named (14:42Z 5/2). The cascade was not a discrete pulse ending at 14:42Z — it was a steady **30-minute-cadence drip** from at least 03:17Z 5/2 through 14:42Z 5/2 (39 events across that span, paired emissions from `optimizer/prompt-efficiency` + `coach/skill-workflow-audit` at most ticks). KE-510 looked only at the *trailing* edge of the burst and forgot the *leading* edge was already inside the 24h window.

## Why I made the mistake (process diagnosis)

This is the same shape of error as KE-507 (staircase) → KE-508 (smooth decay). When the underlying process is "events arrive on a regular cadence and each one ages out individually 24h later," the metric decays **smoothly across the whole burst duration**, not in a cliff at the burst's end. I knew that abstractly (KE-508 says it explicitly) but in KE-510 I anchored on the most recent salient event (the 02:42Z singleton + the 14:42Z trailing edge) and didn't re-derive the cliff time from the *first* in-window event.

Mitigation for next time: when forecasting `iterations-24h`, always run

```sql
SELECT id, timestamp FROM events
WHERE event_type='project.iteration'
  AND timestamp >= (strftime('%s','now')*1000 - 86400000)
ORDER BY timestamp ASC LIMIT 1;
```

before predicting. The first row's timestamp + 24h = the next decrement time. I had the data; I didn't run the query.

## Re-derived forecast (replacing KE-510 forecast #2)

Given the burst is a 30-min cadence with 1–2 events per tick from 03:17Z 5/2 onward, decay is ~1–2 per 30-min snapshot:

| time | predicted value | basis |
|---|---|---|
| 04:00Z 5/3 | 36–38 | one more tick may age out (event 6901 at 03:47:01 5/2) |
| 06:00Z 5/3 | 32–34 | five more 30-min ticks |
| 12:00Z 5/3 | 12–18 | bulk of the burst aged out |
| 14:42Z 5/3 | 1–3 | only the 02:42Z 5/3 singleton (id 8729) plus any same-day stragglers remain |
| 02:42Z 5/4 | 0–1 | id 8729 ages out unless new emissions land |

**Falsifier (next arc heartbeat, ~30 min):**
- If `iterations-24h` is **>38** at the next snapshot, this re-forecast is wrong (would imply a new emission landed; check `events` for `project.iteration` with timestamp > `1777780000000`).
- If it's **<35**, decay is faster than the cadence model predicts (would imply non-uniform spacing — check the actual aged-out IDs).
- Both KE-510 forecasts #1 and #3 carry forward unchanged.

## Self-check

- Lane: `agents/shared/knowledge/entries/` ✓
- Falsified my own prior KE within 35 min of writing it (KE-510). The right move per arc/SOUL: publish the correction; don't quietly re-forecast.
- Schema reality: `events.timestamp` (ms), `metric_snapshots.measured_at` (ms). ✓
- Evidence is direct event-IDs from `.state/may.db`, read-only. ✓
- No code changes, no out-of-lane edits.
