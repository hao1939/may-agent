---
id: KE-2071
title: "DB Size Re-Accelerated to 1915 MB — KE-2070 Equilibrium Falsified, Breach ETA ~3h"
date: 2026-06-20
author: arc
status: active
tags: [infrastructure, db-size, capacity, trajectory-update, falsification]
related: [KE-2070, KE-2066, KE-2061, KE-2059, KE-2019]
last_verified: 2026-06-20T06:39Z
---

<ai_context>
summary: "DB at 1914.8 MB (95.7% of 2000 MB threshold). Since KE-2070 (05:42Z, 1889 MB), growth is +25.8 MB in 57 minutes = 27.2 MB/h. This FALSIFIES KE-2070 F1: growth has re-accelerated above 15 MB/h — the 7 MB/h 'equilibrium' was a one-off retention timing artifact, not steady state. Session throughput at 178/h (3h), events at 2998/h (3h). Retention ran ~11 min ago (hourly cadence confirmed) but cannot keep up. Only 85 MB headroom remains. At 27 MB/h, breach ETA is ~3.1 hours (~09:45Z). All 4 proposals remain unapproved. This is now an imminent capacity event — if no structural action is taken (threshold raise, data pruning, or throughput throttle), the metric will breach today."
triggers: [heartbeat db-size monitoring, KE-2070 F1 falsification check]
falsifiers:
  - F1: "If the next retention run (expected ~07:10Z) drops DB size by >20 MB, the acceleration may be intra-retention bolus." — Measure after next retention.
  - F2: "If DB crosses 1950 MB before 08:00Z, breach is certain today and escalation is overdue." — Monitor.
  - F3: "If human approves threshold raise to 2500 MB, the immediate crisis resolves (buys ~22h at current rate)." — Watch work-queue.
</ai_context>

# KE-2071: DB Size Re-Accelerated — 1915 MB, Breach ETA ~3h

## Critical State (2026-06-20 06:39Z)

| Signal | Value | Change from KE-2070 |
|--------|-------|---------------------|
| DB size | 1914.8 MB | +25.8 MB in 57 min |
| Effective growth rate | **27.2 MB/h** | up from claimed 7 MB/h |
| Sessions/h (3h) | 178 | down from 196 (minor) |
| Events/h (3h) | 2,998 | stable |
| Headroom | 85.2 MB (4.3%) | was 111 MB |
| Breach ETA | **~3.1h (~09:45Z)** | was ~16h |
| Retention cadence | hourly (last: 11 min ago) | unchanged |

## KE-2070 F1 Falsified

KE-2070 stated: *"If growth re-accelerates above 15 MB/h in the next 6h, the deceleration is a one-off retention timing artifact, not equilibrium."*

**Result**: Growth at 27.2 MB/h, well above 15 MB/h threshold. The claimed equilibrium was a measurement artifact — KE-2070 captured a post-retention dip that appeared as low growth rate. The underlying ingest rate overwhelms retention capacity.

## Why Retention Cannot Achieve Equilibrium

The math:
- **Retention window**: 7 days for events (290K rows), 14 days for sessions (24.4K rows)
- **Ingest rate**: ~3000 events/h + 178 sessions/h
- **Expected daily events**: 72,000. Retention should cull 7-day-old events at a similar rate.
- **Problem**: The daily ingest exceeds what the retention window expunges because the system's throughput has increased over time. The oldest events (from 7 days ago) came from lower-throughput periods, so fewer rows age out than arrive.

This is the classic "growing system, fixed retention" problem. Until throughput stabilizes at today's rate for a full 7-day cycle, net growth is positive.

## Growth Trajectory (Updated)

| KE | Time | DB Size | Rate | Note |
|----|------|---------|------|------|
| KE-2070 | 05:42Z | 1889 MB | 7 MB/h | Post-retention dip (artifact) |
| **KE-2071** | **06:39Z** | **1915 MB** | **27 MB/h** | **True rate; F1 falsified** |

## Remaining Options (All Require Human Action)

1. **Raise threshold 2000→2500 MB** — buys ~22h headroom at current rate
2. **Reduce retention**: 7d→3d events would immediately cull ~4 days of events
3. **Strip task from lifecycle events** — structural reduction ~500 MB
4. **Throttle throughput** — reduce handler fires/h (currently 472/h)

All proposals remain in `shared/work-queue.md` under "Proposed (needs review)."

## Assessment

This has been escalated via proposals 4 times (KE-2019, KE-2066, KE-2070, now KE-2071). The trajectory is clear: the DB will breach 2000 MB within ~3 hours. The equilibrium hypothesis was wrong. Only human-approved structural changes can prevent breach.
