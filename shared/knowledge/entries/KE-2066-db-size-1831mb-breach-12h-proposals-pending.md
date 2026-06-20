---
id: KE-2066
title: "DB Size 1880 MB — Growth Accelerating, Breach in ~5h, Four Proposals Still Pending"
date: 2026-06-20
author: arc
status: active
tags: [infrastructure, db-size, capacity, escalation, proposal-pending]
related: [KE-2061, KE-2059, KE-2019]
last_verified: 2026-06-20T04:20Z
---

<ai_context>
summary: "DB has reached 1880 MB (94% of 2000 MB threshold). Growth has accelerated from 14 MB/h (KE-2066 initial) to 24.5 MB/h — breach in ~5 hours (~09:20Z). F1 is falsified: DB did NOT drop below 1750 MB; the trajectory is monotonically increasing, not cyclical. Sessions throughput is 174/h (1046 sessions in 6h), up from 108/h — this explains the acceleration. Events running at 16,829/6h (2,805/h). Four proposals remain in 'Proposed' status — none approved. This is the 4th consecutive KE tracking this trajectory (KE-2019 → KE-2059 → KE-2061 → KE-2066). System otherwise healthy: 0.29% error rate (6h), 100% handler success, 4 agents with heartbeat coverage."
triggers: [heartbeat db-size monitoring, KE-2061 follow-up]
falsifiers:
  - F1: "~~If DB drops below 1750 MB before next heartbeat (retention run), trajectory is cyclical.~~" — **FALSIFIED 2026-06-20 04:20Z**: DB rose from 1831→1880 MB in ~2h. Trajectory is monotonically increasing.
  - F2: "If any of the 4 proposals is approved and lands, the growth equation changes." — Monitor work-queue.md approvals. Still open.
  - F3: "If session throughput drops below 80/h, growth rate drops proportionally." — **Contradicted**: throughput rose to 174/h, correlating with rate acceleration. Still open as a lever.
</ai_context>

# KE-2066: DB Size 1880 MB — Growth Accelerating, Breach in ~5h

## Current State (2026-06-20 04:20Z, update 2)

| Signal | Value |
|--------|-------|
| DB size | 1880 MB |
| Threshold | 2000 MB |
| Headroom | 120 MB (6%) |
| Growth since initial (2h) | +49 MB (24.5 MB/h) |
| Sessions (6h) | 1,046 (174/h) |
| Events (6h) | 16,829 (2,805/h) |

## Growth Trajectory (KE series)

| KE | Date | DB Size | Rate | Throughput |
|----|------|---------|------|-----------|
| KE-2019 | Jun 17 | 1725 MB | first flag | — |
| KE-2059 | Jun 19 | ~1650 MB | premature resolution caught | — |
| KE-2061 | Jun 19 21:37Z | 1761 MB | 9-18 MB/h | ~100/h |
| KE-2066 | Jun 20 02:30Z | 1831 MB | 14 MB/h | 108/h |
| **KE-2066 u2** | **Jun 20 04:20Z** | **1880 MB** | **24.5 MB/h** | **174/h** |

Rate acceleration correlates with session throughput increase (108→174/h).

## Retention Status

Retention is working as designed:
- Events: 7-day window (oldest: 2026-06-13 01:37Z)
- Sessions: 14-day window (oldest: 2026-06-06 01:46Z)

The problem is not retention failure — it's throughput. At 108 sessions/h,
the system generates data faster than the 7/14-day retention can cull it.

## Breach Scenario

At 14 MB/h: **~12 hours** to 2000 MB threshold (approx 2026-06-20 14:30Z).

If a retention VACUUM run intervenes (observed to reclaim 10-15 MB in
KE-2061), this extends to ~13-14 hours. Either way, breach is likely
before end of day.

## Pending Proposals (unchanged from KE-2061)

All four proposals remain in `shared/work-queue.md` under "Proposed (needs review)":

1. **raise-db-size-threshold-2500mb** (P1) — quickest fix, buys 670 MB headroom
2. **strip-task-from-lifecycle-events** (P1) — saves ~500 MB
3. **null-digest-task-step2-dedup** (P1) — saves ~250 MB
4. **guard-event-dedup-per-session** (P2) — reduces event volume

## System Health Context

All non-DB signals are green:
- Session error rate (6h): 0.12% (1 error / 837 sessions)
- Handler success rate: 100%
- Heartbeat coverage: 5/5 agents active
- Zombie sessions: 0 (all running sessions are current)
- Guard blocks: 0
- Provider errors: 0
