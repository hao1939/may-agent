---
id: KE-2020
title: "DB Size Threshold Breach Imminent — 14-32h at Current Growth Rate"
date: 2026-06-17
author: arc
status: active
tags: [infrastructure, db-size, threshold, capacity-planning, escalation]
related: [KE-2019, KE-2016]
---

<ai_context>
summary: The runtime DB is at 1768 MB (88% of 2000 MB threshold) and growing 7-17 MB/h. At current growth rates, the threshold will be breached within 14-32 hours. KE-2019's recommendation to raise the threshold to 2500 MB has not been acted on. The WAL issue (KE-2016) is resolved (WAL at 4 MB), and retention is working correctly (oldest event is 7 days old). The growth is driven by legitimate throughput increases from aks-explorer (2100+ sessions/day). A threshold raise to 2500 MB is the recommended first action; further retention tuning if growth continues.
triggers: db-size approaching threshold, capacity planning, KE-2019 follow-up
falsifiers:
  - F1: "If DB size stabilizes below 1900 MB for 24h without threshold or retention changes, growth has plateaued naturally."
  - F2: "If threshold is raised to 2500 MB and DB still breaches within 7 days, retention reduction (events 7→5d or digests 14→7d) is required."
</ai_context>

## Observation

At 2026-06-17 ~23:30Z, DB size trajectory is:

| Time window | DB size | Rate |
|---|---|---|
| 24h ago | 1366 MB | — |
| 3.5h ago | 1742 MB | — |
| Now | 1768 MB | 7-17 MB/h |

**Estimated time to 2000 MB threshold: 14-32 hours** (depending on whether 24h average or recent 3.5h rate is used).

## Context: Why Growth Accelerated

Per KE-2019:
- AKS-explorer sessions doubled from 1044/day (Jun 15) to 1991/day (Jun 17) after the planner fix (commit 24a7a60fc, KE-2018)
- Current throughput: ~3770 sessions/day across all agents, ~58k events/day
- Retention is working correctly: events 7d, sessions 14d, digests 14d, snapshots 14d
- WAL fix is working: WAL at 4 MB (down from 1356 MB on Jun 16)

## What's Changed Since KE-2019

1. DB has grown from 1725 MB (KE-2019, ~13:30Z) to 1768 MB (~23:30Z) — +43 MB in 10h
2. KE-2019's F1 (stabilization below 1900 MB) has NOT been falsified yet but the trajectory is upward
3. KE-2019's threshold raise recommendation (Option 1) has NOT been acted on
4. The proposal in work-queue.md (fix-db-size-metric-wal-checkpoint) addresses WAL measurement but not the threshold raise

## Recommendation

**Immediate: Raise `infra.persist.db-size-mb` threshold from 2000 to 2500 MB.** This requires a `src/` change (metrics-snapshot.ts) per ORDER-010. Filing a proposal for this change.

The 2000 MB threshold was set before aks-explorer throughput grew 3-7x. The metric should alert on actual disk pressure, not on the legitimate steady-state of a productive system. With WAL controlled and retention working, the threshold just needs to match actual throughput.

## Evidence

```
DB size metric snapshots (last 3.5h):
1742.18 → 1744.70 → 1747.31 → 1750.27 → 1753.16 → 1756.08 → 1757.96 → 1759.44 → 1758.53 → 1761.62 → 1764.58 → 1767.87

aks-explorer sessions/hour (last 12h): 46-140 sessions/hour (avg ~120/h)
Total sessions/day: ~3770
Total events/day: ~58k
```
