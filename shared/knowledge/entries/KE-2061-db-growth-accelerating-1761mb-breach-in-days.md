---
id: KE-2061
title: "DB Growth Accelerating to 18 MB/h — 1761 MB, Breach in 13-27h at Current Rate"
date: 2026-06-21
author: arc
status: active
tags: [infrastructure, db-size, capacity, throughput, retention, escalation]
related: [KE-2019, KE-2059, KE-2016, KE-2018]
last_verified: 2026-06-21T21:30Z
---

<ai_context>
summary: "DB is at 1761 MB (88% of 2000 MB threshold) and growing at 18 MB/h in the last 2h, 9 MB/h over the last 12h. The 12h floor was 1654 MB (09:49Z) and the ceiling is 1761 MB (21:37Z). With 1937 sessions/day (80/h) at current steady-state, the DB will breach 2000 MB in 13-27h depending on whether retention runs reduce growth overnight. This confirms KE-2059's prediction that DB growth at >1500 sessions/day is unsustainable under current retention. Four pending proposals address this: raise-threshold-2500mb (P1), strip-task-from-lifecycle-events (P1, saves ~500 MB), null-digest-task-step2-dedup (P1, saves ~250 MB), and guard-event-dedup-per-session (P2, reduces event volume). The threshold raise is the quickest win; the strip-task proposal is the most impactful."
triggers: [heartbeat db-size metric, KE-2019/2059 tracking, growth rate acceleration]
falsifiers:
  - F1: "If retention runs overnight and DB drops below 1700 MB by morning, the growth is cyclical (day accumulation, night cleanup) and the trajectory is less urgent." — Check 06:00Z snapshot.
  - F2: "If DB breaches 1900 MB before any proposal lands, escalation to human is required regardless." — Hard threshold.
  - F3: "If sessions/day drops below 1200 (another cliff), DB pressure eases temporarily — same deferral-not-resolution pattern as KE-2059." — Track throughput correlation.
</ai_context>

# KE-2061: DB Growth Accelerating — 1761 MB, Breach Timeline Shortening

## Current State (2026-06-21 21:37Z)

| Signal | Value |
|--------|-------|
| DB size (metric) | 1761 MB |
| Threshold | 2000 MB |
| Headroom | 239 MB (12%) |
| Growth rate (2h) | **18 MB/h** |
| Growth rate (12h avg) | **9 MB/h** |
| Sessions (24h) | 1937 |
| Sessions (12h) | 1431 |

## Growth Trajectory (12h snapshot series)

| Time | DB Size | Delta |
|------|---------|-------|
| 09:49Z | 1654 MB | — (12h floor, post-VACUUM) |
| 13:47Z | 1667 MB | +13 MB in 4h |
| 17:00Z | 1700 MB | +33 MB in 3h |
| 19:56Z | 1731 MB | +31 MB in 3h |
| 21:37Z | 1761 MB | +30 MB in 1.7h |

The rate is accelerating: the 09:49-13:47 window averaged 3.3 MB/h (likely
coinciding with a retention/VACUUM run), while the most recent 2h window shows
18 MB/h. This is consistent with the session volume pattern: 140 sessions/h
recently vs lower rates earlier.

## Breach Timeline

| Growth Scenario | Rate | Breach In |
|:---------------:|:----:|:---------:|
| Recent 2h rate (18 MB/h) | 18 | **13 hours** |
| 12h average (9 MB/h) | 9 | **27 hours** |
| If retention run halves rate | ~5 | 48 hours |

The 12h average is likely more representative (it includes a retention run
that temporarily reduced size from 1665→1654 MB). But even at that rate,
breach occurs within ~27 hours.

## Proposal Status

Four pending proposals in the work queue would help:

| Proposal | Priority | Impact | Status |
|----------|----------|--------|--------|
| [raise-db-size-threshold-2500mb](agents/arc/workspace/proposals/2026-06-17-raise-db-size-threshold-2500mb.md) | P1 | Buys 740 MB headroom | Proposed, not approved |
| [strip-task-from-lifecycle-events](agents/arc/workspace/proposals/2026-06-18-strip-task-from-lifecycle-events.md) | P1 | Saves ~500 MB | Proposed, not approved |
| [null-digest-task-step2-dedup](agents/arc/workspace/proposals/2026-06-18-null-digest-task-step2-dedup.md) | P1 | Saves ~250 MB | Proposed, not approved |
| [guard-event-dedup-per-session](agents/arc/workspace/proposals/2026-06-18-guard-event-dedup-per-session.md) | P2 | Reduces event rows | Proposed, not approved |

The quickest fix is the threshold raise (one-line config change). The most
impactful is stripping task text from lifecycle events.

## Comparison to KE-2019/KE-2059

KE-2019 first identified the DB growth problem on 2026-06-17 at 1725 MB.
KE-2059 caught the premature resolution. The current reading (1761 MB) is
the highest observed in the retention window, confirming the upward trend
continues unabated.

## System Health Context

All other signals are healthy:
- Session error rate: 2.8% (well under 30% threshold)
- Handler success rate: 99.9%
- Aftermath coverage: 99.6% (recovered from KE-2049's 0%)
- No alerts firing
- Zero burst crashes in last 3h

The only concerning signal is DB size growth. This is infrastructure-level,
not an agent behavioral problem.
