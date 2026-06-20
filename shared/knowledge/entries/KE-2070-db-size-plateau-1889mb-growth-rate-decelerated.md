---
id: KE-2070
title: "DB Size 1889 MB — Growth Decelerated, Retention Holding Line, Breach ETA Extended"
date: 2026-06-20
author: arc
status: active
tags: [infrastructure, db-size, capacity, trajectory-update, retention-effective]
related: [KE-2066, KE-2061, KE-2059, KE-2019]
last_verified: 2026-06-20T05:42Z
---

<ai_context>
summary: "DB at 1889 MB (94.5% of 2000 MB threshold). Since KE-2066 u2 (04:20Z, 1880 MB), growth is +9 MB in ~1.3h = ~7 MB/h, a significant deceleration from the 24.5 MB/h rate observed in KE-2066 u2. The db-retention handler ran successfully at 05:34Z (12 min ago) and again at 04:50Z and 03:50Z (~hourly cadence). Session throughput is 196/h (3h window) — higher than KE-2066's 174/h — yet growth slowed, indicating retention is compensating proportionally. Events at 3,126/h (3h), 7-day retention confirmed (oldest event: 7.0 days ago). Sessions at 14-day retention (oldest: 14.0 days ago). The system is in a near-equilibrium state where ingestion rate approximately equals retention culling. Breach ETA extends from '~5 hours' (KE-2066 u2) to ~16 hours at current 7 MB/h rate. However, the underlying structural issue persists: all 4 proposals (raise threshold, strip task text, null digest dedup, guard event dedup) remain unapproved. The metric reads 1889.1 MB."
triggers: [heartbeat db-size monitoring, KE-2066 follow-up]
falsifiers:
  - F1: "If growth re-accelerates above 15 MB/h in the next 6h, the deceleration is a one-off retention timing artifact, not equilibrium." — Next heartbeat should re-measure.
  - F2: "If DB crosses 1950 MB before next human action on proposals, the equilibrium is fragile and threshold raise becomes urgent." — Watch for alert.
  - F3: "If session throughput drops below 150/h (e.g., overnight lull), net growth could go negative temporarily." — Check if retention can reclaim space during low-throughput windows.
</ai_context>

# KE-2070: DB Size 1889 MB — Growth Decelerated, Retention Effective

## Current State (2026-06-20 05:42Z)

| Signal | Value | Change from KE-2066 u2 |
|--------|-------|------------------------|
| DB size | 1889 MB | +9 MB in ~1.3h |
| Effective growth rate | ~7 MB/h | down from 24.5 MB/h |
| Sessions/h (3h) | 196 | up from 174 |
| Events/h (3h) | 3,126 | up from 2,805 |
| Retention cadence | ~hourly | confirmed via handler.completed events |
| Breach ETA | ~16h (~21:42Z) | extended from ~5h (09:20Z) |

## Growth Trajectory (Full KE Series)

| KE | Date/Time | DB Size | Rate | Sessions/h | Note |
|----|-----------|---------|------|-----------|------|
| KE-2019 | Jun 17 | 1725 MB | first flag | — | Initial observation |
| KE-2059 | Jun 19 | ~1650 MB | premature closure | — | False resolution |
| KE-2061 | Jun 19 21:37Z | 1761 MB | 9-18 MB/h | ~100 | — |
| KE-2066 | Jun 20 02:30Z | 1831 MB | 14 MB/h | 108 | — |
| KE-2066 u2 | Jun 20 04:20Z | 1880 MB | 24.5 MB/h | 174 | Rate spiked |
| **KE-2070** | **Jun 20 05:42Z** | **1889 MB** | **~7 MB/h** | **196** | **Decelerated** |

## Analysis: Why Growth Slowed Despite Higher Throughput

The acceleration in KE-2066 u2 likely reflected a bolus of sessions/events
accumulating between retention runs. The hourly db-retention handler
(confirmed via handler.completed events at 03:50Z, 04:50Z, 05:34Z) is
successfully culling expired rows. The net effect:

- **Ingestion**: ~196 sessions/h + 3,126 events/h = steady inflow
- **Retention**: 7-day events (288K rows, 7.0 days span) + 14-day sessions (24.3K rows, 14.0 days span)
- **Equilibrium**: retention culls roughly as fast as new data arrives at current throughput

This explains why the rate dropped from 24.5 → 7 MB/h without any
structural change: retention caught up with the intra-hour backlog.

## Risk Assessment

The equilibrium is **fragile** — headroom is only 111 MB (5.6%). Any burst
(e.g., concurrent dispatch burst producing many events) could temporarily
outpace retention. The structural fix (any of the 4 proposals) would
provide durable headroom.

## Proposal Status (unchanged)

All four proposals remain in `shared/work-queue.md` under "Proposed (needs review)":
1. **[P1] Raise threshold 2000→2500 MB** — buys 600 MB headroom instantly
2. **[P1] Strip task from lifecycle events** — saves ~500 MB
3. **[P1] NULL digest task step 2** — saves ~250 MB  
4. **[P2] Guard event dedup per session** — reduces event volume

## Status Column Contamination Note

3 sessions have non-canonical status = 'Agent ended with an empty assistant turn'
(confirmed still present, all `may` chat sessions from Jun 19). KE-2062 tracks this.
No new contaminated entries since then — F1 appears falsified (not ongoing).
