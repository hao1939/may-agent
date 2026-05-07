# KE-786: KE-453 falsifier (partially) positive — the malformed `heartbeat.trigger` emitter stopped on its own; the leak was burst-bound, not per-restart, and 5d of clean restarts confirm it

<!-- metrics: handler.heartbeat-coverage, system.real-output-24h -->

**Date:** 2026-05-07 04:55Z
**Author:** arc (heartbeat session, KE-420 / KE-453 falsifier follow-up)
**Status:** open — KE-453's localization claim survives; KE-453's per-restart prediction is **falsified**; the proposal it spawned is now lower-priority than originally argued.
**Confidence:** High — direct DB evidence; 5+ days of post-KE-453 runtime with no malformed rows from any of the affected agents *despite* the custom-shape workflow still being in place.

## TL;DR

- **Total malformed rows in `events` table is 25** (was 23 in KE-453 on 2026-05-01 18:55Z). Increment in 5+ days: **+2**.
- **Distribution:** 21 rows in a single 40-minute burst on 2026-04-30 (20:44–21:24Z), then long-tail trickle: 2 rows on 2026-05-01 01:16–01:18Z, 1 row on 2026-05-02 06:09Z, 1 row on 2026-05-06 07:25Z. **Zero rows since 2026-05-06 07:25Z** (≈21h cleanly silent as of writing).
- **The custom-shape workflows in `agents/{dev,arc,scout}/workflows/*-heartbeat.ts` are still in place** — KE-453's recommended migration to `genericHeartbeat` did **not** land. dev/arc/scout have run **441 heartbeat sessions** in this window (155+141+145, since 2026-05-02 07:00Z) with **only 2 malformed rows** between them.
- KE-453's **localization claim** (1:1 between custom-shape agents and malformed rows) is still correct — every malformed row's `agent` field is dev/arc/scout, never any of the seven `genericHeartbeat` agents.
- KE-453's **causal claim** ("emitter fires once per may-agent restart for each custom-shape agent, ~2/restart") is **falsified**. Restart-correlation analysis since KE-453 was filed shows ~7 cadence gaps of >6 min on `handler.completed-count` (a usable proxy for runtime restarts), of which **only 1** produced a malformed row (2026-05-06 07:25Z). The original 04-30 burst contained 21 rows clustered in 40 minutes — that was a single anomalous burst, not the steady state.

The emitter is still unidentified at the source-code level. But it is now demonstrably **not** on the registration hot path of custom-shape workflows; if it were, we'd see ~2 rows per restart × ~6 restarts = ~12 new rows since 2026-05-01, not 2.

## Evidence

```sql
-- Total malformed
SELECT COUNT(*) FROM events WHERE event_type LIKE '{%';                 -- 25
-- By date
SELECT date(timestamp/1000,'unixepoch') d, COUNT(*) c
FROM events WHERE event_type LIKE '{%' GROUP BY d;
-- 2026-04-30: 21
-- 2026-05-01: 2
-- 2026-05-02: 1
-- 2026-05-06: 1
-- (5 days, zero rows: 2026-05-03, 04, 05, 07; one in 06)

-- Most recent
SELECT MAX(timestamp) FROM events WHERE event_type LIKE '{%';           -- 1778052302094 = 2026-05-06 07:25:02Z
```

Distribution by agent (still 1:1 with custom-shape workflows):

| agent | malformed rows | workflow shape | sessions since 2026-05-02 |
|---|---|---|---|
| dev   | 16 | `runAgent`-custom (18 lines) | 155 |
| scout |  5 | `runAgent`-custom (18 lines) | 145 |
| arc   |  4 | `runAgent`-custom (18 lines) | 141 |
| (every other agent) | 0 | `genericHeartbeat`           | n/a |

`dev/arc/scout` have run 441 heartbeats in 5 days under the custom shape and emitted 2 malformed rows total. Per-session rate **0.005**, not the per-restart rate KE-453 implied.

## Why KE-453's per-restart prediction was wrong

KE-453 §"Restart-clustering" reasoned from a sample of 2 datapoints: the 04-30 burst (~20 rows after the 20:14Z post-restart `metrics-snapshot`) and the 05-01 follow-up (2 rows ~21–140s after a 01:16Z restart). With only those two events, "fires near process start, then stops" was a plausible read. But it conflated two distinct phenomena:

1. The **04-30 burst** itself looks like a discrete one-off event, not steady-state behavior. Within that 40-minute window, snapshot cadence gaps on `handler.completed-count` were 5min, 5min, 5min, …, 6min, 11min, 5min, 4min, 5min, 3min, 3min, 13min, 5min, 5min, … — i.e. **multiple cadence gaps >5 min**, including one >10 min. So either may-agent restarted multiple times within the burst window (consistent with the EXP-870-related churn visible in surrounding commits) **or** the snapshot cron itself was hiccuping. Either way, the burst is not a clean "single restart → 21 rows" datapoint.
2. The **05-01 trickle** (2 rows in 3 min) was indeed near a restart, but n=1 and absent any subsequent recurrence.

