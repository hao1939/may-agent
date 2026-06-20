---
id: KE-2066
title: "DB Size 1831 MB — 91.6% of Threshold, Breach in ~12h, Four Proposals Still Pending"
date: 2026-06-20
author: arc
status: active
tags: [infrastructure, db-size, capacity, escalation, proposal-pending]
related: [KE-2061, KE-2059, KE-2019]
last_verified: 2026-06-20T02:30Z
---

<ai_context>
summary: "DB has reached 1831 MB (91.6% of 2000 MB threshold) and grew 70 MB in the 5 hours since KE-2061 recorded 1761 MB (~14 MB/h). At this rate, breach occurs in ~12 hours. Retention is functioning correctly (events at 7-day window, sessions at 14-day window) but throughput of ~108 sessions/hour (2592 sessions/24h) outpaces retention cleanup. The DB holds 283K events and 23.8K sessions. Four proposals (raise-threshold-2500mb P1, strip-task-from-lifecycle-events P1, null-digest-task-step2-dedup P1, guard-event-dedup-per-session P2) remain in 'Proposed' status — none approved. This is the third consecutive KE tracking this trajectory (KE-2019 → KE-2059 → KE-2061 → KE-2066). The system is otherwise healthy: 0.7% error rate (6h), 100% handler success, 5/5 heartbeat coverage, zero zombie sessions."
triggers: [heartbeat db-size monitoring, KE-2061 follow-up]
falsifiers:
  - F1: "If DB drops below 1750 MB before next heartbeat (retention run), trajectory is cyclical." — Check metric in 2-3h.
  - F2: "If any of the 4 proposals is approved and lands, the growth equation changes." — Monitor work-queue.md approvals.
  - F3: "If session throughput drops below 80/h, growth rate drops proportionally." — Correlate sessions/h with MB/h.
</ai_context>

# KE-2066: DB Size 1831 MB — Breach Timeline ~12h

## Current State (2026-06-20 02:30Z)

| Signal | Value |
|--------|-------|
| DB size | 1831 MB |
| Threshold | 2000 MB |
| Headroom | 169 MB (8.4%) |
| Growth since KE-2061 (5h) | +70 MB (14 MB/h) |
| Sessions (24h) | 2,592 (108/h) |
| Events in DB | 283,580 |
| Sessions in DB | 23,804 |

## Growth Trajectory (KE series)

| KE | Date | DB Size | Rate |
|----|------|---------|------|
| KE-2019 | Jun 17 | 1725 MB | first flag |
| KE-2059 | Jun 19 | ~1650 MB | premature resolution caught |
| KE-2061 | Jun 19 21:37Z | 1761 MB | 9-18 MB/h |
| **KE-2066** | **Jun 20 02:30Z** | **1831 MB** | **14 MB/h** |

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
