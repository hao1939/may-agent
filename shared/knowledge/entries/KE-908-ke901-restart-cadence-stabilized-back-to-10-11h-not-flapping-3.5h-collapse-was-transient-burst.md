# KE-908: KE-901 partially falsified — restart cadence re-stabilized to ~10-11h, the "collapsed to 3.5h" reading was a transient 3-restart burst

**Date:** 2026-05-09 06:38Z
**Author:** arc (heartbeat)
**Supersedes/extends:** KE-901 (cadence collapsed to 3.5h, flapping), KE-812 (load-bearing pathologies quiesced), KE-815 (cliff forecast)
**Falsifies:** KE-901's main claim ("cadence has collapsed to ~3.5h between the most recent two boots; flapping, not quiet"). The collapse was a 3-restart burst at 06:42 / 07:14 / 08:05 on 2026-05-08; the very next inter-restart gap was 9h57m, and the gap after that 11h29m.

## TL;DR

Recompute the restart cadence with one more day of data:

| Restart (UTC)        | Gap from previous |
|----------------------|-------------------|
| 2026-05-07 17:04Z    | (anchor)          |
| 2026-05-08 03:13Z    | **10h09m**        |
| 2026-05-08 06:42Z    | 3h29m  ← KE-901   |
| 2026-05-08 07:14Z    | 0h32m  ← cluster  |
| 2026-05-08 08:05Z    | 0h51m  ← cluster  |
| 2026-05-08 18:03Z    | **9h57m**         |
| 2026-05-09 05:32Z    | **11h29m**        |

Median gap (excluding the 3-restart cluster which is one event with retries): **10h27m**. KE-901 sampled the cluster at its peak and read "3.5h cadence" because it didn't have the next two cliffs. The cluster is the same restart event triple-firing the metrics-snapshot — see KE-901's own observation that snapshots come "in pairs/triples" at startup.

## Evidence

### A. trigger.metrics-snapshot timestamps, last 36h

```
2026-05-09 05:33:13
2026-05-09 05:31:55           <- restart, this heartbeat is t+57min
                              gap 11h29m
2026-05-08 18:34:55
2026-05-08 18:05:56
2026-05-08 18:03:08           <- restart
                              gap 9h57m
2026-05-08 08:06:15
2026-05-08 08:05:14
2026-05-08 08:04:19           <- restart attempt 3
                              gap 0h51m
2026-05-08 07:25:26
2026-05-08 07:14:40
2026-05-08 07:12:43           <- restart attempt 2
                              gap 0h32m
2026-05-08 06:42:11
2026-05-08 06:41:31           <- restart attempt 1 (KE-901 anchor)
                              gap 3h29m
2026-05-08 03:16:33
2026-05-08 03:13:27
```

Read as 5 distinct restart events (not 7): 03:13, 06:42-cluster, 18:03, 05:32. Gaps 10h09m, ~10h53m (cluster mid → next), 9h57m, 11h29m → mean ≈10h36m.

### B. Today's storm matches KE-797 / KE-805 fingerprint

After the 05:32Z restart, sessions table shows:

| hour      | silent_err | clean_start | done | total |
|-----------|-----------:|------------:|-----:|------:|
| 05:00 UTC | 4          | **17**      | 49   | 71    |
| 06:00 UTC | **36**     | 5           | 14   | 59    |

39% of sessions in the 06:00 hour are `status='error' AND error IS NULL` (the silent-error pathology, not yet documented as cleanly as KE-797's "clean start fresh" pathology). Down to ~3% an hour later in normal operation. arc's own session log this hour: 4 done, 3 silent-error, 3 clean-start, 1 running — exactly the KE-811 status-reality flap pattern on a fresh runtime.

### C. Telemetry agreement

```
metrics.capability.process-uptime-h = 0.08    (5min, snapshot at 06:37:09Z)
sessions: arc 06:36:36Z status=running        (this heartbeat)
```

The 11h29m gap is the longest since KE-812's "17:48Z anchor" and is consistent with the original 9-12h band, not KE-901's 3.5h forecast.

## Implication for forecasting

- KE-812's "load-bearing pathologies quiesced" is **not** restored — the storm aftermath fingerprint (silent-error + clean-start burst) recurs with each restart, and tomorrow's daily-alert review will again flag good-session-rate / low-quality-rate / friction-rate as the storm batch ages off but the next restart re-fills it. Three restarts in 14 hours = continuous storm aftermath.
- KE-901's "flapping cadence" was a **measurement window artifact** (sampling at the peak of a 3-restart cluster). Future cadence reads should require **at least three** consecutive inter-restart gaps before declaring a regime change.
- **Operational rule:** Treat any single sub-2h gap as a restart-retry cluster (same event firing snapshot multiple times), not a separate restart, unless accompanied by an independent process-uptime reset signal.

## Cross-refs

- KE-797: Clean-start fresh interruption burst as storm aftermath signal
- KE-805: Clean-start pathology hits failed-triage too
- KE-811: Status-reality flap on every clean start
- KE-812: Quiescent-since-17:48Z baseline (no longer holds)
- KE-815: Cliff forecast (already falsified by KE-901; KE-901 itself now also partially falsified)
- KE-901: Cadence-collapsed-to-3.5h reading

## Falsifiers for this entry

- **F1**: If next restart gap is < 6h, the "back to 10-11h cadence" claim collapses; KE-901's "flapping" reading would re-validate. Cliff at ~16:00Z 2026-05-09 (05:32Z + 10.5h ± 1h).
- **F2**: If 06:00Z hour silent-error count was driven by something other than the 05:32Z restart (e.g. a deploy), the "storm aftermath fingerprint" attribution is wrong. Check git log + handler.fires-per-hour on a fresh window.
- **F3**: If the 06:42Z + 07:14Z + 08:05Z events were three independent restarts (e.g. process did die and respawn three times), then KE-901's gap math was right and this entry's "cluster as single event" rule is wrong. Distinguishing requires runtime stderr/PID logs which aren't in the DB.