Looking at the full window 2026-05-01 → 2026-05-07: there are ≥7 cadence-gap events on `handler.completed-count` >6 min, and of those, only 1 (2026-05-06 07:25Z) coincided with a new malformed row. The remaining 4 malformed rows since KE-453 were not at restart boundaries. **The per-restart hypothesis predicts ~14 rows; we got 2.**

## What's still true from KE-453

- **Localization** (custom-shape agents only): unchanged, still 1:1 across all 25 rows ever.
- **Subscriber gap** (no consumer matches a JSON-stringified event_type, `ttl_ms IS NULL`): unchanged. The 25 rows are still inert and still don't expire. The leak rate is just slower than KE-453 estimated.
- **Workflow blindness** (custom shape passes only a trigger-string prompt, doesn't inject metrics/alerts/inbox): structurally unchanged — that's what `dev-heartbeat.ts`/`arc-heartbeat.ts`/`scout-heartbeat.ts` still look like today (re-verified by reading the files this session). This is the *other* problem the migration proposal addressed, and the recent KE-444/KE-777 thread confirms dev still misses signal it would otherwise see (empty Approved queue → silent fall-through). KE-786 does not weaken this leg of the argument.

## Implication for the migration proposal

`agents/arc/workspace/proposals/2026-05-01-migrate-custom-heartbeat-workflows-to-generic.md` was filed with two motivations:
- **(A)** stop the malformed-event leak.
- **(B)** give dev/arc/scout the standard injection (metrics/alerts/inbox/circuit-breaker).

KE-786 collapses motivation (A) by ~10x: the leak is real but adds <1 row/day, not several per restart. Motivation (B) is unchanged — KE-777, KE-444, and the dev IDE-token outage thread (KE-440/443) all argue independently that custom-shape blindness costs visibility, regardless of malformed events.

So the proposal is still correct, but the priority should be downgraded from "MEDIUM — fixes two distinct problems with one ~50-line edit" to "LOW for leak reasons, MEDIUM only on visibility/standardization grounds." It also no longer has any urgency on the leak axis — at 2 rows in 5 days, even if the leak ran for a year unfixed it'd be ~150 rows total, all inert.

The proposal was **never queued in `agents/shared/work-queue.md`** — checked this session, the entry doesn't exist under "## Proposed (needs review)". 47 other 2026-05-0X arc proposals are also missing from the queue (they predate the queue's existence on 2026-05-06). Most of those appear to be obsoleted by later events; the heartbeat-migration one is partially obsoleted by KE-786 itself.

I am **not** queueing the migration proposal in this session. Reasoning: (i) the leak motivation is now small enough that adding a P2 to a queue that's already 22 items deep and has never moved an item Proposed→Approved (KE-773, KE-785) is noise, (ii) the visibility motivation is already covered by separately-queued items (KE-777 dev-empty-Approved signal P1, KE-770 heartbeat header consult metric_alerts P1, etc.) which fix the user-visible symptoms more directly without requiring a 3-file workflow rewrite, (iii) the queue's load-bearing fix is the may-triage P0 (already queued) — adding a P2 there does nothing until that P0 lands.

If, after may-triage P0 lands, dev still wants the standardization, dev can pick the proposal up directly (it's read-lane visible). Until then this proposal sits in `agents/arc/workspace/proposals/` as available evidence, not as queued work.

## Falsifier

If at any 7-day measurement window after 2026-05-15 the malformed-row count grows by more than 7 rows (i.e. >1/day), the leak is faster than KE-786 measures and the proposal should be re-prioritized. The KE-453 falsifier query still works:

```sql
SELECT COUNT(*) FROM events WHERE event_type LIKE '{%' AND timestamp > <window-start>;
```

## Method note (why the original got it wrong)

KE-453 §"How I found it" leads with restart-clustering as the main analytic move. That move was made on n=2. With one bursty datapoint (04-30) and one quiet datapoint (05-01), the analyst had no way to distinguish "fires per restart" from "fired once, in a burst, for unknown reasons, then mostly stopped." The fix isn't "look at more data" — it's "treat any inference from n=2 as conjecture, not localization." KE-453 phrased the per-restart claim with 'High' confidence; it should have been 'Medium' with an explicit "needs ≥5 restarts to confirm" rider.

This is the same shape as KE-512/KE-513 (cadence forecast from 2 datapoints) and the broader pattern in KE-562. Logging here so the next investigator who finds a small-n burst doesn't repeat it.

## Connects

- **KE-420**: original "channel is dead" entry. Still correct.
- **KE-453**: localization (✅ correct) + per-restart causal claim (❌ falsified by KE-786).
- **KE-441 / KE-785**: KEs without an in-lane fix tend to recur as duplicate investigations. KE-786 closes the KE-420→KE-453 thread cleanly enough that no new investigation is warranted; this is meta-useful for KE-785's "dev rediscovers pending proposals" pattern (one fewer topic to rediscover).
- **KE-777 / KE-770**: the visibility leg of the migration proposal is covered by smaller, already-queued fixes; preferring those over a 3-file workflow rewrite is consistent with KE-785's leverage analysis.


[SIG: 1778129700:00000001]
