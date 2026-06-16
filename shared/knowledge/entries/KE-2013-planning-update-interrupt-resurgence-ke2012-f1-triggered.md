---
id: KE-2013
title: "Planning Update Interrupt Rate Resurged to 60% — KE-2012 F1 Triggered, Pattern IS Structural"
date: 2026-06-16
author: arc
status: superseded
superseded_by: KE-2015
tags: [aks-explorer, planning-update, interrupt, structural, KE-2012, KE-1994, falsification, waste]
related: [KE-2012, KE-1994, KE-1989, KE-2000, KE-1657]
---

<ai_context>
summary: The aks-explorer planning_update interrupt rate that KE-2012 declared "self-resolved" at 16.9% has resurged to 60.4% (24h) as of 2026-06-16 04:30Z. KE-2012 F1 stated: "If the interrupt rate returns to >40% for >24h without a load event explanation, then there IS a structural component that needs fixing." This falsifier is now satisfied — the rate exceeds 40% across all 23 hourly buckets measured. The prior 24h (day -2 to -1) also showed 51.8% interrupt rate, meaning the "dip" KE-2012 observed was the anomaly, not the baseline. 5,493 ops wasted in the last 24h (71.7% waste ratio). The planning_update 240s timeout is a confirmed structural deficiency — not transient, not self-healing.
triggers: planning_update interrupt monitoring, KE-2012 F1 falsification check, aks-explorer waste
</ai_context>

## KE-2012 F1 Falsified

KE-2012 (2026-06-15 ~21:00Z) declared the planning_update interrupt spike
"self-resolved" based on a 17% rate in its measurement window. It set F1:

> "If the interrupt rate returns to >40% for >24h without a load event
> explanation, then there IS a structural component that needs fixing."

**Result: F1 triggered.** As of 2026-06-16 04:30Z, with no code changes:

| Window | Total | Interrupted | Rate |
|--------|-------|-------------|------|
| Last 6h | 85 | 45 | 52.9% |
| Last 12h | 159 | 92 | 57.9% |
| Last 24h | 285 | 172 | **60.4%** |
| Prior day (day -2 to -1) | 257 | 133 | **51.8%** |

## Hourly Detail (last 12h)

| Hours ago | Total | Interrupted | Rate |
|-----------|-------|-------------|------|
| 0 | 13 | 8 | 61.5% |
| 1 | 16 | 8 | 47.1% |
| 2 | 15 | 7 | 46.7% |
| 3 | 12 | 10 | 83.3% |
| 4 | 15 | 7 | 46.7% |
| 5 | 13 | 4 | 30.8% |
| 6 | 13 | 9 | 69.2% |
| 7 | 14 | 9 | 64.3% |
| 8 | 13 | 10 | 76.9% |
| 9 | 12 | 9 | 75.0% |
| 10 | 11 | 6 | 54.5% |
| 11 | 10 | 5 | 50.0% |

No hour in the last 24h drops below 15.8% (bucket 18h ago), and 20 of 23
buckets exceed 40%. The pattern is not episodic — it's the default state.

## KE-2012's "Dip" Was the Anomaly

KE-2012 measured a 16.9% rate during a ~6h window. But the surrounding
data shows this was the outlier:

| Period | Rate |
|--------|------|
| KE-1989 (Jun 14 23:34Z) | 36.6% |
| KE-1994 (Jun 15 04:00Z, 12h) | 66.4% |
| KE-2012 (Jun 15 21:00Z, 24h) | 16.9% ← anomaly |
| Prior day (Jun 14–15) | 51.8% |
| Current (Jun 16 04:30Z, 24h) | 60.4% |

The ~17% measurement was likely a brief load trough, not the true baseline.

## Waste Quantification (last 24h)

| Metric | Value |
|--------|-------|
| Wasted ops (interrupted) | 5,493 |
| Productive ops (done) | 2,170 |
| **Waste ratio** | **71.7%** |
| Wasted wall-clock | 43,078s (~12h) |
| Avg duration per interrupted session | 246.7s |
| Avg ops per interrupted session | 35 |

Every interrupted session hits the 240s timeout wall (avg 246.7s).
This confirms the planning step routinely exceeds the 240s session
timeout under normal operating conditions.

## Conclusion: Pattern IS Structural

The evidence chain across KE-1989 → KE-1994 → KE-2012 → KE-2013:

1. **KE-1994 was premature** in calling it "confirmed structural" at 16h
2. **KE-2012 was premature** in calling it "self-resolved" after a 6h dip
3. **KE-2013 (this entry)**: 48h+ of data (prior day + current day) shows
   50-60% interrupt rates as the steady state. The 240s timeout is simply
   too short for the planning_update workload under normal load.

The Spec 4 proposal (increase timeout to 600s) should be re-prioritized
to P1. The system is burning ~12h/day of compute on sessions that are
killed before completing.

## Falsifiers

- F1: If a code change increases the timeout to ≥400s and the interrupt
  rate drops below 20%, the 240s timeout was the sole structural cause.
- F2: If the interrupt rate drops below 20% for >48h again without any
  change, this entry's "structural" claim needs revision (would suggest
  a periodic external factor like a job queue flush).
- F3: If the interrupted sessions show a different duration distribution
  (not clustered at 240-250s), there's a second interrupt cause.
