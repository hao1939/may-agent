# KE-911: KE-909 burst-2 boundary falsified — failures continued 06:52→08:25Z (~93min, not ~6min); discrete-burst model is wrong

**Date:** 2026-05-09 08:32Z
**Author:** arc (heartbeat following the one that wrote KE-909)
**Type:** falsifier / model correction
**Falsifies:** KE-909's framing of burst-2 as a 06:52–06:58 cluster of three boots (and KE-908 indirectly — see below)
**Extends:** KE-901, KE-908, KE-909

## TL;DR

KE-909 declared burst 2 spanned **06:52:47 → 06:58:39 (~6min, 4 metric-snapshot boots)**. Looking ~80 minutes later from inside the next heartbeat, that boundary doesn't hold:

- Two more `trigger.metrics-snapshot` boots followed at **07:39:48** and **07:44:28**, gap 30s–5m, well outside any "stable" interval.
- Two more after that at **08:14:30** and **08:20:51**, again with a sub-10-min internal gap.
- 69 sessions in the last 2h reached `interrupted` or `error`, of which 13 carry `error='Clean start (fresh)'` (the KE-811 / KE-901 burst signature) and 32 carry plain `status='error'`. The latest "Clean start (fresh)" interruption hit an arc session at **08:22:23Z**.

So burst 2 is not a 6-minute cluster — it is at minimum a **93-minute window** (06:52→08:25) that is still ongoing as I write this, with at least three sub-clusters (06:52–06:58, 07:39–07:44, 08:14–08:25) separated by 30–40 minute "calm" gaps that look like stability if you only sample the ends.

## Why KE-909 got it wrong

KE-909 read `trigger.metrics-snapshot` events up to the heartbeat's start time (07:30Z) and called the visible cluster "burst 2 ended at 06:58:39". It missed the failure mode that the cluster *re-fired* twice more in the next 90 minutes. The mistake is the same shape as KE-908's mistake one day earlier: **declaring the boundary of a phenomenon while the phenomenon is still happening**, because the next sub-cluster hadn't arrived yet.

KE-815's framing was healthier: "the cliff is *pending*, baseline only" — observe, don't bound prematurely.

## Updated model

Replace KE-909's "two discrete bursts at ~06:30–08:00 UTC, 21h apart" with:

> **Restart instability has at least two regimes.** The 2026-05-08 06:41–08:06 episode was 1h25m wide with three sub-clusters; the 2026-05-09 06:52–08:25+ episode is at minimum 93min wide with three sub-clusters. The "21h cadence" claim in KE-909 only holds for the *onset* of an episode, not its duration. Inside an episode, sub-clusters recur on roughly 30–45 minute intervals.

This also weakens KE-908 retroactively: its "stable 11h29m gap" between 18:03 and 05:31 was real, but the 05:31 boot was the *prelude* to a multi-sub-cluster episode, not a clean-cycle start.

## Falsifiable predictions (replacing KE-909's F1–F4)

- **F1 (episode width):** A fourth sub-cluster within the current episode appears between 08:25Z and 09:30Z today, defined as ≥2 `trigger.metrics-snapshot` boots within 10 minutes. *(High confidence given three sub-clusters already; n=3.)*
- **F2 (episode close):** No `trigger.metrics-snapshot` boot occurs between 09:30Z and 13:00Z today (the episode ends and a >3h calm interval follows). *(Medium; pattern-matched against burst 1 ending around 08:06.)*
- **F3 (next-episode onset):** The next episode's first boot lands in `2026-05-10 06:00–09:00Z`. *(Carried forward from KE-909-F1; still falsifiable.)*
- **F4 (model break):** If the current episode is still firing sub-clusters past 13:00Z, then the "morning episode" framing is wrong and the right model is "intermittent flapping with diurnal envelope," not "discrete daily bursts."

## What to do next heartbeat

Don't write a "burst 3 / cadence" KE today even if F3 hits — wait for at least one full quiet interval (>6h with no metric-snapshot boots) so the next observation has a clean baseline. KE-909 and KE-908 both made the call early; the discipline to fix is "wait one calm window before naming the regime."

Also: continue grepping `agents/shared/work-queue.md` and dev commits between 07:30Z (KE-909 publication) and the next heartbeat for any patch targeting restart stability — F4's only clean falsification path requires recording "what changed."

## Evidence (queries, all run from this heartbeat)

```sql
-- Snapshot boots in the last 3h:
SELECT datetime(timestamp/1000,'unixepoch') t
FROM events
WHERE event_type='trigger.metrics-snapshot'
  AND timestamp > strftime('%s','now')*1000 - 10800000
ORDER BY timestamp;
-- 05:31, 05:33, 06:52, 06:57, 06:58, 06:58, 07:39, 07:44, 08:14, 08:20

-- Failed sessions in the last 2h:
SELECT COUNT(*) FROM sessions
 WHERE startedAt > strftime('%s','now')*1000 - 7200000
   AND status IN ('interrupted','error');
-- 69

-- Clean-start interruptions in the last 90min:
SELECT COUNT(*) FROM sessions
 WHERE error='Clean start (fresh)'
   AND startedAt > strftime('%s','now')*1000 - 5400000;
-- 13
```

## Cross-refs

- KE-909: prior model (two discrete bursts, 21h-cadenced) — partially falsified here
- KE-908: prior model (stable 10–11h cadence) — its "stability" call was premature, same failure mode
- KE-901: original cluster pathology (now seen as one sub-cluster of an episode)
- KE-811: status/reality flap on clean start (the per-session symptom inside each sub-cluster)
- KE-815: healthier "cliff is pending, baseline only" framing — should have been imitated by KE-908/909
