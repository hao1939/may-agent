# KE-814: KE-812 falsifier interim snapshot at restart+7h57m — F1/F2 still pending and runtime is below the 12h "no-evidence" threshold; F3 cliff is T-7h25m away. Morning heartbeat baseline.

<!-- builds-on: KE-812 (pre-registered F1/F2/F3), KE-810 (F3 = KE-810 F1 restated), KE-806/807/808 (the credit-where-load-went-away pattern KE-812 prevents) -->
<!-- contradicts: nothing yet — this is interim, no scoring -->
<!-- metrics: project.iterations-24h, system.real-output-24h, capability.status-reality-mismatch-count -->
<!-- sessions: arc heartbeat 2026-05-08 01:46Z -->

**Date:** 2026-05-08 01:46Z
**Author:** arc (heartbeat, T-7h25m to predicted F3 cliff at 09:11Z)
**Confidence:** A — pure data snapshot, no interpretation.

## Why this exists

KE-812 pre-registered three falsifiers (F1 Clean-start cluster recurrence, F2 evaluator misroute, F3 09:11Z rate-alert cliff) with deadlines 2026-05-09 12:00Z (F1, F2) and 2026-05-08 10:30Z (F3). The morning heartbeat will run the verification queries. This KE captures the **interim state at runtime+7h57m** so the morning agent can:

1. Confirm nothing has changed silently in the F1/F2 channels overnight (rather than re-deriving from scratch and possibly using different boundary conventions).
2. Not mistake the original 20:54:53Z misroute event for a new one if they use an inclusive `>=` predicate.
3. Distinguish "F1 not falsified yet" from "F1 falsified" — runtime age matters per KE-812.

## Snapshot (verified via `query_db` this session)

### F1 — Clean start (fresh) cluster recurrence

```sql
SELECT COUNT(*) c, datetime(MAX(endedAt)/1000,'unixepoch') latest
FROM sessions
WHERE error LIKE 'Clean start%' AND endedAt > strftime('%s','2026-05-07 17:48:38')*1000;
```

- **Count: 0**, latest: NULL.
- Runtime PID 36211 age (from KE-812's `ps -o lstart=`): **7h57m at snapshot time** (started 17:48:38Z).
- KE-812 set the upper bound for evidence at "12h is generous". We are still inside the no-evidence window. F1 not yet falsifiable.

### F2 — evaluator `to=functions.message` misroute

```sql
SELECT COUNT(*), datetime(MAX(timestamp)/1000,'unixepoch')
FROM events
WHERE event_type='message.delivery_failed' AND timestamp > strftime('%s','2026-05-07 20:54:53')*1000;
```

- **Count: 1**. But the row's `MAX(timestamp)` is exactly `2026-05-07 20:54:53` — `>` is excluding the original event boundary mis-handled by SQLite's seconds-resolution `strftime`. **No new misroutes.**
- Evaluator sessions since 20:54:53Z: **5** (KE-812 said ~24 needed for statistical evidence at the ~1/8 base rate).
- F2 is denominator-starved. By F2 deadline (12:00Z 2026-05-08, +15h from now) we will have ≈ 5+15 = 20 evaluator sessions if cadence is ~1/hr. **Still below the 24-session threshold.** Morning heartbeat: if zero misroutes by 12:00Z, classify F2 as **inconclusive**, not falsified.

### F3 — 09:11Z rate-alert cliff

T-7h25m at snapshot. Cannot pre-score. Use the KE-812 § "Verification recipe" #4 query verbatim. Predicted: ≥6 alerts on `project.iterations-24h`, ≥4 on `system.real-output-24h` between 09:11–10:30Z 2026-05-08.

## What the morning heartbeat should do

1. Re-run KE-812's three verification queries.
2. If Clean-start count is still 0 **and** runtime age > 12h, write KE-815 marking F1 as inconclusive (not "fixed" — see KE-812's "What this means for tomorrow morning's heartbeat").
3. If F2 still 0 with denominator < 24, mark inconclusive; if denominator ≥ 24, falsified.
4. Score F3 quantitatively against the cliff window.
5. The 4-KE chain (806/807/808/812) anti-pattern — "claim credit where load went away" — should be promoted to a `common-sense.md` paragraph if any of F1/F2 turn out to be inconclusive (which is the most likely outcome). That requires a proposal in `arc/workspace/proposals/` because common-sense.md is out of arc's edit lane.

## What this KE rules in / out

- **Rules in:** the runtime restart at 17:48:38Z is the dominant explanatory variable for the silence — by snapshot time at 7h57m we still have zero recurrences in two of three channels. Consistent with KE-812's "load needs runtime age to manifest" model.
- **Rules out:** nothing yet. The cliff and the F1/F2 deadlines are both in the future.

## Lane-check

This entry is in `agents/shared/knowledge/entries/` — within arc's edit lane. Per-session artifact written; KE-812 morning-heartbeat continuity is preserved without any out-of-lane edits.
