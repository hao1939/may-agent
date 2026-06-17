---
title: "Raise DB size threshold from 2000 MB to 2500 MB"
date: 2026-06-17
author: arc
status: proposed
priority: P1
related: [KE-2019, KE-2020, KE-2016]
---

# Raise DB Size Threshold to 2500 MB

## Problem

The `infra.persist.db-size-mb` metric is at 1768 MB (88% of 2000 MB threshold) and
growing at 7-17 MB/h. At current rates, the threshold will be breached within 14-32
hours. This will generate a persistent alert that is a false positive — the underlying
growth is from legitimate throughput increases, not a leak or misconfiguration.

The 2000 MB threshold was set when aks-explorer ran ~300 sessions/day. It now runs
~2100 sessions/day (7x increase) after the planner fix (KE-2018). All retention windows
are working correctly (events 7d, sessions 14d, digests 14d, snapshots 14d). WAL is
under control (4 MB, down from 1356 MB — KE-2016 resolved).

## Evidence

| Data point | Value |
|---|---|
| Current DB size | 1768 MB |
| Current threshold | 2000 MB |
| Headroom | 232 MB (12%) |
| Growth rate (3.5h window) | 7.3 MB/h |
| Growth rate (24h window) | 16.8 MB/h |
| Time to breach | 14-32 hours |
| AKS-explorer sessions/day | ~2100 |
| Total sessions/day | ~3770 |
| Total events/day | ~58k |
| Event retention working | Yes (oldest event: Jun 10) |
| WAL size | 4 MB ✓ |

## Proposed Change

In `agents/may/handlers/metrics-snapshot.ts`, change the threshold for `infra.persist.db-size-mb`
from 2000 to 2500:

```typescript
// Before:
record("infra.persist.db-size-mb", sizeMb, { threshold: 2000, target: 1200 });

// After:
record("infra.persist.db-size-mb", sizeMb, { threshold: 2500, target: 1500 });
```

Target is also raised proportionally (1200 → 1500) to reflect the new steady-state.

## Expected Impact

1. Alert will not fire until DB reaches 2500 MB, providing ~700 MB headroom
2. At current growth rates, ~7-17 MB/h, this provides 43-100 additional hours before breach
3. The steady-state estimate (KE-2019) was 1800-2200 MB, so 2500 MB gives adequate margin
4. If growth continues beyond 2200 MB, KE-2020's F2 falsifier triggers further action (retention reduction)

## Risks

- If throughput doubles again, 2500 MB may also be insufficient. KE-2020 F2 covers this.
- None otherwise — this is purely a threshold calibration, not a data loss or structural change.

## Validation

After deployment:
1. DB size metric should show green (current < threshold)
2. Monitor for 48h: if DB stabilizes below 2200 MB with current retention, the calibration is correct
3. If DB grows past 2200 MB, consider reducing event retention to 5d (saves ~250 MB)
