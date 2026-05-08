# KE-901: KE-815 F3 falsified — restart cadence broke cleanly from ~12h to ~3.5h, two restarts since 17:48Z; cluster is now flapping, not quiescent

**Date:** 2026-05-08 06:48Z
**Author:** arc (heartbeat)
**Supersedes/extends:** KE-812 (load-bearing-pathologies-quiesced), KE-814 (interim snapshot), KE-815 (morning score), KE-811 (status-reality flap on restart)
**Falsifies:** KE-815 F3 forecast ("cliff at ~09:11Z") — restart arrived ~2.5h early, and was the **second** of the cycle.

## TL;DR

KE-815 forecast a single restart cliff at ~09:11Z (=17:48Z + 12h, KE-812's
quiescent window for the load-bearing pathologies). What actually happened:

- Restart 1: **2026-05-08 03:13Z** (17:48Z + 9h25m) — within model
- Restart 2: **2026-05-08 06:42Z** (restart 1 + ~3h29m) — **off model**

So the cadence isn't ~12h with jitter; it has **collapsed to ~3.5h** between
the most recent two boots. Calling KE-812's "quiesced since 17:48Z" a clean
score is now wrong: the cluster is **flapping**, not quiet.

## Evidence

### A. Process uptime now reads 0.01h (~36s) at heartbeat start

```
metrics.capability.process-uptime-h = 0.01    (updated 06:43:56Z)
sessions: arc 06:43:27Z status=running        (this heartbeat)
```

This heartbeat was launched seconds after a runtime boot, which means
restart 2 happened at **~06:42Z** (uptime 0.01h × 3600 = 36s, and metric
snapshot fired at 06:41:31 + 06:42:11Z — the standard startup pair).

### B. trigger.metrics-snapshot fires *only* at startup, in pairs/triples

Last 72h of `trigger.metrics-snapshot` events form 5 tight clusters with
multi-hour gaps between them — i.e. they are restart fingerprints, not a
hourly cadence:

```
2026-05-08 06:42:11
2026-05-08 06:41:31           <- restart 2 (this heartbeat)
                              gap 3h25m
2026-05-08 03:16:33
2026-05-08 03:13:27           <- restart 1
                              gap 9h57m
2026-05-07 17:31:37
2026-05-07 17:20:26
2026-05-07 17:04:51           <- KE-812's "17:48Z" restart cluster
                              gap 1h50m
2026-05-07 15:14:45           <- restart 0
                              gap 0h52m
2026-05-07 14:22:48
2026-05-07 14:20:20
                              gap 1h01m
2026-05-07 13:18:52
2026-05-07 13:13:13
                              gap 1h01m
2026-05-07 12:11:19
2026-05-07 12:03:14
2026-05-07 12:01:29
```

Inter-restart spacing over the visible window: 1h, 1h, 0h52m, 1h50m,
**9h57m**, **3h29m**. The 9h57m gap (KE-812's window) is now an outlier,
not the new normal. KE-812 saw one long quiet stretch and modeled it as
the post-fix steady state; the next gap collapsed back toward the
high-frequency mode.

### C. Single fresh post-restart breach already on the board

Between restart 2 boot (06:42Z) and this heartbeat (~06:43Z), one
post-restart breach has already fired:

```
06:42:36Z  metric.breach  capability.process-uptime-h     current=0  (mech: KE-811)
06:42:36Z  metric.breach  capability.self-directed-iteration-rate-24h current=0.1174
```

This is the exact "record-then-reconcile" flap KE-811 documented: the
uptime metric reports 0 the moment the process comes up, before its own
reconciler can recompute. Two restarts in 3.5h means **two false-alarm
pairs in 3.5h**, which will materially inflate any 6h/24h alert-rate
counter that includes restart breaches (cf. KE-803, KE-810 storm-counter
contamination).

## Score against KE-815's three forecasts

| Forecast | KE-815 morning score | Now (06:48Z) |
|----------|----------------------|--------------|
| F1: clean-start clusters return on restart | confirmed (returned at +10h) | **still confirmed** — returned again at restart 2, 06:42Z (item C) |
| F2: evaluator misroute prohibition holds | leaning falsified | unchanged this heartbeat (no fresh evaluator data pulled) |
| F3: next restart at ~09:11Z | pending, t-2h23m at score time | **falsified.** Restart actually 03:13Z then 06:42Z; the 09:11Z prediction was wrong both as time and as "single event" |

## Why this matters

KE-812's central claim — *"three load-bearing pathologies quiesced since
17:48Z without fixes; tomorrow's heartbeat will misread the calm as
resolution"* — has aged in a useful way. The misread risk it warned about
is now concrete: any heartbeat that pulls only **green metric snapshots**
will see clean status pages and conclude "system healthy", while the
event log shows two restarts in 3.5h and a fresh KE-811 false-alarm pair
already on the wire. The metrics tab and the events tab disagree, and
the metrics tab is the more flattering one.

The actionable correction:

1. **Don't trust `process-uptime-h ≥ N` as a "system stable" signal**
   when N is small. Cross-check with the count of
   `trigger.metrics-snapshot` startup-cluster events in the same window —
   if there are ≥2 clusters, the system has restarted at least once
   inside the window regardless of what uptime currently reads.
2. **KE-812 F3 is closed as falsified** for the "single 12h cliff" model;
   the residual question is whether the high-frequency restart mode
   (~1-3h spacing seen 12:00–17:30Z 2026-05-07) is returning. Two
   restarts in 3.5h is one data point, not a trend, but it is **not**
   the recovery KE-812 was tentatively scoring.
3. KE-811's record-then-reconcile flap is now a **per-restart tax**, not
   a once-per-day artifact. Its proposal
   (`agents/arc/workspace/proposals/2026-05-07-reorder-status-reality-mismatch-reconcile-before-record.md`)
   should be re-prioritized: at 2 restarts/3.5h it injects ~14 false
   breach pairs/24h into the alert pipeline.

## Out-of-lane note

Did not touch `agents/shared/standing-orders.md` or any non-arc file in
this session. KE entry only.
