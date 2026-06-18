---
id: KE-2023
title: "DB Size Breach Timeline Confirmed — KE-2020 F1 Falsified, WAL Proposal Stale"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, threshold, capacity-planning, proposal-triage]
related: [KE-2020, KE-2019, KE-2016]
---

<ai_context>
summary: DB is at 1876 MB, growing 27 MB/h from aks-explorer throughput (125 sessions/h). KE-2020's F1 falsifier ("If DB size stabilizes below 1900 MB for 24h") is falsified — growth has been monotonic from 1574 MB (12h ago) to 1876 MB now. At current rate, 2000 MB threshold breach occurs in ~4.6 hours. Of the two DB proposals in work-queue.md, one is stale: the WAL checkpoint fix (2026-06-16, P1) targets a problem already solved (WAL is 4 MB, checkpoint is working). The threshold raise (2026-06-17, P1) remains the correct action. The active proposal queue has the right fix but no approval has landed in 24+ hours.
triggers: heartbeat metric check, KE-2020 breach timeline verification
falsifiers:
  - F1: "If DB retention runs and size drops below 1800 MB in the next 6h, growth is bursty and the threshold is adequate."
  - F2: "If threshold is raised to 2500 MB before breach, this entry becomes informational (no operational impact)."
</ai_context>

## Observation

At 2026-06-18 ~03:30Z, DB size trajectory:

| Time | Size (MB) | Rate |
|------|-----------|------|
| 12h ago (17:30Z Jun 17) | ~1574 | — |
| 6h ago (21:30Z Jun 17) | ~1717 | ~24 MB/h |
| Now (03:30Z Jun 18) | 1876 | ~27 MB/h |

**Growth over 12h: +302 MB (25 MB/h average).** This is faster than KE-2020's estimated 7-17 MB/h because aks-explorer throughput increased further (now 125 sessions/h vs ~120/h at KE-2020).

## KE-2020 F1 Status: FALSIFIED

KE-2020 F1 stated: "If DB size stabilizes below 1900 MB for 24h without threshold or retention changes, growth has plateaued naturally."

- DB crossed 1900 MB in the current snapshot window (1876 → still climbing)
- No stabilization observed — monotonic growth across all 12h measurement points
- No retention or threshold changes have been applied
- **F1 is falsified.** Growth is structural, not transient.

## Proposal Queue Status

| Proposal | Still valid? | Notes |
|----------|-------------|-------|
| Raise threshold 2000→2500 MB (2026-06-17, P1) | ✅ Yes | Correct action. Breach in ~4.6h without it |
| Fix WAL checkpoint (2026-06-16, P1) | ❌ Stale | WAL is 4 MB; checkpoint already works (verified this session). Premises resolved |

The WAL proposal (2026-06-16) was written when WAL was 1356 MB. That problem was fixed between 2026-06-16 and 2026-06-17. The proposal's "include WAL in measurement" change is now moot (4 MB WAL adds <0.2% to the metric).

## Current Drivers

- **aks-explorer**: 125 sessions/h × 18.2 avg ops = ~2275 tool-call events/h
- **evaluator**: 59 sessions/h × 22.2 avg ops = ~1310 ops/h
- **Total event bus**: 3042 events/h (infra.bus.event-count-1h metric)
- **Retention**: 14 days for sessions, 7 days for events — working correctly (oldest session Jun 4)
- **Row count**: 21,592 sessions in DB (14-day window)

## Recommendation

The threshold raise is the only needed action. With WAL at 4 MB and retention working, the DB size is the legitimate steady-state of a system processing 4400+ sessions/day. A 2500 MB threshold provides ~25% headroom above current growth trajectory.

If throughput continues growing (which is likely — aks-rp-e2e is an active push project), a further reduction in event retention (7d→5d) would be the next structural lever.
